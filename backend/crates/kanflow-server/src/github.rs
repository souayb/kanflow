//! One-way GitHub sync: a Kanflow task becomes a GitHub Issue, and (when a
//! Projects v2 number is configured) the issue is added as an item to that board.
//!
//! Everything here is best-effort: callers treat failures as non-fatal so a
//! GitHub outage or a bad token never blocks task CRUD. See `handlers::tasks`.

use serde_json::json;
use tokio::sync::OnceCell;

use crate::config::GithubConfig;

const REST_BASE: &str = "https://api.github.com";
const GRAPHQL_URL: &str = "https://api.github.com/graphql";
const USER_AGENT: &str = "kanflow-server";
const API_VERSION: &str = "2022-11-28";

/// Result of creating (or updating) an issue — the bits we persist on the task.
#[derive(Debug, Clone)]
pub struct IssueRef {
    pub number: i64,
    pub html_url: String,
    /// GraphQL node id — needed to add the issue to a Projects v2 board.
    pub node_id: String,
}

/// A branch created for a task — the bits we persist on it.
#[derive(Debug, Clone)]
pub struct BranchRef {
    pub name: String,
    pub html_url: String,
}

/// Normalized PR state stored on the task (`github_pr_state`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrState {
    Draft,
    Open,
    Approved,
    Changes,
    Merged,
    Closed,
}

impl PrState {
    pub fn as_str(self) -> &'static str {
        match self {
            PrState::Draft => "draft",
            PrState::Open => "open",
            PrState::Approved => "approved",
            PrState::Changes => "changes",
            PrState::Merged => "merged",
            PrState::Closed => "closed",
        }
    }
}

/// Result of creating or fetching a pull request.
#[derive(Debug, Clone)]
pub struct PullRequestRef {
    pub number: i64,
    pub html_url: String,
    pub title: String,
    pub state: PrState,
}

/// Thin GitHub client. Cheap to clone (reqwest::Client is an Arc internally);
/// the resolved Projects v2 node id is cached after the first lookup.
#[derive(Clone)]
pub struct GithubClient {
    http: reqwest::Client,
    cfg: GithubConfig,
    project_node_id: std::sync::Arc<OnceCell<Option<String>>>,
}

impl GithubClient {
    pub fn new(cfg: GithubConfig) -> Self {
        Self {
            http: reqwest::Client::new(),
            cfg,
            project_node_id: std::sync::Arc::new(OnceCell::new()),
        }
    }

    /// `owner/repo` — handy for logs.
    pub fn slug(&self) -> String {
        format!("{}/{}", self.cfg.owner, self.cfg.repo)
    }

    pub fn owner(&self) -> &str {
        &self.cfg.owner
    }

    pub fn repo(&self) -> &str {
        &self.cfg.repo
    }

    fn auth(&self, rb: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        rb.bearer_auth(&self.cfg.token)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", API_VERSION)
    }

    // ── Issues (REST) ─────────────────────────────────────────────────────────

    /// `POST /repos/{owner}/{repo}/issues`
    pub async fn create_issue(
        &self,
        title: &str,
        body: &str,
        labels: &[String],
    ) -> anyhow::Result<IssueRef> {
        let url = format!(
            "{REST_BASE}/repos/{}/{}/issues",
            self.cfg.owner, self.cfg.repo
        );
        let payload = json!({ "title": title, "body": body, "labels": labels });
        let res = self
            .auth(self.http.post(&url))
            .json(&payload)
            .send()
            .await?;
        let res = ensure_ok(res, "create_issue").await?;
        let v: serde_json::Value = res.json().await?;
        parse_issue(&v)
    }

