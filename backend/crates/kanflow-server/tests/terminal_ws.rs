//! Live WebSocket protocol tests for the coding-agent terminal.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use kanflow_server::router;
use kanflow_server::state::AppState;
use serde_json::{json, Value};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

type TerminalSocket = WebSocketStream<MaybeTlsStream<TcpStream>>;

async fn spawn_terminal(cwd: &str) -> String {
    let state = AppState::new(None, None, None).with_terminal_cwd(cwd.to_string());
    let app = router(state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    format!("ws://{addr}/api/v1/terminal/ws")
}

async fn connect(url: &str) -> TerminalSocket {
    let (ws, _) = tokio_tungstenite::connect_async(url)
        .await
        .expect("connect websocket");
    ws
}

async fn recv_json(ws: &mut TerminalSocket) -> Value {
    let message = tokio::time::timeout(Duration::from_secs(5), ws.next())
        .await
        .expect("timed out waiting for terminal event")
        .expect("socket closed")
        .expect("websocket error");
    match message {
        Message::Text(text) => serde_json::from_str(text.as_str()).expect("json event"),
        other => panic!("unexpected websocket frame: {other:?}"),
    }
}

async fn collect_until_exit(ws: &mut TerminalSocket) -> (Vec<Value>, Value) {
    let mut outputs = Vec::new();
    loop {
        let event = recv_json(ws).await;
        match event.get("type").and_then(Value::as_str) {
            Some("output") => outputs.push(event),
            Some("exit") => return (outputs, event),
            other => panic!("unexpected event while waiting for exit: {other:?} {event}"),
        }
    }
}

#[tokio::test]
async fn ready_event_uses_configured_cwd() {
    let cwd = std::env::temp_dir().join(format!("kanflow-term-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&cwd).unwrap();
    let url = spawn_terminal(cwd.to_str().unwrap()).await;
    let mut ws = connect(&url).await;
    let ready = recv_json(&mut ws).await;
    assert_eq!(ready["type"], "ready");
    assert_eq!(ready["cwd"], cwd.to_str().unwrap());
    assert!(ready["prompt"].as_str().unwrap().ends_with(" % "));
}

#[tokio::test]
async fn input_streams_stdout_and_exit_zero() {
    let cwd = std::env::temp_dir().join(format!("kanflow-term-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&cwd).unwrap();
    std::fs::write(cwd.join("marker.txt"), "ok").unwrap();
    let url = spawn_terminal(cwd.to_str().unwrap()).await;
    let mut ws = connect(&url).await;
    assert_eq!(recv_json(&mut ws).await["type"], "ready");

    ws.send(Message::Text(
        json!({ "type": "input", "blockId": "b1", "data": "cat marker.txt" })
            .to_string()
            .into(),
    ))
    .await
    .unwrap();

    let started = recv_json(&mut ws).await;
    assert_eq!(started["type"], "started");
    assert_eq!(started["blockId"], "b1");
    assert_eq!(started["command"], "cat marker.txt");

    let (outputs, exit) = collect_until_exit(&mut ws).await;
    let body: String = outputs
        .iter()
        .filter_map(|event| event["data"].as_str())
        .collect();
    assert!(body.contains("ok"), "stdout was {body:?}");
    assert_eq!(exit["blockId"], "b1");
    assert_eq!(exit["code"], 0);
}

#[tokio::test]
async fn failing_command_reports_nonzero_exit() {
    let url = spawn_terminal(".").await;
    let mut ws = connect(&url).await;
    assert_eq!(recv_json(&mut ws).await["type"], "ready");

    ws.send(Message::Text(
        json!({ "type": "input", "blockId": "fail", "data": "exit 7" })
            .to_string()
            .into(),
    ))
    .await
    .unwrap();

    let started = recv_json(&mut ws).await;
    assert_eq!(started["type"], "started");
    let (_, exit) = collect_until_exit(&mut ws).await;
    assert_eq!(exit["blockId"], "fail");
    assert_eq!(exit["code"], 7);
}

#[tokio::test]
async fn interrupt_kills_running_command() {
    let url = spawn_terminal(".").await;
    let mut ws = connect(&url).await;
    assert_eq!(recv_json(&mut ws).await["type"], "ready");

    ws.send(Message::Text(
        json!({ "type": "input", "blockId": "sleep", "data": "sleep 20" })
            .to_string()
            .into(),
    ))
    .await
    .unwrap();
    assert_eq!(recv_json(&mut ws).await["type"], "started");

    ws.send(Message::Text(
        json!({ "type": "interrupt" }).to_string().into(),
    ))
    .await
    .unwrap();

    let exit = tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            let event = recv_json(&mut ws).await;
            if event["type"] == "exit" {
                return event;
            }
        }
    })
    .await
    .expect("interrupt should finish quickly");
    assert_eq!(exit["blockId"], "sleep");
    assert_eq!(exit["code"], 130);
}

#[tokio::test]
async fn empty_input_is_ignored() {
    let url = spawn_terminal(".").await;
    let mut ws = connect(&url).await;
    assert_eq!(recv_json(&mut ws).await["type"], "ready");

    ws.send(Message::Text(
        json!({ "type": "input", "blockId": "empty", "data": "   " })
            .to_string()
            .into(),
    ))
    .await
    .unwrap();
    ws.send(Message::Text(
        json!({ "type": "input", "blockId": "real", "data": "printf hi" })
            .to_string()
            .into(),
    ))
    .await
    .unwrap();

    let started = recv_json(&mut ws).await;
    assert_eq!(started["type"], "started");
    assert_eq!(started["blockId"], "real");
    let (_, exit) = collect_until_exit(&mut ws).await;
    assert_eq!(exit["code"], 0);
}
