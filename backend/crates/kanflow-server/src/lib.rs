//! Kanflow HTTP API (MISSION §8 evolution): PostgreSQL for structured entities, MongoDB for chat, config, and unstructured payloads.
//!
//! ## Tests (TDD)
//! - Unit: `config` — env parsing without live databases.
//! - HTTP: `router_for_test()` — `GET /health` and shape of JSON responses.

pub mod app;
pub mod auth;
pub mod config;
pub mod handlers;
pub mod mongo_store;
pub mod state;

pub use app::{router, router_for_test};
pub use state::AppState;
