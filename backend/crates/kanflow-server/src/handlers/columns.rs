//! Column CRUD — MISSION §5.2

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use sqlx::FromRow;
use uuid::Uuid;

use crate::state::AppState;

#[derive(FromRow)]
struct ColumnRow {
    id: Uuid,
    project_id: Uuid,
    title: String,
    sort_order: i32,
}

fn col_json(c: &ColumnRow) -> serde_json::Value {
    json!({ "id": c.id, "projectId": c.project_id, "title": c.title, "order": c.sort_order })
}

fn pg_unavailable() -> axum::response::Response {
    (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": "postgres_disabled" }))).into_response()
}

// ── GET /api/v1/projects/:project_id/columns ─────────────────────────────────

pub async fn list_columns(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else { return pg_unavailable() };
    match sqlx::query_as::<_, ColumnRow>(
        "SELECT id, project_id, title, sort_order FROM columns WHERE project_id = $1 ORDER BY sort_order ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    {
        Ok(rows) => Json(json!({ "columns": rows.iter().map(col_json).collect::<Vec<_>>() })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── POST /api/v1/projects/:project_id/columns ────────────────────────────────

#[derive(Deserialize)]
pub struct CreateColumnBody {
    pub title: String,
    #[serde(default)]
    pub order: i32,
}

pub async fn create_column(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateColumnBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else { return pg_unavailable() };
    let title = body.title.trim();
    if title.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "title_required" }))).into_response();
    }
    match sqlx::query_as::<_, ColumnRow>(
        "INSERT INTO columns (project_id, title, sort_order) VALUES ($1, $2, $3)
         RETURNING id, project_id, title, sort_order",
    )
    .bind(project_id)
    .bind(title)
    .bind(body.order)
    .fetch_one(pool)
    .await
    {
        Ok(c) => (StatusCode::CREATED, Json(json!({ "column": col_json(&c) }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── PATCH /api/v1/projects/:project_id/columns/:column_id ────────────────────

#[derive(Deserialize)]
pub struct UpdateColumnBody {
    pub title: Option<String>,
    pub order: Option<i32>,
}

pub async fn update_column(
    State(state): State<AppState>,
    Path((_project_id, column_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateColumnBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else { return pg_unavailable() };
    // Fetch current to merge
    let current = sqlx::query_as::<_, ColumnRow>(
        "SELECT id, project_id, title, sort_order FROM columns WHERE id = $1",
    )
    .bind(column_id)
    .fetch_optional(pool)
    .await;
    let current = match current {
        Ok(Some(c)) => c,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    };
    let new_title = body.title.as_deref().map(str::trim).filter(|s| !s.is_empty()).unwrap_or(&current.title).to_string();
    let new_order = body.order.unwrap_or(current.sort_order);
    match sqlx::query_as::<_, ColumnRow>(
        "UPDATE columns SET title = $1, sort_order = $2 WHERE id = $3
         RETURNING id, project_id, title, sort_order",
    )
    .bind(&new_title)
    .bind(new_order)
    .bind(column_id)
    .fetch_one(pool)
    .await
    {
        Ok(c) => Json(json!({ "column": col_json(&c) })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── DELETE /api/v1/projects/:project_id/columns/:column_id ───────────────────

pub async fn delete_column(
    State(state): State<AppState>,
    Path((_project_id, column_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else { return pg_unavailable() };
    match sqlx::query("DELETE FROM columns WHERE id = $1")
        .bind(column_id)
        .execute(pool)
        .await
    {
        Ok(r) if r.rows_affected() == 0 => {
            (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response()
        }
        Ok(_) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}
