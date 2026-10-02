-- Self-service profile and privacy settings. Identity credentials remain in Keycloak.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS privacy_settings JSONB NOT NULL DEFAULT
        '{"activityVisibility":"project","showOnlineStatus":true,"allowAnalytics":false}'::jsonb;
