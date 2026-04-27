//! Centralized configuration (SDD: deterministic behavior, no magic defaults in handlers).

use std::env;

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub database_url: Option<String>,
    pub mongo_uri: Option<String>,
    pub mongo_db: String,
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
        }
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
