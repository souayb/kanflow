use axum::Json;
use serde_json::json;

/// Liveness probe — no database required.
pub async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "service": "kanflow",
        "status": "ok",
    }))
}
