//! Read-only status of instance-wide third-party integrations.

use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;

use crate::state::AppState;

// ── GET /api/v1/integrations/github ──────────────────────────────────────────

/// Whether `GITHUB_TOKEN`/`GITHUB_OWNER`/`GITHUB_REPO` are configured for this
/// instance, and (never the token) the repo it's wired to — so the frontend can
/// gate GitHub-only UI (issue sync status, branch creation) on real connectivity
/// instead of guessing from its own local settings.
pub async fn github_status(State(state): State<AppState>) -> impl IntoResponse {
    match &state.github {
        Some(gh) => Json(json!({
            "connected": true,
            "owner": gh.owner(),
            "repo": gh.repo(),
        })),
        None => Json(json!({ "connected": false })),
    }
}
