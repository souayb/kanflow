use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use sqlx::FromRow;
use uuid::Uuid;

use crate::state::AppState;

const DEFAULT_OWNER: &str = "00000000-0000-0000-0000-000000000001";

#[derive(FromRow)]
struct ProjectRow {
    id: Uuid,
    name: String,
    description: String,
}

pub async fn list_projects(State(state): State<AppState>) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "postgres_disabled" })),
        )
            .into_response();
    };
    let rows = match sqlx::query_as::<_, ProjectRow>(
        "SELECT id, name, description FROM projects ORDER BY created_at DESC LIMIT 100",
    )
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };
    let body: Vec<_> = rows
        .into_iter()
        .map(|r| json!({"id": r.id, "name": r.name, "description": r.description}))
        .collect();
    Json(json!({ "projects": body })).into_response()
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectBody {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

// ── PATCH /api/v1/projects/:id ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateProjectBody {
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

pub async fn update_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProjectBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": "postgres_disabled" }))).into_response();
    };
    let current = sqlx::query_as::<_, ProjectRow>(
        "SELECT id, name, description FROM projects WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await;
    let current = match current {
        Ok(Some(r)) => r,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    };
    let name = body.name.as_deref().map(str::trim).filter(|s| !s.is_empty()).unwrap_or(&current.name).to_string();
    let description = body.description.as_deref().unwrap_or(&current.description).to_string();
    match sqlx::query_as::<_, ProjectRow>(
        "UPDATE projects SET name=$1, description=$2 WHERE id=$3 RETURNING id, name, description",
    )
    .bind(&name)
    .bind(&description)
    .bind(id)
    .fetch_one(pool)
    .await
    {
        Ok(r) => Json(json!({ "project": { "id": r.id, "name": r.name, "description": r.description } })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── DELETE /api/v1/projects/:id ──────────────────────────────────────────────

pub async fn delete_project(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": "postgres_disabled" }))).into_response();
    };
    match sqlx::query("DELETE FROM projects WHERE id = $1").bind(id).execute(pool).await {
        Ok(r) if r.rows_affected() == 0 => {
            (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response()
        }
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── POST /api/v1/projects ────────────────────────────────────────────────────

pub async fn create_project(State(state): State<AppState>, Json(body): Json<CreateProjectBody>) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "postgres_disabled" })),
        )
            .into_response();
    };
    let name = body.name.trim();
    if name.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "name_required" }))).into_response();
    }
    let owner = match Uuid::parse_str(DEFAULT_OWNER) {
        Ok(u) => u,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "default_owner_misconfigured" })),
            )
                .into_response();
        }
    };
    let rec = match sqlx::query_as::<_, ProjectRow>(
        r#"INSERT INTO projects (name, description, owner_id)
           VALUES ($1, $2, $3)
           RETURNING id, name, description"#,
    )
    .bind(name)
    .bind(body.description.trim())
    .bind(owner)
    .fetch_one(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };
    (
        StatusCode::CREATED,
        Json(json!({
            "project": { "id": rec.id, "name": rec.name, "description": rec.description }
        })),
    )
        .into_response()
}
