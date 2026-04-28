//! User directory + admin create — MISSION §8 (Keycloak-aligned Postgres users).

use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use sqlx::FromRow;
use uuid::Uuid;

use crate::auth::KanflowAuth;
use crate::state::AppState;

fn pg_unavailable() -> axum::response::Response {
    (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": "postgres_disabled" }))).into_response()
}

#[derive(FromRow)]
struct UserRow {
    id: Uuid,
    name: String,
    email: String,
    role: String,
}

pub async fn list_users(
    State(state): State<AppState>,
    Extension(_auth): Extension<KanflowAuth>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };
    match sqlx::query_as::<_, UserRow>("SELECT id, name, email, role FROM users ORDER BY name ASC")
        .fetch_all(pool)
        .await
    {
        Ok(rows) => {
            let users: Vec<_> = rows
                .into_iter()
                .map(|r| {
                    json!({
                        "id": r.id,
                        "name": r.name,
                        "email": r.email,
                        "role": r.role,
                    })
                })
                .collect();
            Json(json!({ "users": users })).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateUserBody {
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub role: Option<String>,
}

pub async fn create_user(
    State(state): State<AppState>,
    Extension(auth): Extension<KanflowAuth>,
    Json(body): Json<CreateUserBody>,
) -> impl IntoResponse {
    if !auth.is_admin() {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "admin_only", "message": "Realm role admin required" })),
        )
            .into_response();
    }

    let name = body.name.trim();
    let email = body.email.trim().to_lowercase();
    if name.is_empty() || email.is_empty() || !email.contains('@') {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid_name_or_email" })),
        )
            .into_response();
    }

    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };

    let role = body
        .role
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("member")
        .to_string();

    let id = Uuid::new_v4();
    let res = sqlx::query(
        "INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(name)
    .bind(&email)
    .bind(&role)
    .execute(pool)
    .await;

    match res {
        Ok(_) => (
            StatusCode::CREATED,
            Json(json!({
                "user": {
                    "id": id,
                    "name": name,
                    "email": email,
                    "role": role,
                }
            })),
        )
            .into_response(),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("unique") || msg.contains("duplicate") {
                (
                    StatusCode::CONFLICT,
                    Json(json!({ "error": "email_taken", "message": msg })),
                )
                    .into_response()
            } else {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": msg })),
                )
                    .into_response()
            }
        }
    }
}