    /// `PATCH /repos/{owner}/{repo}/issues/{number}` — sync title/body and open/closed state.
    pub async fn update_issue(
        &self,
        number: i64,
        title: &str,
        body: &str,
        state: IssueState,
    ) -> anyhow::Result<()> {
        let url = format!(
            "{REST_BASE}/repos/{}/{}/issues/{number}",
            self.cfg.owner, self.cfg.repo
        );
        let payload = json!({ "title": title, "body": body, "state": state.as_str() });
        let res = self
            .auth(self.http.patch(&url))
            .json(&payload)
            .send()
            .await?;
        ensure_ok(res, "update_issue").await?;
        Ok(())
    }

    /// Close the issue backing a deleted/archived task.
    pub async fn close_issue(&self, number: i64) -> anyhow::Result<()> {
        let url = format!(
            "{REST_BASE}/repos/{}/{}/issues/{number}",
            self.cfg.owner, self.cfg.repo
        );
        let res = self
            .auth(self.http.patch(&url))
            .json(&json!({ "state": "closed" }))
            .send()
            .await?;
        ensure_ok(res, "close_issue").await?;
        Ok(())
    }

    // ── Branches (Git Data API) ─────────────────────────────────────────────────

    /// The repository's default branch (`GET /repos/{owner}/{repo}`), used as the
    /// base a new task branch forks from. Not cached — a repo can change its
    /// default branch, and this only runs once per manual "create branch" click.
    async fn default_branch(&self) -> anyhow::Result<String> {
        let url = format!("{REST_BASE}/repos/{}/{}", self.cfg.owner, self.cfg.repo);
        let res = self.auth(self.http.get(&url)).send().await?;
        let res = ensure_ok(res, "get_repo").await?;
        let v: serde_json::Value = res.json().await?;
        v.get("default_branch")
            .and_then(|b| b.as_str())
            .map(str::to_string)
            .ok_or_else(|| anyhow::anyhow!("repo response missing default_branch"))
    }

    /// Create a branch named `name` off the repository's current default branch.
    /// `POST /repos/{owner}/{repo}/git/refs` — fails (e.g. `422 Reference already
    /// exists`) if the branch is already there; callers persist the name only on
    /// success, so a retry after a failed prior attempt tries the same name again.
    pub async fn create_branch(&self, name: &str) -> anyhow::Result<BranchRef> {
        let base = self.default_branch().await?;
        let ref_url = format!(
            "{REST_BASE}/repos/{}/{}/git/ref/heads/{base}",
            self.cfg.owner, self.cfg.repo
        );
        let res = self.auth(self.http.get(&ref_url)).send().await?;
        let res = ensure_ok(res, "get_base_ref").await?;
        let v: serde_json::Value = res.json().await?;
        let sha = v
            .get("object")
            .and_then(|o| o.get("sha"))
            .and_then(|s| s.as_str())
            .ok_or_else(|| anyhow::anyhow!("base ref response missing object.sha"))?;

        let create_url = format!(
            "{REST_BASE}/repos/{}/{}/git/refs",
            self.cfg.owner, self.cfg.repo
        );
        let payload = json!({ "ref": format!("refs/heads/{name}"), "sha": sha });
        let res = self
            .auth(self.http.post(&create_url))
            .json(&payload)
            .send()
            .await?;
        ensure_ok(res, "create_branch").await?;

        Ok(BranchRef {
            name: name.to_string(),
            html_url: format!(
                "https://github.com/{}/{}/tree/{name}",
                self.cfg.owner, self.cfg.repo
            ),
        })
    }

    // ── Pull requests (REST) ──────────────────────────────────────────────────

    /// `POST /repos/{owner}/{repo}/pulls` — open a PR from `head` into the default branch.
    pub async fn create_pull_request(
        &self,
        title: &str,
        body: &str,
        head: &str,
    ) -> anyhow::Result<PullRequestRef> {
        let base = self.default_branch().await?;
        let url = format!(
            "{REST_BASE}/repos/{}/{}/pulls",
            self.cfg.owner, self.cfg.repo
        );
        let payload = json!({ "title": title, "body": body, "head": head, "base": base });
        let res = self
            .auth(self.http.post(&url))
            .json(&payload)
            .send()
            .await?;
        let res = ensure_ok(res, "create_pull_request").await?;
        let v: serde_json::Value = res.json().await?;
        parse_pull_request(&v)
    }

