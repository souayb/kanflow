//! Read-only status of instance-wide third-party integrations.

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Redirect};
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::config::GithubConfig;
use crate::github::GithubClient;
use crate::state::{AppState, PendingGithubAuth};

// ── GET /api/v1/integrations/github ──────────────────────────────────────────

/// Whether `GITHUB_TOKEN`/`GITHUB_OWNER`/`GITHUB_REPO` are configured for this
/// instance, and (never the token) the repo it's wired to — so the frontend can
/// gate GitHub-only UI (issue sync status, branch creation) on real connectivity
/// instead of guessing from its own local settings.
pub async fn github_status(State(state): State<AppState>) -> impl IntoResponse {
    let auth_method = if let Some(pool) = &state.pg {
        sqlx::query_scalar::<_, String>("SELECT auth_method FROM github_integration WHERE id = 1")
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
    } else {
        None
    };
    let app_available = state.github_app.is_some();
    match state.github_client() {
        Some(gh) => match gh.default_branch().await {
            Ok(default_branch) => Json(json!({
                "connected": true,
                "configured": true,
                "owner": gh.owner(),
                "repo": gh.repo(),
                "defaultBranch": default_branch,
                "authMethod": auth_method.as_deref().unwrap_or("pat"),
                "appAvailable": app_available,
            })),
            Err(error) => {
                tracing::warn!("GitHub connection check failed: {error:#}");
                Json(json!({
                    "connected": false,
                    "configured": true,
                    "owner": gh.owner(),
                    "repo": gh.repo(),
                    "error": "connection_failed",
                    "authMethod": auth_method.as_deref().unwrap_or("pat"),
                    "appAvailable": app_available,
                }))
            }
        },
        None => Json(json!({
            "connected": false,
            "configured": false,
            "appAvailable": app_available,
        })),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigureGithubBody {
    pub token: String,
    pub owner: String,
    pub repo: String,
    pub project_number: Option<i64>,
    #[serde(default)]
    pub owner_is_org: bool,
}

/// Validate and persist an instance-wide GitHub connection.
///
/// The access token is accepted only over the authenticated API and is never
/// included in a response. Environment configuration remains supported and
/// takes effect again if the database-backed connection is removed/restarted.
pub async fn configure_github(
    State(state): State<AppState>,
    Json(body): Json<ConfigureGithubBody>,
) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "postgres_disabled" })),
        )
            .into_response();
    };

    let token = body.token.trim();
    let owner = body.owner.trim();
    let repo = body.repo.trim();
    if token.is_empty() || owner.is_empty() || repo.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "token_owner_repo_required" })),
        )
            .into_response();
    }

    let config = GithubConfig {
        token: token.to_owned(),
        owner: owner.to_owned(),
        repo: repo.to_owned(),
        project_number: body.project_number,
        owner_is_org: body.owner_is_org,
    };
    let client = GithubClient::new(config);
    let default_branch = match client.default_branch().await {
        Ok(branch) => branch,
        Err(error) => {
            tracing::warn!("GitHub setup validation failed: {error:#}");
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "github_connection_failed" })),
            )
                .into_response();
        }
    };

    if let Err(error) = sqlx::query(
        r#"INSERT INTO github_integration
           (id, access_token, owner, repo, project_number, owner_is_org, auth_method, refresh_token, updated_at)
           VALUES (1, $1, $2, $3, $4, $5, 'pat', NULL, now())
           ON CONFLICT (id) DO UPDATE SET
             access_token = EXCLUDED.access_token,
             owner = EXCLUDED.owner,
             repo = EXCLUDED.repo,
             project_number = EXCLUDED.project_number,
             owner_is_org = EXCLUDED.owner_is_org,
             auth_method = 'pat',
             refresh_token = NULL,
             updated_at = now()"#,
    )
    .bind(token)
    .bind(owner)
    .bind(repo)
    .bind(body.project_number)
    .bind(body.owner_is_org)
    .execute(pool)
    .await
    {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        )
            .into_response();
    }

    state.set_github(Some(client));
    Json(json!({
        "connected": true,
        "configured": true,
        "owner": owner,
        "repo": repo,
        "defaultBranch": default_branch,
        "authMethod": "pat",
        "appAvailable": state.github_app.is_some(),
    }))
    .into_response()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartGithubAuthBody {
    pub owner: String,
    pub repo: String,
    pub project_number: Option<i64>,
    #[serde(default)]
    pub owner_is_org: bool,
}

pub async fn start_github_auth(
    State(state): State<AppState>,
    Json(body): Json<StartGithubAuthBody>,
) -> impl IntoResponse {
    let Some(app) = &state.github_app else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "github_app_not_configured" })),
        )
            .into_response();
    };
    let owner = body.owner.trim();
    let repo = body.repo.trim();
    if owner.is_empty() || repo.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "owner_repo_required" })),
        )
            .into_response();
    }

    let oauth_state = Uuid::new_v4().to_string();
    state.store_pending_github_auth(
        oauth_state.clone(),
        PendingGithubAuth::new(
            owner.to_owned(),
            repo.to_owned(),
            body.project_number,
            body.owner_is_org,
        ),
    );
    let mut authorize_url =
        reqwest::Url::parse("https://github.com/login/oauth/authorize").expect("valid GitHub URL");
    authorize_url
        .query_pairs_mut()
        .append_pair("client_id", &app.client_id)
        .append_pair("redirect_uri", &app.callback_url)
        .append_pair("state", &oauth_state);

    Json(json!({ "authorizeUrl": authorize_url.as_str() })).into_response()
}

#[derive(Debug, Deserialize)]
pub struct GithubCallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    error: Option<String>,
}

