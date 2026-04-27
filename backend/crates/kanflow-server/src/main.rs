//! Kanflow API server entrypoint.

use anyhow::Context;
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

    let state = AppState::new(pg, mongo);
    let app = router(state);

    let addr = format!("{}:{}", cfg.host, cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr).await.context("bind")?;
    tracing::info!(%addr, "Kanflow listening");
    axum::serve(listener, app).await.context("serve")?;
    Ok(())
}
