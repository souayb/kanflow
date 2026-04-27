use axum::routing::{get, post};
use axum::Router;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::handlers;
use crate::mongo_store;
use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(handlers::health))
        .route("/api/v1/projects", get(handlers::list_projects).post(handlers::create_project))
        .route(
            "/api/v1/projects/{project_id}/chat",
            get(mongo_store::list_chat).post(mongo_store::append_chat),
        )
        .route("/api/v1/config", get(mongo_store::get_config).put(mongo_store::put_config))
        .route("/api/v1/blobs", post(mongo_store::post_blob))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

/// Test router with no databases wired (MISSION §11 — deterministic HTTP contract).
pub fn router_for_test() -> Router {
    router(AppState::new(None, None))
}
