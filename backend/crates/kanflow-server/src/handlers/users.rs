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
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({ "error": "postgres_disabled" })),
    )
        .into_response()
}

#[derive(FromRow)]
struct UserRow {
    id: Uuid,
    name: String,
    email: String,
    role: String,
    avatar_url: Option<String>,
    privacy_settings: serde_json::Value,
}

fn user_json(row: &UserRow) -> serde_json::Value {
    json!({
        "id": row.id,
        "name": row.name,
        "email": row.email,
        "role": row.role,
        "avatar": row.avatar_url,
        "privacy": row.privacy_settings,
    })
}

pub async fn list_users(
    State(state): State<AppState>,
    Extension(_auth): Extension<KanflowAuth>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };
    match sqlx::query_as::<_, UserRow>(
        "SELECT id, name, email, role, avatar_url, privacy_settings FROM users ORDER BY name ASC",
    )
    .fetch_all(pool)
    .await
    {
        Ok(rows) => {
            let users: Vec<_> = rows.into_iter().map(|r| user_json(&r)).collect();
            Json(json!({ "users": users })).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

fn authenticated_email(auth: &KanflowAuth) -> Option<&str> {
    auth.email
        .as_deref()
        .filter(|email| !email.trim().is_empty())
}

/// GET /api/v1/users/me — app profile linked to the authenticated Keycloak email.
pub async fn get_me(
    State(state): State<AppState>,
    Extension(auth): Extension<KanflowAuth>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };
    let Some(email) = authenticated_email(&auth) else {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({ "error": "authenticated_email_required" })),
        )
            .into_response();
    };

    match sqlx::query_as::<_, UserRow>(
        "SELECT id, name, email, role, avatar_url, privacy_settings
         FROM users WHERE LOWER(email) = LOWER($1)",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
    {
        Ok(Some(row)) => Json(json!({ "user": user_json(&row) })).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "profile_not_found" })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMeBody {
    pub name: Option<String>,
    pub avatar: Option<String>,
    pub privacy: Option<serde_json::Value>,
}

/// PATCH /api/v1/users/me — updates app-owned fields only. Password and MFA stay in Keycloak.
pub async fn update_me(
    State(state): State<AppState>,
    Extension(auth): Extension<KanflowAuth>,
    Json(body): Json<UpdateMeBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return pg_unavailable();
    };
    let Some(email) = authenticated_email(&auth) else {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({ "error": "authenticated_email_required" })),
        )
            .into_response();
    };
    let name = body.name.as_deref().map(str::trim);
    if matches!(name, Some("")) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "name_required" })),
        )
            .into_response();
    }
    let avatar = body.avatar.as_deref().map(str::trim);
    if avatar.is_some_and(|value| value.len() > 2048) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "avatar_url_too_long" })),
        )
            .into_response();
    }

    let privacy = body.privacy.unwrap_or_else(|| json!({}));
    let result = sqlx::query_as::<_, UserRow>(
        "UPDATE users SET
            name = COALESCE($1, name),
            avatar_url = CASE WHEN $2::text IS NULL THEN avatar_url ELSE NULLIF($2, '') END,
            privacy_settings = privacy_settings || $3::jsonb
         WHERE LOWER(email) = LOWER($4)
         RETURNING id, name, email, role, avatar_url, privacy_settings",
    )
    .bind(name)
    .bind(avatar)
    .bind(privacy)
    .bind(email)
    .fetch_optional(pool)
    .await;

    match result {
        Ok(Some(row)) => Json(json!({ "user": user_json(&row) })).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "profile_not_found" })),
        )
            .into_response(),
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
    let res = sqlx::query("INSERT INTO users (id, name, email, role) VALUES ($1, $2, $3, $4)")
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