fn callback_redirect(frontend_url: &str, result: &str) -> Redirect {
    let mut url = reqwest::Url::parse(frontend_url)
        .unwrap_or_else(|_| reqwest::Url::parse("http://localhost:3000").expect("valid fallback"));
    url.query_pairs_mut().append_pair("github", result);
    Redirect::temporary(url.as_str())
}

pub async fn github_auth_callback(
    State(state): State<AppState>,
    Query(query): Query<GithubCallbackQuery>,
) -> impl IntoResponse {
    let Some(app) = &state.github_app else {
        return callback_redirect("http://localhost:3000", "not_configured");
    };
    if query.error.is_some() {
        return callback_redirect(&app.frontend_url, "denied");
    }
    let (Some(code), Some(oauth_state)) = (query.code, query.state) else {
        return callback_redirect(&app.frontend_url, "invalid_callback");
    };
    let Some(pending) = state.take_pending_github_auth(&oauth_state) else {
        return callback_redirect(&app.frontend_url, "invalid_state");
    };
    let Some(pool) = &state.pg else {
        return callback_redirect(&app.frontend_url, "database_unavailable");
    };

    let token_response = reqwest::Client::new()
        .post("https://github.com/login/oauth/access_token")
        .header(reqwest::header::ACCEPT, "application/json")
        .json(&json!({
            "client_id": app.client_id,
            "client_secret": app.client_secret,
            "code": code,
            "redirect_uri": app.callback_url,
        }))
        .send()
        .await;
    let token_response = match token_response {
        Ok(response) => match response.json::<GithubTokenResponse>().await {
            Ok(token) => token,
            Err(error) => {
                tracing::warn!("Could not decode GitHub token response: {error:#}");
                return callback_redirect(&app.frontend_url, "token_exchange_failed");
            }
        },
        Err(error) => {
            tracing::warn!("GitHub token exchange failed: {error:#}");
            return callback_redirect(&app.frontend_url, "token_exchange_failed");
        }
    };
    if token_response.error.is_some() {
        return callback_redirect(&app.frontend_url, "token_exchange_failed");
    }
    let Some(access_token) = token_response.access_token else {
        return callback_redirect(&app.frontend_url, "token_exchange_failed");
    };

    let config = GithubConfig {
        token: access_token.clone(),
        owner: pending.owner.clone(),
        repo: pending.repo.clone(),
        project_number: pending.project_number,
        owner_is_org: pending.owner_is_org,
    };
    let client = GithubClient::new(config);
    if let Err(error) = client.default_branch().await {
        tracing::warn!("Authorized GitHub App cannot access repository: {error:#}");
        return callback_redirect(&app.frontend_url, "repository_unavailable");
    }

    let saved = sqlx::query(
        r#"INSERT INTO github_integration
           (id, access_token, owner, repo, project_number, owner_is_org, auth_method, refresh_token, updated_at)
           VALUES (1, $1, $2, $3, $4, $5, 'github_app', $6, now())
           ON CONFLICT (id) DO UPDATE SET
             access_token = EXCLUDED.access_token,
             owner = EXCLUDED.owner,
             repo = EXCLUDED.repo,
             project_number = EXCLUDED.project_number,
             owner_is_org = EXCLUDED.owner_is_org,
             auth_method = 'github_app',
             refresh_token = EXCLUDED.refresh_token,
             updated_at = now()"#,
    )
    .bind(&access_token)
    .bind(&pending.owner)
    .bind(&pending.repo)
    .bind(pending.project_number)
    .bind(pending.owner_is_org)
    .bind(token_response.refresh_token)
    .execute(pool)
    .await;
    if let Err(error) = saved {
        tracing::warn!("Could not persist GitHub App authorization: {error:#}");
        return callback_redirect(&app.frontend_url, "save_failed");
    }

    state.set_github(Some(client));
    callback_redirect(&app.frontend_url, "connected")
}

pub async fn disconnect_github(State(state): State<AppState>) -> impl IntoResponse {
    let Some(pool) = &state.pg else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "postgres_disabled" })),
        )
            .into_response();
    };
    let stored = sqlx::query_as::<_, (String, String)>(
        "SELECT access_token, auth_method FROM github_integration WHERE id = 1",
    )
    .fetch_optional(pool)
    .await;
    let stored = match stored {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
                .into_response()
        }
    };
    if let Some((access_token, auth_method)) = stored {
        if auth_method == "github_app" {
            let Some(app) = &state.github_app else {
                return (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(json!({ "error": "github_app_not_configured" })),
                )
                    .into_response();
            };
            let revoke_url = format!(
                "https://api.github.com/applications/{}/token",
                app.client_id
            );
            let response = reqwest::Client::new()
                .delete(revoke_url)
                .basic_auth(&app.client_id, Some(&app.client_secret))
                .header(reqwest::header::USER_AGENT, "kanflow")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .json(&json!({ "access_token": access_token }))
                .send()
                .await;
            match response {
                Ok(response)
                    if response.status().is_success()
                        || response.status() == reqwest::StatusCode::NOT_FOUND => {}
                Ok(response) => {
                    tracing::warn!(status = %response.status(), "GitHub token revocation failed");
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({ "error": "github_revocation_failed" })),
                    )
                        .into_response();
                }
                Err(error) => {
                    tracing::warn!("GitHub token revocation failed: {error:#}");
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({ "error": "github_revocation_failed" })),
                    )
                        .into_response();
                }
            }
        }
    }
    if let Err(error) = sqlx::query("DELETE FROM github_integration WHERE id = 1")
        .execute(pool)
        .await
    {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        )
            .into_response();
    }
    state.set_github(None);
    StatusCode::NO_CONTENT.into_response()
}