    /// `GET /repos/{owner}/{repo}/pulls/{number}` plus review decision via GraphQL when possible.
    pub async fn get_pull_request(&self, number: i64) -> anyhow::Result<PullRequestRef> {
        let url = format!(
            "{REST_BASE}/repos/{}/{}/pulls/{number}",
            self.cfg.owner, self.cfg.repo
        );
        let res = self.auth(self.http.get(&url)).send().await?;
        let res = ensure_ok(res, "get_pull_request").await?;
        let v: serde_json::Value = res.json().await?;
        let mut pr = parse_pull_request(&v)?;
        if let Ok(Some(d)) = self.pull_review_decision(number).await {
            pr.state = d;
        }
        Ok(pr)
    }

    async fn pull_review_decision(&self, number: i64) -> anyhow::Result<Option<PrState>> {
        let query = "query($owner:String!,$repo:String!,$number:Int!){ \
            repository(owner:$owner,name:$repo){ pullRequest(number:$number){ reviewDecision isDraft merged state } } }";
        let vars = json!({
            "owner": self.cfg.owner,
            "repo": self.cfg.repo,
            "number": number as i32,
        });
        let v = self.graphql(query, vars).await?;
        let pr = v
            .get("data")
            .and_then(|d| d.get("repository"))
            .and_then(|r| r.get("pullRequest"));
        let Some(pr) = pr else { return Ok(None) };
        if pr.get("merged").and_then(|m| m.as_bool()).unwrap_or(false) {
            return Ok(Some(PrState::Merged));
        }
        if pr.get("isDraft").and_then(|d| d.as_bool()).unwrap_or(false) {
            return Ok(Some(PrState::Draft));
        }
        let state = pr.get("state").and_then(|s| s.as_str()).unwrap_or("");
        if state.eq_ignore_ascii_case("closed") {
            return Ok(Some(PrState::Closed));
        }
        let decision = pr
            .get("reviewDecision")
            .and_then(|d| d.as_str())
            .unwrap_or("");
        Ok(Some(match decision {
            "APPROVED" => PrState::Approved,
            "CHANGES_REQUESTED" => PrState::Changes,
            _ => PrState::Open,
        }))
    }

    // ── Projects v2 (GraphQL) ──────────────────────────────────────────────────

    /// Resolve (and cache) the Projects v2 node id for the configured project number.
    /// `Ok(None)` when no project number is configured. Errors are surfaced so the
    /// caller can log them, but a failed lookup does not poison the cache permanently
    /// only when it resolves to a value.
    async fn project_node_id(&self) -> anyhow::Result<Option<String>> {
        let Some(number) = self.cfg.project_number else {
            return Ok(None);
        };
        // Fast path: already resolved.
        if let Some(cached) = self.project_node_id.get() {
            return Ok(cached.clone());
        }
        let owner_field = if self.cfg.owner_is_org {
            "organization"
        } else {
            "user"
        };
        let query = format!(
            "query($login:String!,$number:Int!){{ {owner_field}(login:$login){{ projectV2(number:$number){{ id }} }} }}"
        );
        let vars = json!({ "login": self.cfg.owner, "number": number });
        let v = self.graphql(&query, vars).await?;
        let id = v
            .get("data")
            .and_then(|d| d.get(owner_field))
            .and_then(|o| o.get("projectV2"))
            .and_then(|p| p.get("id"))
            .and_then(|i| i.as_str())
            .map(|s| s.to_string());
        if id.is_none() {
            anyhow::bail!(
                "projectV2(number={number}) not found for {owner_field} {}",
                self.cfg.owner
            );
        }
        // Cache only successful resolutions.
        let _ = self.project_node_id.set(id.clone());
        Ok(id)
    }

