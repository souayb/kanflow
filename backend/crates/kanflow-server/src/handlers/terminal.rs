//! Warp-inspired coding-agent terminal: authenticated WebSocket to a local shell.
//!
//! This is a Kanflow-owned implementation. It follows Warp's block-command model
//! (prompt → command → streamed output) without copying Warp source.

use std::process::Stdio;

use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use futures_util::stream::{SplitSink, SplitStream};
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

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum ClientMessage {
    Input { block_id: String, command: String },
    Interrupt,
    Ignore,
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
    let cwd = state.terminal_cwd.clone();
    ws.on_upgrade(move |socket| handle_socket(socket, cwd))
        .into_response()
}

async fn handle_socket(socket: WebSocket, cwd: String) {
    let (mut sink, mut stream) = socket.split();
    let home = std::env::var("HOME").ok();
    let prompt = format!("{} % ", display_cwd(&cwd, home.as_deref()));
    if send_json(
        &mut sink,
        json!({ "type": "ready", "cwd": cwd, "prompt": prompt }),
    )
    .await
    .is_err()
    {
        return;
    }

    loop {
        let text = match next_text(&mut stream).await {
            SocketRead::Text(text) => text,
            SocketRead::Closed => break,
            SocketRead::Skip => continue,
        };
        match parse_client_message(&text) {
            ClientMessage::Input { block_id, command } => {
                if run_command(&mut sink, &mut stream, &cwd, &block_id, &command).await
                    == RunOutcome::Disconnected
                {
                    break;
                }
            }
            ClientMessage::Interrupt | ClientMessage::Ignore => {}
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
enum SocketRead {
    Text(String),
    Skip,
    Closed,
}

async fn next_text(stream: &mut SplitStream<WebSocket>) -> SocketRead {
    match stream.next().await {
        Some(Ok(Message::Text(text))) => SocketRead::Text(text.to_string()),
        Some(Ok(Message::Close(_))) | None => SocketRead::Closed,
        Some(Err(_)) => SocketRead::Closed,
        _ => SocketRead::Skip,
    }
}

#[derive(Debug, PartialEq, Eq)]
enum RunOutcome {
    Finished,
    Disconnected,
}

async fn run_command(
    sink: &mut SplitSink<WebSocket, Message>,
    stream: &mut SplitStream<WebSocket>,
    cwd: &str,
    block_id: &str,
    command: &str,
) -> RunOutcome {
    if send_json(
        sink,
        json!({ "type": "started", "blockId": block_id, "command": command }),
    )
    .await
    .is_err()
    {
        return RunOutcome::Disconnected;
    }

    let mut child = match Command::new("sh")
        .arg("-lc")
        .arg(command)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            let _ = send_json(
                sink,
                json!({ "type": "output", "blockId": block_id, "data": format!("{error}\n") }),
            )
            .await;
            let _ = send_json(
                sink,
                json!({ "type": "exit", "blockId": block_id, "code": 1 }),
            )
            .await;
            return RunOutcome::Finished;
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

    let mut interrupted = false;
    loop {
        tokio::select! {
            chunk = rx.recv() => {
                match chunk {
                    Some(data) => {
                        if send_json(
                            sink,
                            json!({ "type": "output", "blockId": block_id, "data": data }),
                        )
                        .await
                        .is_err()
                        {
                            let _ = child.start_kill();
                            return RunOutcome::Disconnected;
                        }
                    }
                    None => break,
                }
            }
            incoming = stream.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => match parse_client_message(&text) {
                        ClientMessage::Interrupt => {
                            interrupted = true;
                            let _ = child.start_kill();
                            break;
                        }
                        ClientMessage::Input { .. } | ClientMessage::Ignore => {}
                    },
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => {
                        let _ = child.start_kill();
                        return RunOutcome::Disconnected;
                    }
                    _ => {}
                }
            }
        }
    }

    let code = if interrupted {
        let _ = child.wait().await;
        130
    } else {
        child
            .wait()
            .await
            .ok()
            .and_then(|status| status.code())
            .unwrap_or(1)
    };

    if send_json(
        sink,
        json!({ "type": "exit", "blockId": block_id, "code": code }),
    )
    .await
    .is_err()
    {
        return RunOutcome::Disconnected;
    }
    RunOutcome::Finished
}

async fn send_json(
    sink: &mut SplitSink<WebSocket, Message>,
    value: serde_json::Value,
) -> Result<(), axum::Error> {
    sink.send(Message::Text(value.to_string().into())).await
}

pub(crate) fn parse_client_message(text: &str) -> ClientMessage {
    let Ok(payload) = serde_json::from_str::<serde_json::Value>(text) else {
        return ClientMessage::Ignore;
    };
    match payload.get("type").and_then(|value| value.as_str()) {
        Some("input") => {
            let command = payload
                .get("data")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .trim();
            if command.is_empty() {
                return ClientMessage::Ignore;
            }
            ClientMessage::Input {
                block_id: payload
                    .get("blockId")
                    .and_then(|value| value.as_str())
                    .unwrap_or("block")
                    .to_string(),
                command: command.to_string(),
            }
        }
        Some("interrupt") => ClientMessage::Interrupt,
        _ => ClientMessage::Ignore,
    }
}

pub(crate) fn display_cwd(cwd: &str, home: Option<&str>) -> String {
    if let Some(home) = home.filter(|value| !value.is_empty()) {
        if let Some(rest) = cwd.strip_prefix(home) {
            if rest.is_empty() || rest.starts_with('/') {
                return format!("~{rest}");
            }
        }
    }
    cwd.to_string()
}

#[cfg(test)]
mod tests {
    use super::{display_cwd, parse_client_message, ClientMessage};

    #[test]
    fn display_cwd_replaces_home_prefix() {
        assert_eq!(
            display_cwd("/Users/souayb/kanban", Some("/Users/souayb")),
            "~/kanban"
        );
        assert_eq!(display_cwd("/Users/souayb", Some("/Users/souayb")), "~");
        assert_eq!(
            display_cwd("/Users/souaybar/kanban", Some("/Users/souayb")),
            "/Users/souaybar/kanban"
        );
        assert_eq!(display_cwd("/workspace", None), "/workspace");
    }

    #[test]
    fn parse_input_trims_and_requires_command() {
        assert_eq!(
            parse_client_message(r#"{"type":"input","blockId":"b1","data":"  ls -la  "}"#),
            ClientMessage::Input {
                block_id: "b1".into(),
                command: "ls -la".into(),
            }
        );
        assert_eq!(
            parse_client_message(r#"{"type":"input","data":"   "}"#),
            ClientMessage::Ignore
        );
        assert_eq!(
            parse_client_message(r#"{"type":"interrupt"}"#),
            ClientMessage::Interrupt
        );
        assert_eq!(parse_client_message("not-json"), ClientMessage::Ignore);
        assert_eq!(
            parse_client_message(r#"{"type":"unknown"}"#),
            ClientMessage::Ignore
        );
    }
}
