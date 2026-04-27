-- Kanflow §5.3 — comments, task dependencies, and time entries

CREATE TABLE IF NOT EXISTS comments (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id      UUID        NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id      TEXT        NOT NULL,
    user_name    TEXT        NOT NULL,
    content      TEXT        NOT NULL CHECK (content <> ''),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id       UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_id),
    CHECK (task_id <> depends_on_id)
);

CREATE TABLE IF NOT EXISTS time_entries (
    id          UUID   PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id     UUID   NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id     TEXT   NOT NULL,
    start_time  BIGINT NOT NULL,          -- Unix ms
    end_time    BIGINT,                   -- Unix ms, NULL while running
    duration    BIGINT NOT NULL DEFAULT 0,-- ms
    description TEXT   NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_task      ON comments        (task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_task     ON task_dependencies (task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task  ON time_entries    (task_id);
