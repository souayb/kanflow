use std::sync::Arc;

use mongodb::Database;
use sqlx::PgPool;

use crate::auth::AuthConfig;

#[derive(Clone)]
pub struct AppState {
    pub pg: Option<PgPool>,
    pub mongo: Option<Database>,
    /// Present when `KEYCLOAK_URL` + `KEYCLOAK_REALM` are configured.
    pub auth: Option<Arc<AuthConfig>>,
}

impl AppState {
    pub fn new(pg: Option<PgPool>, mongo: Option<Database>, auth: Option<Arc<AuthConfig>>) -> Self {
        Self { pg, mongo, auth }
    }
}
