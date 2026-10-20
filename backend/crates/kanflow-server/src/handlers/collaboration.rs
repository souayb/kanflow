//! Work sessions + activity feed — MISSION §5.12 (AgentBoardMCP-inspired).

use std::collections::{HashMap, HashSet};

use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{DateTime, Duration, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::FromRow;
use uuid::Uuid;

use crate::auth::KanflowAuth;
use crate::state::AppState;

fn pg_unavailable() -> axum::response::Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({ "error": "postgres_disabled" })),
    )
        .into_response()
}

#[derive(FromRow)]
struct SessionRow {
    id: Uuid,
    project_id: Uuid,
    task_id: Option<Uuid>,
    owner_user_id: Uuid,
    actor_kind: String,
    tool: Option<String>,
    intent: String,
    phase: String,
    touched_files: Vec<String>,
    planned_files: Vec<String>,
    branch_name: Option<String>,
    heartbeat_at: DateTime<Utc>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct ActivityRow {
    id: Uuid,
    project_id: Uuid,
    actor_id: Uuid,
    actor_kind: String,
    action: String,
    task_id: Option<Uuid>,
    path: Option<String>,
    message: String,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct IssueLinkRow {
    task_id: Uuid,
    github_issue_number: Option<i32>,
}

const SESSION_COLS: &str =
    "id, project_id, task_id, owner_user_id, actor_kind, tool, intent, phase, \
    touched_files, planned_files, branch_name, heartbeat_at, created_at, updated_at";

fn session_json(s: &SessionRow) -> serde_json::Value {
    json!({
        "id": s.id,
        "projectId": s.project_id,
        "taskId": s.task_id,
        "ownerUserId": s.owner_user_id,
        "actorKind": s.actor_kind,
        "tool": s.tool,
        "intent": s.intent,
        "phase": s.phase,
        "touchedFiles": s.touched_files,
        "plannedFiles": s.planned_files,
        "branchName": s.branch_name,
        "heartbeatAt": s.heartbeat_at.timestamp_millis(),
        "createdAt": s.created_at.timestamp_millis(),
        "updatedAt": s.updated_at.timestamp_millis(),
    })
}

fn activity_json(a: &ActivityRow) -> serde_json::Value {
    json!({
        "id": a.id,
        "projectId": a.project_id,
        "actorId": a.actor_id,
        "actorKind": a.actor_kind,
        "action": a.action,
        "taskId": a.task_id,
        "path": a.path,
        "message": a.message,
        "createdAt": a.created_at.timestamp_millis(),
    })
}

fn is_active(heartbeat: DateTime<Utc>, now: DateTime<Utc>) -> bool {
    now.signed_duration_since(heartbeat) < Duration::hours(2)
}

fn is_stale_or_active(heartbeat: DateTime<Utc>, now: DateTime<Utc>) -> bool {
    now.signed_duration_since(heartbeat) < Duration::hours(24)
}

fn session_paths(s: &SessionRow) -> HashSet<String> {
    s.touched_files
        .iter()
        .chain(s.planned_files.iter())
        .cloned()
        .collect()
}

fn compute_overlaps(
    sessions: &[SessionRow],
    issue_by_task: &HashMap<Uuid, i32>,
    now: DateTime<Utc>,
) -> Vec<serde_json::Value> {
    let active: Vec<&SessionRow> = sessions
        .iter()
        .filter(|s| is_active(s.heartbeat_at, now))
        .collect();
    let mut out = Vec::new();

    for i in 0..active.len() {
        for j in (i + 1)..active.len() {
            let a = active[i];
            let b = active[j];
            let pa = session_paths(a);
            let pb = session_paths(b);
            let shared: Vec<_> = pa.intersection(&pb).cloned().collect();
            if !shared.is_empty() {
                out.push(json!({
                    "kind": "file_overlap",
                    "sessionId": a.id,
                    "otherSessionId": b.id,
                    "detail": format!("{} shared path(s)", shared.len()),
                    "paths": shared,
                }));
            }
            if let (Some(ba), Some(bb)) = (&a.branch_name, &b.branch_name) {
                if !ba.is_empty() && ba == bb {
                    out.push(json!({
                        "kind": "shared_branch",
                        "sessionId": a.id,
                        "otherSessionId": b.id,
                        "detail": format!("Same branch {ba}"),
                    }));
                }
            }
            if let (Some(ta), Some(tb)) = (a.task_id, b.task_id) {
                if let (Some(ia), Some(ib)) = (issue_by_task.get(&ta), issue_by_task.get(&tb)) {
                    if ia == ib {
                        out.push(json!({
                            "kind": "issue_collision",
                            "sessionId": a.id,
                            "otherSessionId": b.id,
                            "detail": format!("Same GitHub issue #{ia}"),
                            "issueNumber": ia,
                        }));
                    }
                }
            }
        }
    }
    out
}

#[allow(clippy::too_many_arguments)]
pub async fn insert_activity(
    pool: &sqlx::PgPool,
    project_id: Uuid,
    actor_id: Uuid,
    actor_kind: &str,
    action: &str,
    task_id: Option<Uuid>,
    path: Option<&str>,
    message: &str,
) {
    let _ = sqlx::query(
        "INSERT INTO activity_events (project_id, actor_id, actor_kind, action, task_id, path, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(project_id)
    .bind(actor_id)
    .bind(actor_kind)
    .bind(action)
    .bind(task_id)
    .bind(path)
    .bind(message)
    .execute(pool)
    .await;
}

// ── GET /api/v1/projects/:project_id/sessions ────────────────────────────────

pub async fn list_sessions(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Extension(auth): Extension<KanflowAuth>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };
    let now = Utc::now();

    let rows = sqlx::query_as::<_, SessionRow>(&format!(
        "SELECT {SESSION_COLS} FROM work_sessions WHERE project_id = $1 ORDER BY heartbeat_at DESC"
    ))
    .bind(project_id)
    .fetch_all(pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let hidden_owners: HashSet<Uuid> = sqlx::query_scalar(
        "SELECT id FROM users
         WHERE COALESCE((privacy_settings->>'showOnlineStatus')::boolean, true) = false
           AND ($1::text IS NULL OR LOWER(email) <> LOWER($1))",
    )
    .bind(auth.email.as_deref())
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .collect();

    let visible: Vec<SessionRow> = rows
        .into_iter()
        .filter(|s| {
            is_stale_or_active(s.heartbeat_at, now) && !hidden_owners.contains(&s.owner_user_id)
        })
        .collect();

    let task_ids: Vec<Uuid> = visible.iter().filter_map(|s| s.task_id).collect();
    let mut issue_by_task: HashMap<Uuid, i32> = HashMap::new();
    if !task_ids.is_empty() {
        if let Ok(links) = sqlx::query_as::<_, IssueLinkRow>(
            "SELECT id AS task_id, github_issue_number FROM tasks WHERE id = ANY($1)",
        )
        .bind(&task_ids)
        .fetch_all(pool)
        .await
        {
            for link in links {
                if let Some(n) = link.github_issue_number {
                    issue_by_task.insert(link.task_id, n);
                }
            }
        }
    }

    let overlaps = compute_overlaps(&visible, &issue_by_task, now);
    let sessions: Vec<_> = visible.iter().map(session_json).collect();

    Json(json!({ "sessions": sessions, "overlaps": overlaps })).into_response()
}

// ── POST /api/v1/projects/:project_id/sessions (claim) ───────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaimSessionBody {
    pub owner_user_id: Uuid,
    #[serde(default = "default_human")]
    pub actor_kind: String,
    pub tool: Option<String>,
    #[serde(default)]
    pub intent: String,
    #[serde(default = "default_phase")]
    pub phase: String,
    pub task_id: Option<Uuid>,
    #[serde(default)]
    pub touched_files: Vec<String>,
    #[serde(default)]
    pub planned_files: Vec<String>,
    pub branch_name: Option<String>,
    /// When set, update this session instead of inserting.
    pub session_id: Option<Uuid>,
}

fn default_human() -> String {
    "human".into()
}
fn default_phase() -> String {
    "exploring".into()
}

pub async fn claim_session(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<ClaimSessionBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };

    let actor_kind = if body.actor_kind == "agent" {
        "agent"
    } else {
        "human"
    };
    let phase = match body.phase.as_str() {
        "implementing" | "testing" | "pr_open" | "review" | "blocked" => body.phase.as_str(),
        _ => "exploring",
    };
    let tool = body
        .tool
        .as_deref()
        .filter(|t| matches!(*t, "cursor" | "claude" | "codex" | "ollama" | "human"));

    let result = if let Some(sid) = body.session_id {
        sqlx::query_as::<_, SessionRow>(&format!(
            "UPDATE work_sessions SET
                task_id = COALESCE($2, task_id),
                actor_kind = $3,
                tool = COALESCE($4, tool),
                intent = CASE WHEN $5 = '' THEN intent ELSE $5 END,
                phase = $6,
                touched_files = CASE WHEN cardinality($7::text[]) = 0 THEN touched_files ELSE $7 END,
                planned_files = CASE WHEN cardinality($8::text[]) = 0 THEN planned_files ELSE $8 END,
                branch_name = COALESCE($9, branch_name),
                heartbeat_at = NOW(),
                updated_at = NOW()
             WHERE id = $1 AND project_id = $10
             RETURNING {SESSION_COLS}"
        ))
        .bind(sid)
        .bind(body.task_id)
        .bind(actor_kind)
        .bind(tool)
        .bind(body.intent.trim())
        .bind(phase)
        .bind(&body.touched_files)
        .bind(&body.planned_files)
        .bind(body.branch_name.as_deref())
        .bind(project_id)
        .fetch_optional(pool)
        .await
    } else {
        sqlx::query_as::<_, SessionRow>(&format!(
            "INSERT INTO work_sessions (
                project_id, task_id, owner_user_id, actor_kind, tool, intent, phase,
                touched_files, planned_files, branch_name
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING {SESSION_COLS}"
        ))
        .bind(project_id)
        .bind(body.task_id)
        .bind(body.owner_user_id)
        .bind(actor_kind)
        .bind(tool)
        .bind(body.intent.trim())
        .bind(phase)
        .bind(&body.touched_files)
        .bind(&body.planned_files)
        .bind(body.branch_name.as_deref())
        .fetch_optional(pool)
        .await
    };

    match result {
        Ok(Some(s)) => {
            insert_activity(
                pool,
                project_id,
                body.owner_user_id,
                actor_kind,
                "session_claimed",
                s.task_id,
                s.touched_files.first().map(String::as_str),
                &format!(
                    "Claimed: {}",
                    if s.intent.is_empty() {
                        "work session"
                    } else {
                        &s.intent
                    }
                ),
            )
            .await;
            (
                StatusCode::CREATED,
                Json(json!({ "session": session_json(&s) })),
            )
                .into_response()
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

// ── PATCH /api/v1/sessions/:session_id ───────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionBody {
    pub intent: Option<String>,
    pub phase: Option<String>,
    pub task_id: Option<Uuid>,
    pub touched_files: Option<Vec<String>>,
    pub planned_files: Option<Vec<String>>,
    pub branch_name: Option<String>,
    pub tool: Option<String>,
    #[serde(default)]
    pub heartbeat: bool,
}

pub async fn update_session(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
    Json(body): Json<UpdateSessionBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };

    let current = sqlx::query_as::<_, SessionRow>(&format!(
        "SELECT {SESSION_COLS} FROM work_sessions WHERE id = $1"
    ))
    .bind(session_id)
    .fetch_optional(pool)
    .await;

    let current = match current {
        Ok(Some(s)) => s,
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response();
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let intent = body.intent.unwrap_or(current.intent);
    let phase = body
        .phase
        .filter(|p| {
            matches!(
                p.as_str(),
                "exploring" | "implementing" | "testing" | "pr_open" | "review" | "blocked"
            )
        })
        .unwrap_or(current.phase);
    let task_id = body.task_id.or(current.task_id);
    let touched = body.touched_files.unwrap_or(current.touched_files);
    let planned = body.planned_files.unwrap_or(current.planned_files);
    let branch = body.branch_name.or(current.branch_name);
    let tool = body.tool.or(current.tool);

    let updated = sqlx::query_as::<_, SessionRow>(&format!(
        "UPDATE work_sessions SET
            intent = $2, phase = $3, task_id = $4, touched_files = $5, planned_files = $6,
            branch_name = $7, tool = $8,
            heartbeat_at = CASE WHEN $9 THEN NOW() ELSE heartbeat_at END,
            updated_at = NOW()
         WHERE id = $1
         RETURNING {SESSION_COLS}"
    ))
    .bind(session_id)
    .bind(&intent)
    .bind(&phase)
    .bind(task_id)
    .bind(&touched)
    .bind(&planned)
    .bind(branch.as_deref())
    .bind(tool.as_deref())
    .bind(body.heartbeat)
    .fetch_one(pool)
    .await;

    match updated {
        Ok(s) => Json(json!({ "session": session_json(&s) })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

// ── DELETE /api/v1/sessions/:session_id (release) ────────────────────────────

pub async fn release_session(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };

    let current = sqlx::query_as::<_, SessionRow>(&format!(
        "SELECT {SESSION_COLS} FROM work_sessions WHERE id = $1"
    ))
    .bind(session_id)
    .fetch_optional(pool)
    .await;

    let current = match current {
        Ok(Some(s)) => s,
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response();
        }
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    match sqlx::query("DELETE FROM work_sessions WHERE id = $1")
        .bind(session_id)
        .execute(pool)
        .await
    {
        Ok(_) => {
            insert_activity(
                pool,
                current.project_id,
                current.owner_user_id,
                &current.actor_kind,
                "session_released",
                current.task_id,
                None,
                "Released work session",
            )
            .await;
            StatusCode::NO_CONTENT.into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

// ── GET /api/v1/projects/:project_id/activity ────────────────────────────────

pub async fn list_activity(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Extension(auth): Extension<KanflowAuth>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };

    let since = Utc::now() - Duration::hours(48);
    let rows = sqlx::query_as::<_, ActivityRow>(
        "SELECT a.id, a.project_id, a.actor_id, a.actor_kind, a.action, a.task_id, a.path,
                a.message, a.created_at
         FROM activity_events a
         LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.project_id = $1 AND a.created_at >= $2
           AND (
             u.id IS NULL
             OR COALESCE(u.privacy_settings->>'activityVisibility', 'project') <> 'private'
             OR ($3::text IS NOT NULL AND LOWER(u.email) = LOWER($3))
           )
         ORDER BY a.created_at DESC
         LIMIT 100",
    )
    .bind(project_id)
    .bind(since)
    .bind(auth.email.as_deref())
    .fetch_all(pool)
    .await;

    match rows {
        Ok(r) => {
            let events: Vec<_> = r.iter().map(activity_json).collect();
            Json(json!({ "events": events })).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}
