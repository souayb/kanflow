use std::sync::Arc;

use mongodb::Database;
use sqlx::PgPool;

use crate::auth::AuthConfig;
use crate::github::GithubClient;

#[derive(Clone)]
pub struct AppState {
    pub pg: Option<PgPool>,
    pub mongo: Option<Database>,
    /// Present when `KEYCLOAK_URL` + `KEYCLOAK_REALM` are configured.
    pub auth: Option<Arc<AuthConfig>>,
    /// Present when `GITHUB_TOKEN` + `GITHUB_OWNER` + `GITHUB_REPO` are configured.
    pub github: Option<GithubClient>,
}

impl AppState {
    pub fn new(pg: Option<PgPool>, mongo: Option<Database>, auth: Option<Arc<AuthConfig>>) -> Self {
        Self { pg, mongo, auth, github: None }
    }

    /// Attach a configured GitHub client (builder-style, used at startup).
    pub fn with_github(mut self, github: Option<GithubClient>) -> Self {
        self.github = github;
        self
    }
}
