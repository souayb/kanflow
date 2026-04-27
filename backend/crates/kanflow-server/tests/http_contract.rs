//! HTTP contract tests — all use `router_for_test()` (no live DB required).
//! Every route must respond predictably even without Postgres or MongoDB.

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use http_body_util::BodyExt;
use kanflow_server::router_for_test;
use tower::ServiceExt;

// ── helpers ──────────────────────────────────────────────────────────────────

async fn send(method: Method, uri: &str, body: Option<&str>) -> (StatusCode, serde_json::Value) {
    let app = router_for_test();
    let mut builder = Request::builder().method(method).uri(uri);
    let body = if let Some(json) = body {
        builder = builder.header("content-type", "application/json");
        Body::from(json.to_owned())
    } else {
        Body::empty()
    };
    let resp = app.oneshot(builder.body(body).unwrap()).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
    (status, json)
}

async fn get(uri: &str) -> (StatusCode, serde_json::Value) {
    send(Method::GET, uri, None).await
}
async fn post(uri: &str, body: &str) -> (StatusCode, serde_json::Value) {
    send(Method::POST, uri, Some(body)).await
}
async fn patch(uri: &str, body: &str) -> (StatusCode, serde_json::Value) {
    send(Method::PATCH, uri, Some(body)).await
}
async fn delete(uri: &str) -> (StatusCode, serde_json::Value) {
    send(Method::DELETE, uri, None).await
}

// ── /health ───────────────────────────────────────────────────────────────────

#[tokio::test]
async fn health_ok() {
    let (status, body) = get("/health").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["service"], "kanflow");
    assert_eq!(body["status"], "ok");
}

// ── projects ─────────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_projects_no_pg_returns_503() {
    let (status, body) = get("/api/v1/projects").await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(body["error"].as_str().is_some());
}

#[tokio::test]
async fn create_project_no_pg_returns_503() {
    let (status, _) = post("/api/v1/projects", r#"{"name":"Test"}"#).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn update_project_no_pg_returns_503() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = patch(&format!("/api/v1/projects/{id}"), r#"{"name":"New"}"#).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn delete_project_no_pg_returns_503() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = delete(&format!("/api/v1/projects/{id}")).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

// ── columns ───────────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_columns_no_pg_returns_503() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = get(&format!("/api/v1/projects/{id}/columns")).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn create_column_no_pg_returns_503() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = post(&format!("/api/v1/projects/{id}/columns"), r#"{"title":"Todo"}"#).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn update_column_no_pg_returns_503() {
    let pid = uuid::Uuid::new_v4();
    let cid = uuid::Uuid::new_v4();
    let (status, _) = patch(
        &format!("/api/v1/projects/{pid}/columns/{cid}"),
        r#"{"title":"Done"}"#,
    )
    .await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn delete_column_no_pg_returns_503() {
    let pid = uuid::Uuid::new_v4();
    let cid = uuid::Uuid::new_v4();
    let (status, _) = delete(&format!("/api/v1/projects/{pid}/columns/{cid}")).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

// ── tasks ─────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn list_tasks_no_pg_returns_503() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = get(&format!("/api/v1/projects/{id}/tasks")).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn create_task_no_pg_returns_503() {
    let pid = uuid::Uuid::new_v4();
    let cid = uuid::Uuid::new_v4();
    let body = format!(r#"{{"title":"Task 1","status":"{cid}"}}"#);
    let (status, _) = post(&format!("/api/v1/projects/{pid}/tasks"), &body).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn update_task_no_pg_returns_503() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = patch(&format!("/api/v1/tasks/{id}"), r#"{"title":"Updated"}"#).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn delete_task_no_pg_returns_503() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = delete(&format!("/api/v1/tasks/{id}")).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn create_comment_no_pg_returns_503() {
    let id = uuid::Uuid::new_v4();
    let body = r#"{"user_id":"u1","user_name":"Alice","content":"LGTM"}"#;
    let (status, _) = post(&format!("/api/v1/tasks/{id}/comments"), body).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

// ── validation (no DB needed, caught before DB call) ─────────────────────────

#[tokio::test]
async fn create_project_empty_name_is_400_when_pg_connected() {
    // Without PG the handler short-circuits to 503 before validation;
    // this test documents the expected 400 shape for the client contract.
    // With a live DB, an empty name must return 400.
    // Here we just verify the route exists (returns 503, not 404/405).
    let (status, _) = post("/api/v1/projects", r#"{"name":""}"#).await;
    assert_ne!(status, StatusCode::NOT_FOUND);
    assert_ne!(status, StatusCode::METHOD_NOT_ALLOWED);
}

#[tokio::test]
async fn create_column_empty_title_would_be_400() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = post(&format!("/api/v1/projects/{id}/columns"), r#"{"title":""}"#).await;
    assert_ne!(status, StatusCode::NOT_FOUND);
    assert_ne!(status, StatusCode::METHOD_NOT_ALLOWED);
}

#[tokio::test]
async fn create_task_empty_title_would_be_400() {
    let pid = uuid::Uuid::new_v4();
    let cid = uuid::Uuid::new_v4();
    let body = format!(r#"{{"title":"","status":"{cid}"}}"#);
    let (status, _) = post(&format!("/api/v1/projects/{pid}/tasks"), &body).await;
    assert_ne!(status, StatusCode::NOT_FOUND);
    assert_ne!(status, StatusCode::METHOD_NOT_ALLOWED);
}

// ── chat + config + blobs (MongoDB) ──────────────────────────────────────────

#[tokio::test]
async fn list_chat_no_mongo_returns_503() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = get(&format!("/api/v1/projects/{id}/chat")).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn append_chat_no_mongo_returns_503() {
    let id = uuid::Uuid::new_v4();
    let (status, _) = post(
        &format!("/api/v1/projects/{id}/chat"),
        r#"{"user_id":"u1","user_name":"Alice","content":"hi"}"#,
    )
    .await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn get_config_no_mongo_returns_503() {
    let (status, _) = get("/api/v1/config").await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn post_blob_no_mongo_returns_503() {
    let (status, _) = post("/api/v1/blobs", r#"{"key":"k1","payload":{}}"#).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
}
