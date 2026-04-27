//! Task CRUD + comments — MISSION §5.3

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::FromRow;
use uuid::Uuid;

use crate::state::AppState;

fn pg_unavailable() -> axum::response::Response {
    (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": "postgres_disabled" }))).into_response()
}

// ── Row types ─────────────────────────────────────────────────────────────────

#[derive(FromRow)]
struct TaskRow {
    id: Uuid,
    project_id: Uuid,
    column_id: Uuid,
    title: String,
    description: String,
    priority: String,
    assignee_id: Option<Uuid>,
    due_at: Option<DateTime<Utc>>,
    tags: Vec<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct CommentRow {
    id: Uuid,
    task_id: Uuid,
    user_id: String,
    user_name: String,
    content: String,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct DepRow {
    task_id: Uuid,
    depends_on_id: Uuid,
}

fn task_json(
    t: &TaskRow,
    comments: &[CommentRow],
    deps: &[Uuid],
) -> serde_json::Value {
    let comments_v: Vec<_> = comments
        .iter()
        .map(|c| json!({
            "id": c.id,
            "userId": c.user_id,
            "userName": c.user_name,
            "content": c.content,
            "createdAt": c.created_at.timestamp_millis(),
        }))
        .collect();
    let deps_v: Vec<_> = deps.iter().map(|d| json!(d)).collect();
    json!({
        "id":          t.id,
        "projectId":   t.project_id,
        "status":      t.column_id,          // frontend Task.status == columnId
        "title":       t.title,
        "description": t.description,
        "priority":    t.priority,
        "assigneeId":  t.assignee_id,
        "dueDate":     t.due_at.map(|d| d.timestamp_millis()),
        "tags":        t.tags,
        "comments":    comments_v,
        "dependencies": deps_v,
        "createdAt":   t.created_at.timestamp_millis(),
        "updatedAt":   t.updated_at.timestamp_millis(),
    })
}

// ── GET /api/v1/projects/:project_id/tasks ───────────────────────────────────

pub async fn list_tasks(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else { return pg_unavailable() };

    let task_rows = sqlx::query_as::<_, TaskRow>(
        "SELECT id, project_id, column_id, title, description, priority,
                assignee_id, due_at, tags, created_at, updated_at
         FROM tasks WHERE project_id = $1 ORDER BY created_at ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await;

    let task_rows = match task_rows {
        Ok(r) => r,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    };

    if task_rows.is_empty() {
        return Json(json!({ "tasks": [] })).into_response();
    }

    // Fetch comments for all tasks in one query
    let comment_rows = sqlx::query_as::<_, CommentRow>(
        "SELECT c.id, c.task_id, c.user_id, c.user_name, c.content, c.created_at
         FROM comments c
         JOIN tasks t ON c.task_id = t.id
         WHERE t.project_id = $1 ORDER BY c.created_at ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Fetch dependencies for all tasks in one query
    let dep_rows = sqlx::query_as::<_, DepRow>(
        "SELECT td.task_id, td.depends_on_id
         FROM task_dependencies td
         JOIN tasks t ON td.task_id = t.id
         WHERE t.project_id = $1",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Group by task_id
    let mut comments_map: HashMap<Uuid, Vec<CommentRow>> = HashMap::new();
    for c in comment_rows {
        comments_map.entry(c.task_id).or_default().push(c);
    }
    let mut deps_map: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
    for d in dep_rows {
        deps_map.entry(d.task_id).or_default().push(d.depends_on_id);
    }

    let tasks: Vec<_> = task_rows
        .iter()
        .map(|t| {
            let comments = comments_map.get(&t.id).map(Vec::as_slice).unwrap_or(&[]);
            let deps = deps_map.get(&t.id).map(Vec::as_slice).unwrap_or(&[]);
            task_json(t, comments, deps)
        })
        .collect();

    Json(json!({ "tasks": tasks })).into_response()
}

// ── POST /api/v1/projects/:project_id/tasks ──────────────────────────────────

#[derive(Deserialize)]
pub struct CreateTaskBody {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_priority")]
    pub priority: String,
    pub status: Uuid,           // column_id
    pub assignee_id: Option<Uuid>,
    pub due_date: Option<i64>,  // Unix ms
    #[serde(default)]
    pub tags: Vec<String>,
}
fn default_priority() -> String { "medium".into() }

pub async fn create_task(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateTaskBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else { return pg_unavailable() };
    let title = body.title.trim();
    if title.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "title_required" }))).into_response();
    }
    let due_at: Option<DateTime<Utc>> = body
        .due_date
        .and_then(|ms| DateTime::from_timestamp_millis(ms));

    match sqlx::query_as::<_, TaskRow>(
        "INSERT INTO tasks (project_id, column_id, title, description, priority, assignee_id, due_at, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, project_id, column_id, title, description, priority,
                   assignee_id, due_at, tags, created_at, updated_at",
    )
    .bind(project_id)
    .bind(body.status)
    .bind(title)
    .bind(body.description.trim())
    .bind(&body.priority)
    .bind(body.assignee_id)
    .bind(due_at)
    .bind(&body.tags)
    .fetch_one(pool)
    .await
    {
        Ok(t) => (StatusCode::CREATED, Json(json!({ "task": task_json(&t, &[], &[]) }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── PATCH /api/v1/tasks/:task_id ─────────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateTaskBody {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub status: Option<Uuid>,        // column_id
    pub assignee_id: Option<Uuid>,
    pub due_date: Option<i64>,       // Unix ms, 0 = clear
    pub tags: Option<Vec<String>>,
}

pub async fn update_task(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
    Json(body): Json<UpdateTaskBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else { return pg_unavailable() };
    let current = sqlx::query_as::<_, TaskRow>(
        "SELECT id, project_id, column_id, title, description, priority,
                assignee_id, due_at, tags, created_at, updated_at
         FROM tasks WHERE id = $1",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await;

    let current = match current {
        Ok(Some(t)) => t,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response(),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    };

    let title = body.title.as_deref().map(str::trim).filter(|s| !s.is_empty()).unwrap_or(&current.title).to_string();
    let description = body.description.unwrap_or(current.description);
    let priority = body.priority.unwrap_or(current.priority);
    let column_id = body.status.unwrap_or(current.column_id);
    let assignee_id = body.assignee_id.or(current.assignee_id);
    let due_at: Option<DateTime<Utc>> = match body.due_date {
        Some(0) => None,
        Some(ms) => DateTime::from_timestamp_millis(ms),
        None => current.due_at,
    };
    let tags = body.tags.unwrap_or(current.tags);

    match sqlx::query_as::<_, TaskRow>(
        "UPDATE tasks SET title=$1, description=$2, priority=$3, column_id=$4,
                          assignee_id=$5, due_at=$6, tags=$7, updated_at=now()
         WHERE id=$8
         RETURNING id, project_id, column_id, title, description, priority,
                   assignee_id, due_at, tags, created_at, updated_at",
    )
    .bind(&title)
    .bind(&description)
    .bind(&priority)
    .bind(column_id)
    .bind(assignee_id)
    .bind(due_at)
    .bind(&tags)
    .bind(task_id)
    .fetch_one(pool)
    .await
    {
        Ok(t) => Json(json!({ "task": task_json(&t, &[], &[]) })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── DELETE /api/v1/tasks/:task_id ────────────────────────────────────────────

pub async fn delete_task(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else { return pg_unavailable() };
    match sqlx::query("DELETE FROM tasks WHERE id = $1")
        .bind(task_id)
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

// ── POST /api/v1/tasks/:task_id/comments ─────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateCommentBody {
    pub user_id: String,
    pub user_name: String,
    pub content: String,
}

pub async fn create_comment(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
    Json(body): Json<CreateCommentBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else { return pg_unavailable() };
    let content = body.content.trim();
    if content.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "content_required" }))).into_response();
    }
    match sqlx::query_as::<_, CommentRow>(
        "INSERT INTO comments (task_id, user_id, user_name, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, task_id, user_id, user_name, content, created_at",
    )
    .bind(task_id)
    .bind(body.user_id.trim())
    .bind(body.user_name.trim())
    .bind(content)
    .fetch_one(pool)
    .await
    {
        Ok(c) => (StatusCode::CREATED, Json(json!({
            "comment": {
                "id": c.id,
                "userId": c.user_id,
                "userName": c.user_name,
                "content": c.content,
                "createdAt": c.created_at.timestamp_millis(),
            }
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}
