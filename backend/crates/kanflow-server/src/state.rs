use std::collections::HashMap;
use std::sync::Arc;
use std::sync::{Mutex, RwLock};
use std::time::{Duration, Instant};

use mongodb::Database;
use sqlx::PgPool;

use crate::auth::AuthConfig;
use crate::config::GithubAppConfig;
use crate::github::GithubClient;

#[derive(Clone)]
pub struct PendingGithubAuth {
    pub owner: String,
    pub repo: String,
    pub project_number: Option<i64>,
    pub owner_is_org: bool,
    created_at: Instant,
}

impl PendingGithubAuth {
    pub fn new(
        owner: String,
        repo: String,
        project_number: Option<i64>,
        owner_is_org: bool,
    ) -> Self {
        Self {
            owner,
            repo,
            project_number,
            owner_is_org,
            created_at: Instant::now(),
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    pub pg: Option<PgPool>,
    pub mongo: Option<Database>,
    /// Present when `KEYCLOAK_URL` + `KEYCLOAK_REALM` are configured.
    pub auth: Option<Arc<AuthConfig>>,
    /// Runtime GitHub client. It can be replaced when an authenticated user
    /// configures or disconnects the integration without restarting the server.
    github: Arc<RwLock<Option<GithubClient>>>,
    pub github_app: Option<Arc<GithubAppConfig>>,
    pending_github_auth: Arc<Mutex<HashMap<String, PendingGithubAuth>>>,
    /// Working directory for the in-app coding-agent terminal.
    pub terminal_cwd: String,
}

impl AppState {
    pub fn new(pg: Option<PgPool>, mongo: Option<Database>, auth: Option<Arc<AuthConfig>>) -> Self {
        Self {
            pg,
            mongo,
            auth,
            github: Arc::new(RwLock::new(None)),
            github_app: None,
            pending_github_auth: Arc::new(Mutex::new(HashMap::new())),
            terminal_cwd: ".".into(),
        }
    }

    pub fn with_terminal_cwd(mut self, cwd: String) -> Self {
        self.terminal_cwd = cwd;
        self
    }

    /// Attach a configured GitHub client (builder-style, used at startup).
    pub fn with_github(self, github: Option<GithubClient>) -> Self {
        self.set_github(github);
        self
    }

    pub fn github_client(&self) -> Option<GithubClient> {
        self.github.read().ok().and_then(|client| client.clone())
    }

    pub fn set_github(&self, github: Option<GithubClient>) {
        if let Ok(mut current) = self.github.write() {
            *current = github;
        }
    }

    pub fn with_github_app(mut self, config: Option<GithubAppConfig>) -> Self {
        self.github_app = config.map(Arc::new);
        self
    }

    pub fn store_pending_github_auth(&self, state: String, mut pending: PendingGithubAuth) {
        pending.created_at = Instant::now();
        if let Ok(mut entries) = self.pending_github_auth.lock() {
            entries.retain(|_, value| value.created_at.elapsed() < Duration::from_secs(600));
            entries.insert(state, pending);
        }
    }

    pub fn take_pending_github_auth(&self, state: &str) -> Option<PendingGithubAuth> {
        self.pending_github_auth
            .lock()
            .ok()
            .and_then(|mut entries| entries.remove(state))
            .filter(|pending| pending.created_at.elapsed() < Duration::from_secs(600))
    }
}
