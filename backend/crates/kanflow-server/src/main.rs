//! Kanflow API server entrypoint.

use anyhow::Context;
use kanflow_server::auth::{fetch_and_cache_jwks, AuthConfig};
use kanflow_server::config::ServerConfig;
use kanflow_server::router;
use kanflow_server::state::AppState;
use mongodb::options::ClientOptions;
use mongodb::Client;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("kanflow_server=info".parse()?))
        .init();

    let cfg = ServerConfig::from_env();

    let pg = if let Some(ref url) = cfg.database_url {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(url)
            .await
            .context("connect postgres")?;
        sqlx::migrate!("../../migrations")
            .run(&pool)
            .await
            .context("run migrations")?;
        Some(pool)
    } else {
        tracing::warn!("DATABASE_URL not set — Postgres routes return 503");
        None
    };

    let mongo = if let Some(ref uri) = cfg.mongo_uri {
        let opts = ClientOptions::parse(uri).await.context("parse mongo uri")?;
        let client = Client::with_options(opts).context("mongo client")?;
        let db = client.database(&cfg.mongo_db);
        tracing::info!(db = %cfg.mongo_db, "connected to MongoDB");
        Some(db)
    } else {
        tracing::warn!("MONGO_URI not set — Mongo routes return 503");
        None
    };

    // ── Keycloak JWT auth ──────────────────────────────────────────────────
    let auth = if let (Some(jwks_url), Some(issuer)) = (cfg.jwks_url(), cfg.token_issuer()) {
        tracing::info!(%jwks_url, "Keycloak auth enabled");
        let ac = AuthConfig::new(jwks_url, issuer);
        // Pre-warm JWKS cache; warn (don't crash) if KC is not yet reachable
        if let Err(e) = fetch_and_cache_jwks(&ac).await {
            tracing::warn!("Could not pre-fetch JWKS (KC may still be starting): {e}");
        }
        Some(ac)
    } else {
        tracing::warn!("KEYCLOAK_URL / KEYCLOAK_REALM not set — auth disabled (all requests permitted)");
        None
    };

    let state = AppState::new(pg, mongo, auth);
    let app = router(state);

    let addr = format!("{}:{}", cfg.host, cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr).await.context("bind")?;
    tracing::info!(%addr, "Kanflow listening");
    axum::serve(listener, app).await.context("serve")?;
    Ok(())
}
