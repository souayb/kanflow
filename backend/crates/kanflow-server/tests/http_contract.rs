//! HTTP contract tests (TDD): written against `router_for_test()` so CI does not require Docker.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use kanflow_server::router_for_test;
use tower::ServiceExt;

#[tokio::test]
async fn health_returns_ok_and_service_name() {
    let app = router_for_test();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("response");

    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(v["service"], "kanflow");
    assert_eq!(v["status"], "ok");
}

#[tokio::test]
async fn projects_list_without_postgres_is_503() {
    let app = router_for_test();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/projects")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("response");
    assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
}
