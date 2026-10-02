//! Warp-inspired coding-agent terminal: authenticated WebSocket to a local PTY.
//!
//! This is a Kanflow-owned implementation. It follows Warp's block-command model
//! (prompt → command → streamed output) without copying Warp source.

use std::env;
use std::process::Stdio;

use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

use crate::auth::validate_bearer;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct TerminalQuery {
    pub token: Option<String>,
}

pub async fn terminal_ws(
    State(state): State<AppState>,
    Query(query): Query<TerminalQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    if let Some(auth) = &state.auth {
        let Some(token) = query.token.as_deref() else {
            return (StatusCode::UNAUTHORIZED, "missing token").into_response();
        };
        if validate_bearer(token, auth).await.is_err() {
            return (StatusCode::UNAUTHORIZED, "invalid or expired token").into_response();
        }
    }
    ws.on_upgrade(handle_socket).into_response()
}

async fn handle_socket(socket: WebSocket) {
    let cwd = env::var("KANFLOW_TERMINAL_CWD").unwrap_or_else(|_| {
        env::current_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| ".".into())
    });
    let (mut sink, mut stream) = socket.split();

    let prompt = format!("{} % ", display_cwd(&cwd));
    let _ = sink
        .send(Message::Text(
            json!({ "type": "ready", "cwd": cwd, "prompt": prompt })
                .to_string()
                .into(),
        ))
        .await;

    while let Some(Ok(message)) = stream.next().await {
        let text = match message {
            Message::Text(text) => text.to_string(),
            Message::Close(_) => break,
            _ => continue,
        };
        let Ok(payload) = serde_json::from_str::<serde_json::Value>(&text) else {
            continue;
        };
        match payload.get("type").and_then(|v| v.as_str()) {
            Some("input") => {
                let command = payload
                    .get("data")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim();
                if command.is_empty() {
                    continue;
                }
                let block_id = payload
                    .get("blockId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("block")
                    .to_string();
                run_command(&mut sink, &cwd, &block_id, command).await;
            }
            Some("interrupt") => {
                let _ = sink
                    .send(Message::Text(
                        json!({ "type": "exit", "code": 130, "message": "interrupted" })
                            .to_string()
                            .into(),
                    ))
                    .await;
            }
            _ => {}
        }
    }
}

async fn run_command(
    sink: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    cwd: &str,
    block_id: &str,
    command: &str,
) {
    let _ = sink
        .send(Message::Text(
            json!({ "type": "started", "blockId": block_id, "command": command })
                .to_string()
                .into(),
        ))
        .await;

    let mut child = match Command::new("sh")
        .arg("-lc")
        .arg(command)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            let _ = sink
                .send(Message::Text(
                    json!({ "type": "output", "blockId": block_id, "data": format!("{error}\n") })
                        .to_string()
                        .into(),
                ))
                .await;
            let _ = sink
                .send(Message::Text(
                    json!({ "type": "exit", "blockId": block_id, "code": 1 })
                        .to_string()
                        .into(),
                ))
                .await;
            return;
        }
    };

    let mut stdout = child.stdout.take();
    let mut stderr = child.stderr.take();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    if let Some(mut out) = stdout.take() {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut buf = [0u8; 2048];
            while let Ok(n) = out.read(&mut buf).await {
                if n == 0 {
                    break;
                }
                let _ = tx.send(String::from_utf8_lossy(&buf[..n]).into_owned());
            }
        });
    }
    if let Some(mut err) = stderr.take() {
        let tx = tx.clone();
        tokio::spawn(async move {
            let mut buf = [0u8; 2048];
            while let Ok(n) = err.read(&mut buf).await {
                if n == 0 {
                    break;
                }
                let _ = tx.send(String::from_utf8_lossy(&buf[..n]).into_owned());
            }
        });
    }
    drop(tx);

    while let Some(chunk) = rx.recv().await {
        if sink
            .send(Message::Text(
                json!({ "type": "output", "blockId": block_id, "data": chunk })
                    .to_string()
                    .into(),
            ))
            .await
            .is_err()
        {
            let _ = child.kill().await;
            break;
        }
    }

    let code = child
        .wait()
        .await
        .ok()
        .and_then(|status| status.code())
        .unwrap_or(1);
    let _ = sink
        .send(Message::Text(
            json!({ "type": "exit", "blockId": block_id, "code": code })
                .to_string()
                .into(),
        ))
        .await;
}

fn display_cwd(cwd: &str) -> String {
    if let Ok(home) = env::var("HOME") {
        if let Some(rest) = cwd.strip_prefix(&home) {
            return format!("~{rest}");
        }
    }
    cwd.to_string()
}
