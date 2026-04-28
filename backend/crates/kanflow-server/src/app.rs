use axum::middleware;
use axum::routing::{get, patch, post};
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::auth::require_auth;
use crate::handlers;
use crate::mongo_store;
use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    // Protected API routes — wrapped with the auth middleware.
    // When `state.auth` is None (no KC), middleware still attaches `KanflowAuth::dev_open()` for handlers.
    let api = Router::new()
        // ── Users (directory + admin create) ─────────────────────────────
        .route("/api/v1/users", get(handlers::list_users).post(handlers::create_user))

        // ── Projects ──────────────────────────────────────────────────────
        .route("/api/v1/projects",     get(handlers::list_projects).post(handlers::create_project))
        .route("/api/v1/projects/{project_id}",
            patch(handlers::update_project).delete(handlers::delete_project))

        // ── Columns ───────────────────────────────────────────────────────
        .route("/api/v1/projects/{project_id}/columns",
            get(handlers::list_columns).post(handlers::create_column))
        .route("/api/v1/projects/{project_id}/columns/{column_id}",
            patch(handlers::update_column).delete(handlers::delete_column))

        // ── Tasks ─────────────────────────────────────────────────────────
        .route("/api/v1/projects/{project_id}/tasks",
            get(handlers::list_tasks).post(handlers::create_task))
        .route("/api/v1/tasks/{task_id}",
            patch(handlers::update_task).delete(handlers::delete_task))
        .route("/api/v1/tasks/{task_id}/comments", post(handlers::create_comment))

        // ── Chat (MongoDB) ────────────────────────────────────────────────
        .route("/api/v1/projects/{project_id}/chat",
            get(mongo_store::list_chat).post(mongo_store::append_chat))

        // ── Config / Blobs (MongoDB) ──────────────────────────────────────
        .route("/api/v1/config", get(mongo_store::get_config).put(mongo_store::put_config))
        .route("/api/v1/blobs",  post(mongo_store::post_blob))

        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    Router::new()
        .route("/health", get(handlers::health))
        .merge(api)
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Test router with no databases and no auth (MISSION §14 — deterministic contract tests).
pub fn router_for_test() -> Router {
    router(AppState::new(None, None, None))
}
