-- Instance-wide GitHub integration configured from the application.
-- The token is never returned by the API. Deployments that require external
-- secret management can continue to use GITHUB_* environment variables.
CREATE TABLE IF NOT EXISTS github_integration (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    access_token TEXT NOT NULL,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    project_number BIGINT,
    owner_is_org BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
