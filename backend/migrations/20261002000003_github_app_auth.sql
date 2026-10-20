ALTER TABLE github_integration
    ADD COLUMN IF NOT EXISTS auth_method TEXT NOT NULL DEFAULT 'pat',
    ADD COLUMN IF NOT EXISTS refresh_token TEXT;

ALTER TABLE github_integration
    DROP CONSTRAINT IF EXISTS github_integration_auth_method_check;

ALTER TABLE github_integration
    ADD CONSTRAINT github_integration_auth_method_check
    CHECK (auth_method IN ('pat', 'github_app'));
