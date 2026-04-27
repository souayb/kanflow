use axum::extract::State;
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
