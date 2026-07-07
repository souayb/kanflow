//! Keycloak JWT authentication middleware.
//!
//! When `AppState::auth` is `None` (no `KEYCLOAK_URL` configured, or in tests),
//! every request passes through unauthenticated.  When wired up, every
//! `/api/v1/*` request must carry a valid Bearer token signed by the configured realm.

use std::collections::HashMap;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::{header, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use tokio::sync::RwLock;

use crate::state::AppState;

// ── JWKS types ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct Jwk {
    kid: Option<String>,
    kty: String,
    n: Option<String>,
    e: Option<String>,
}

#[derive(Debug, Deserialize)]
struct JwksDoc {
    keys: Vec<Jwk>,
}

// ── Claims ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RealmAccess {
    pub roles: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub iss: Option<String>,
    pub exp: u64,
    pub preferred_username: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
    pub realm_access: Option<RealmAccess>,
}

/// Injected on every `/api/v1/*` request after JWT validation (or dev-open mode).
#[derive(Clone, Debug)]
pub struct KanflowAuth {
    pub sub: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub realm_roles: Vec<String>,
}

impl KanflowAuth {
    /// Used when Keycloak is not configured: contract tests and local API without auth.
    pub fn dev_open() -> Self {
        Self {
            sub: "dev-open".into(),
            email: None,
            name: Some("Dev".into()),
            realm_roles: vec!["admin".into(), "member".into()],
        }
    }

    pub fn is_admin(&self) -> bool {
        self.realm_roles.iter().any(|r| r == "admin")
    }
}

// ── Auth state (JWKS cache + config) ─────────────────────────────────────────

pub struct AuthConfig {
    pub jwks_url: String,
    pub issuer: String,
    pub keys: RwLock<HashMap<String, DecodingKey>>,
}

impl AuthConfig {
    pub fn new(jwks_url: String, issuer: String) -> Arc<Self> {
        Arc::new(Self {
            jwks_url,
            issuer,
            keys: RwLock::new(HashMap::new()),
        })
    }
}

// ── JWKS fetcher ──────────────────────────────────────────────────────────────

pub async fn fetch_and_cache_jwks(auth: &Arc<AuthConfig>) -> anyhow::Result<()> {
    let doc: JwksDoc = reqwest::get(&auth.jwks_url).await?.json().await?;
    let mut map = HashMap::new();
    for jwk in doc.keys {
        if jwk.kty != "RSA" {
            continue;
        }
        if let (Some(kid), Some(n), Some(e)) = (jwk.kid, jwk.n, jwk.e) {
            match DecodingKey::from_rsa_components(&n, &e) {
                Ok(dk) => { map.insert(kid, dk); }
                Err(e) => tracing::warn!("skip JWK: {e}"),
            }
        }
    }
    tracing::info!(count = map.len(), "JWKS refreshed");
    *auth.keys.write().await = map;
    Ok(())
}

// ── Token validation ──────────────────────────────────────────────────────────

async fn validate_token(token: &str, auth: &Arc<AuthConfig>) -> Result<Claims, ()> {
    let header = decode_header(token).map_err(|_| ())?;
    let kid = header.kid.as_deref().unwrap_or("").to_string();

    // Try cached key first
    {
        let keys = auth.keys.read().await;
        if let Some(dk) = keys.get(&kid) {
            return try_decode(token, dk, &auth.issuer);
        }
    }

    // Key not found — refresh JWKS once and retry
    if let Err(e) = fetch_and_cache_jwks(auth).await {
        tracing::warn!("JWKS refresh failed: {e}");
        return Err(());
    }
    let keys = auth.keys.read().await;
    let dk = keys.get(&kid).ok_or(())?;
    try_decode(token, dk, &auth.issuer)
}

fn try_decode(token: &str, dk: &DecodingKey, issuer: &str) -> Result<Claims, ()> {
    let mut v = Validation::new(Algorithm::RS256);
    v.set_issuer(&[issuer]);
    v.validate_aud = false; // Keycloak audience varies by client setup
    decode::<Claims>(token, dk, &v)
        .map(|d| d.claims)
        .map_err(|e| { tracing::debug!("JWT validation failed: {e}"); })
}

// ── Axum middleware ───────────────────────────────────────────────────────────

pub async fn require_auth(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    // Auth not configured — attach dev identity so handlers can use Extension<KanflowAuth>.
    let Some(ref auth) = state.auth else {
        req.extensions_mut().insert(KanflowAuth::dev_open());
        return next.run(req).await;
    };

    let token = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "));

    let Some(token) = token else {
        return (StatusCode::UNAUTHORIZED, "missing Bearer token").into_response();
    };

    match validate_token(token, auth).await {
        Ok(claims) => {
            let realm_roles = claims
                .realm_access
                .and_then(|r| r.roles)
                .unwrap_or_default();
            req.extensions_mut().insert(KanflowAuth {
                sub: claims.sub,
                email: claims.email,
                name: claims.name,
                realm_roles,
            });
            next.run(req).await
        }
        Err(()) => (StatusCode::UNAUTHORIZED, "invalid or expired token").into_response(),
    }
}