    /// Add an issue (by node id) to the configured Projects v2 board.
    /// Returns the created project item id, or `None` if no project is configured.
    pub async fn add_issue_to_project(
        &self,
        issue_node_id: &str,
    ) -> anyhow::Result<Option<String>> {
        let Some(project_id) = self.project_node_id().await? else {
            return Ok(None);
        };
        let mutation = "mutation($project:ID!,$content:ID!){ \
            addProjectV2ItemById(input:{projectId:$project,contentId:$content}){ item { id } } }";
        let vars = json!({ "project": project_id, "content": issue_node_id });
        let v = self.graphql(mutation, vars).await?;
        let item_id = v
            .get("data")
            .and_then(|d| d.get("addProjectV2ItemById"))
            .and_then(|a| a.get("item"))
            .and_then(|i| i.get("id"))
            .and_then(|i| i.as_str())
            .map(|s| s.to_string());
        Ok(item_id)
    }

    async fn graphql(
        &self,
        query: &str,
        variables: serde_json::Value,
    ) -> anyhow::Result<serde_json::Value> {
        let res = self
            .auth(self.http.post(GRAPHQL_URL))
            .json(&json!({ "query": query, "variables": variables }))
            .send()
            .await?;
        let res = ensure_ok(res, "graphql").await?;
        let v: serde_json::Value = res.json().await?;
        if let Some(errors) = v
            .get("errors")
            .filter(|e| !e.as_array().map(|a| a.is_empty()).unwrap_or(true))
        {
            anyhow::bail!("GraphQL errors: {errors}");
        }
        Ok(v)
    }
}

/// Open/closed state for `update_issue`, derived from whether the task's column is "done".
#[derive(Debug, Clone, Copy)]
pub enum IssueState {
    Open,
    Closed,
}
impl IssueState {
    fn as_str(self) -> &'static str {
        match self {
            IssueState::Open => "open",
            IssueState::Closed => "closed",
        }
    }
}

fn parse_issue(v: &serde_json::Value) -> anyhow::Result<IssueRef> {
    let number = v
        .get("number")
        .and_then(|n| n.as_i64())
        .ok_or_else(|| anyhow::anyhow!("issue response missing number"))?;
    let html_url = v
        .get("html_url")
        .and_then(|u| u.as_str())
        .unwrap_or_default()
        .to_string();
    let node_id = v
        .get("node_id")
        .and_then(|n| n.as_str())
        .unwrap_or_default()
        .to_string();
    Ok(IssueRef {
        number,
        html_url,
        node_id,
    })
}

fn parse_pull_request(v: &serde_json::Value) -> anyhow::Result<PullRequestRef> {
    let number = v
        .get("number")
        .and_then(|n| n.as_i64())
        .ok_or_else(|| anyhow::anyhow!("pull response missing number"))?;
    let html_url = v
        .get("html_url")
        .and_then(|u| u.as_str())
        .unwrap_or_default()
        .to_string();
    let title = v
        .get("title")
        .and_then(|t| t.as_str())
        .unwrap_or_default()
        .to_string();
    let draft = v.get("draft").and_then(|d| d.as_bool()).unwrap_or(false);
    let merged = v.get("merged").and_then(|m| m.as_bool()).unwrap_or(false);
    let state_str = v.get("state").and_then(|s| s.as_str()).unwrap_or("open");
    let state = if merged {
        PrState::Merged
    } else if draft {
        PrState::Draft
    } else if state_str.eq_ignore_ascii_case("closed") {
        PrState::Closed
    } else {
        PrState::Open
    };
    Ok(PullRequestRef {
        number,
        html_url,
        title,
        state,
    })
}

/// Turn a non-2xx GitHub response into an error carrying the body (for logs).
async fn ensure_ok(res: reqwest::Response, ctx: &str) -> anyhow::Result<reqwest::Response> {
    if res.status().is_success() {
        return Ok(res);
    }
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    anyhow::bail!("{ctx}: GitHub returned {status}: {body}")
}
