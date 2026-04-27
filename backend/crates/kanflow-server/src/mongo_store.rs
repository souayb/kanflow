//! MongoDB: chat messages, `app_config` document, unstructured blobs (MISSION §5.11, §8).

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use futures_util::TryStreamExt;
use mongodb::bson::{doc, Document};
use mongodb::options::FindOptions;
use serde::Serialize;
use serde_json::json;

use crate::state::AppState;

const COLL_CHAT: &str = "chat_messages";
const COLL_CONFIG: &str = "app_config";
const COLL_BLOBS: &str = "unstructured_blobs";

#[derive(Serialize)]
pub struct ChatMessageView {
    pub id: String,
    pub project_id: String,
    pub user_id: String,
    pub user_name: String,
    pub content: String,
    pub created_at: String,
}

fn json_err(status: StatusCode, msg: impl Into<String>) -> Response {
    (status, axum::Json(json!({ "error": msg.into() }))).into_response()
}

pub async fn list_chat(
    axum::extract::State(state): axum::extract::State<AppState>,
    axum::extract::Path(project_id): axum::extract::Path<String>,
) -> Response {
    let Some(db) = &state.mongo else {
        return json_err(StatusCode::SERVICE_UNAVAILABLE, "mongo_disabled");
    };
    let coll = db.collection::<Document>(COLL_CHAT);
    let filter = doc! { "project_id": &project_id };
    let opts = FindOptions::builder().sort(doc! { "created_at": 1 }).build();
    let mut cur = match coll.find(filter).with_options(opts).await {
        Ok(c) => c,
        Err(e) => return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };
    let mut out: Vec<ChatMessageView> = Vec::new();
    while let Ok(Some(doc)) = cur.try_next().await {
        let id = match doc.get("_id") {
            Some(mongodb::bson::Bson::String(s)) => s.clone(),
            Some(mongodb::bson::Bson::ObjectId(o)) => o.to_hex(),
            _ => String::new(),
        };
        let created_at = doc
            .get_datetime("created_at")
            .ok()
            .map(|dt| {
                chrono::DateTime::from_timestamp_millis(dt.timestamp_millis())
                    .map(|c| c.to_rfc3339())
                    .unwrap_or_else(|| dt.to_string())
            })
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
        out.push(ChatMessageView {
            id,
            project_id: doc.get_str("project_id").unwrap_or("").to_string(),
            user_id: doc.get_str("user_id").unwrap_or("").to_string(),
            user_name: doc.get_str("user_name").unwrap_or("").to_string(),
            content: doc.get_str("content").unwrap_or("").to_string(),
            created_at,
        });
    }
    axum::Json(json!({ "messages": out })).into_response()
}

pub async fn append_chat(
    axum::extract::State(state): axum::extract::State<AppState>,
    axum::extract::Path(project_id): axum::extract::Path<String>,
    axum::Json(body): axum::Json<serde_json::Value>,
) -> Response {
    let Some(db) = &state.mongo else {
        return json_err(StatusCode::SERVICE_UNAVAILABLE, "mongo_disabled");
    };
    let user_id = body.get("user_id").and_then(|v| v.as_str()).unwrap_or("anonymous");
    let user_name = body.get("user_name").and_then(|v| v.as_str()).unwrap_or("Anonymous");
    let content = body.get("content").and_then(|v| v.as_str()).unwrap_or("");
    if content.is_empty() {
        return json_err(StatusCode::BAD_REQUEST, "content_required");
    }
    let coll = db.collection::<Document>(COLL_CHAT);
    let id = uuid::Uuid::new_v4().to_string();
    let now = mongodb::bson::DateTime::now();
    let doc = doc! {
        "_id": &id,
        "project_id": &project_id,
        "user_id": user_id,
        "user_name": user_name,
        "content": content,
        "created_at": now,
    };
    if let Err(e) = coll.insert_one(doc).await {
        return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
    }
    axum::Json(json!({ "id": id, "status": "created" })).into_response()
}

/// Returns `{ "config": <json payload> }` from document `{ _id, payload }`.
pub async fn get_config(axum::extract::State(state): axum::extract::State<AppState>) -> Response {
    let Some(db) = &state.mongo else {
        return json_err(StatusCode::SERVICE_UNAVAILABLE, "mongo_disabled");
    };
    let coll = db.collection::<Document>(COLL_CONFIG);
    match coll.find_one(doc! { "_id": "default" }).await {
        Ok(Some(d)) => {
            let payload = d.get("payload").cloned().unwrap_or(mongodb::bson::Bson::Null);
            let v: serde_json::Value = mongodb::bson::from_bson(payload).unwrap_or(json!({}));
            axum::Json(json!({ "config": v })).into_response()
        }
        Ok(None) => axum::Json(json!({ "config": serde_json::Value::Null })).into_response(),
        Err(e) => json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    }
}

/// Upserts `{ _id: "default", payload: <body> }` — arbitrary JSON for client / feature flags.
pub async fn put_config(
    axum::extract::State(state): axum::extract::State<AppState>,
    axum::Json(body): axum::Json<serde_json::Value>,
) -> Response {
    let Some(db) = &state.mongo else {
        return json_err(StatusCode::SERVICE_UNAVAILABLE, "mongo_disabled");
    };
    let coll = db.collection::<Document>(COLL_CONFIG);
    let payload = match mongodb::bson::to_bson(&body) {
        Ok(b) => b,
        Err(e) => return json_err(StatusCode::BAD_REQUEST, e.to_string()),
    };
    let doc = doc! { "_id": "default", "payload": payload, "updated_at": mongodb::bson::DateTime::now() };
    let opts = mongodb::options::ReplaceOptions::builder().upsert(true).build();
    if let Err(e) = coll.replace_one(doc! { "_id": "default" }, doc).with_options(opts).await {
        return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
    }
    axum::Json(json!({ "status": "saved" })).into_response()
}

pub async fn post_blob(
    axum::extract::State(state): axum::extract::State<AppState>,
    axum::Json(body): axum::Json<serde_json::Value>,
) -> Response {
    let Some(db) = &state.mongo else {
        return json_err(StatusCode::SERVICE_UNAVAILABLE, "mongo_disabled");
    };
    let key = body
        .get("key")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("");
    if key.is_empty() {
        return json_err(StatusCode::BAD_REQUEST, "key_required");
    }
    let payload = body.get("payload").cloned().unwrap_or(json!({}));
    let bson_payload = match mongodb::bson::to_bson(&payload) {
        Ok(b) => b,
        Err(e) => return json_err(StatusCode::BAD_REQUEST, e.to_string()),
    };
    let coll = db.collection::<Document>(COLL_BLOBS);
    let doc = doc! {
        "_id": key,
        "payload": bson_payload,
        "updated_at": mongodb::bson::DateTime::now(),
    };
    let opts = mongodb::options::ReplaceOptions::builder().upsert(true).build();
    if let Err(e) = coll.replace_one(doc! { "_id": key }, doc).with_options(opts).await {
        return json_err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string());
    }
    axum::Json(json!({ "status": "stored", "key": key })).into_response()
}
