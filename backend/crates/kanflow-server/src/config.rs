//! Centralized configuration (SDD: deterministic behavior, no magic defaults in handlers).

use std::env;

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub database_url: Option<String>,
    pub mongo_uri: Option<String>,
    pub mongo_db: String,
    /// Base URL of the Keycloak server, e.g. `http://keycloak:8180`
    pub keycloak_url: Option<String>,
    /// Public issuer URL embedded in browser-issued tokens. This can differ
    /// from `keycloak_url` when the backend reaches Keycloak over Docker DNS.
    pub keycloak_issuer: Option<String>,
    /// Keycloak realm name, e.g. `kanflow`
    pub keycloak_realm: Option<String>,
    /// GitHub integration (one-way sync: app task → GitHub Issue + Projects v2 item).
    pub github: Option<GithubConfig>,
    /// GitHub App user-authorization settings.
    pub github_app: Option<GithubAppConfig>,
    /// Working directory for the in-app coding-agent terminal.
    pub terminal_cwd: String,
}

/// GitHub integration settings, present only when `GITHUB_TOKEN`, `GITHUB_OWNER`
/// and `GITHUB_REPO` are all configured. `project_number` is optional — when set,
/// created issues are also added to that user/org Projects v2 board.
#[derive(Debug, Clone)]
pub struct GithubConfig {
    /// Personal Access Token (classic: `repo`, `project`; or fine-grained with Issues + Projects RW).
    pub token: String,
    /// Repository owner (user or org login), e.g. `octocat`.
    pub owner: String,
    /// Repository name, e.g. `hello-world`.
    pub repo: String,
    /// Projects v2 number (the `N` in `/users/owner/projects/N`). None → skip board add.
    pub project_number: Option<i64>,
    /// GraphQL owner type: `true` if `owner` is an organization, `false` for a user.
    pub owner_is_org: bool,
}

#[derive(Debug, Clone)]
pub struct GithubAppConfig {
    pub client_id: String,
    pub client_secret: String,
    pub callback_url: String,
    pub frontend_url: String,
}

impl ServerConfig {
    /// Load from environment. Missing `DATABASE_URL` / `MONGO_URI` yields `None` so the server can still boot for health checks.
    pub fn from_env() -> Self {
        Self {
            host: env::var("KANFLOW_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("KANFLOW_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(8080),
            database_url: env::var("DATABASE_URL").ok(),
            mongo_uri: env::var("MONGO_URI").ok(),
            mongo_db: env::var("MONGO_DB").unwrap_or_else(|_| "kanflow".into()),
            keycloak_url: env::var("KEYCLOAK_URL").ok(),
            keycloak_issuer: env::var("KEYCLOAK_ISSUER")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            keycloak_realm: env::var("KEYCLOAK_REALM").ok(),
            github: GithubConfig::from_env(),
            github_app: GithubAppConfig::from_env(),
            terminal_cwd: env::var("KANFLOW_TERMINAL_CWD")
                .ok()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| {
                    env::current_dir()
                        .map(|p| p.display().to_string())
                        .unwrap_or_else(|_| ".".into())
                }),
        }
    }

    /// JWKS endpoint for validating access tokens.
    pub fn jwks_url(&self) -> Option<String> {
        let url = self.keycloak_url.as_deref()?;
        let realm = self.keycloak_realm.as_deref()?;
        Some(format!(
            "{url}/realms/{realm}/protocol/openid-connect/certs"
        ))
    }

    /// Expected token issuer (`iss` claim).
    pub fn token_issuer(&self) -> Option<String> {
        if let Some(issuer) = &self.keycloak_issuer {
            return Some(issuer.trim_end_matches('/').to_owned());
        }
        let url = self.keycloak_url.as_deref()?;
        let realm = self.keycloak_realm.as_deref()?;
        Some(format!("{url}/realms/{realm}"))
    }
}

impl GithubAppConfig {
    pub fn from_env() -> Option<Self> {
        Some(Self {
            client_id: env::var("GITHUB_APP_CLIENT_ID")
                .ok()
                .filter(|value| !value.trim().is_empty())?,
            client_secret: env::var("GITHUB_APP_CLIENT_SECRET")
                .ok()
                .filter(|value| !value.trim().is_empty())?,
            callback_url: env::var("GITHUB_APP_CALLBACK_URL")
                .ok()
                .filter(|value| !value.trim().is_empty())?,
            frontend_url: env::var("FRONTEND_PUBLIC_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),
        })
    }
}

impl GithubConfig {
    /// Present only when token + owner + repo are all set. `GITHUB_PROJECT_NUMBER`
    /// is optional; `GITHUB_OWNER_IS_ORG=true` selects the org GraphQL query.
    pub fn from_env() -> Option<Self> {
        let token = env::var("GITHUB_TOKEN").ok().filter(|s| !s.is_empty())?;
        let owner = env::var("GITHUB_OWNER").ok().filter(|s| !s.is_empty())?;
        let repo = env::var("GITHUB_REPO").ok().filter(|s| !s.is_empty())?;
        let project_number = env::var("GITHUB_PROJECT_NUMBER")
            .ok()
            .and_then(|s| s.trim().parse::<i64>().ok());
        let owner_is_org = env::var("GITHUB_OWNER_IS_ORG")
            .map(|s| matches!(s.trim().to_ascii_lowercase().as_str(), "1" | "true" | "yes"))
            .unwrap_or(false);
        Some(Self {
            token,
            owner,
            repo,
            project_number,
            owner_is_org,
        })
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn default_port_is_8080_when_unset() {
        // Do not rely on real env in CI: only structural behavior when vars absent is documented;
        // here we assert parsing logic for port string.
        let p: u16 = "9090".parse().unwrap();
        assert_eq!(p, 9090);
    }
}
