-- Collaboration overview (work sessions + activity) and GitHub PR fields on tasks.
-- Inspired by AgentBoardMCP product surfaces; storage stays in Postgres.

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS github_pr_number INT,
    ADD COLUMN IF NOT EXISTS github_pr_url    TEXT,
    ADD COLUMN IF NOT EXISTS github_pr_state  TEXT;

CREATE TABLE IF NOT EXISTS work_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_kind      TEXT NOT NULL DEFAULT 'human'
                    CHECK (actor_kind IN ('human', 'agent')),
    tool            TEXT
                    CHECK (tool IS NULL OR tool IN ('cursor', 'claude', 'codex', 'ollama', 'human')),
    intent          TEXT NOT NULL DEFAULT '',
    phase           TEXT NOT NULL DEFAULT 'exploring'
                    CHECK (phase IN ('exploring', 'implementing', 'testing', 'pr_open', 'review', 'blocked')),
    touched_files   TEXT[] NOT NULL DEFAULT '{}',
    planned_files   TEXT[] NOT NULL DEFAULT '{}',
    branch_name     TEXT,
    heartbeat_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_sessions_project_heartbeat
    ON work_sessions (project_id, heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_sessions_task
    ON work_sessions (task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_sessions_owner
    ON work_sessions (owner_user_id);

CREATE TABLE IF NOT EXISTS activity_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    actor_id     UUID NOT NULL,
    actor_kind   TEXT NOT NULL DEFAULT 'human'
                 CHECK (actor_kind IN ('human', 'agent')),
    action       TEXT NOT NULL,
    task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL,
    path         TEXT,
    message      TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_project_created
    ON activity_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_task
    ON activity_events (task_id) WHERE task_id IS NOT NULL;

-- Product tickets for Collaboration overview + PR reviews (Kanflow launch board)
INSERT INTO tasks (
    id, project_id, column_id, title, description, priority, assignee_id, due_at, tags, position, created_at, updated_at
)
VALUES (
    'd1000000-0000-4000-8000-000000000004'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'Collaboration overview (agent-aware)',
    'AgentBoardMCP-inspired Collaboration view: who is working on what (humans + agents), Needs-you overlaps, repo folder map from touched files, and a real activity/blame feed. Acceptance: demo users + ≥1 agent session show grouped work, file map, and overlaps when two sessions share a file or the same GitHub issue.',
    'high',
    'a2000000-0000-4000-8000-000000000001'::uuid,
    NULL,
    ARRAY['collaboration', 'agents']::text[],
    2000,
    '2026-01-31 00:00:00+00'::timestamptz,
    '2026-01-31 00:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (
    id, project_id, column_id, title, description, priority, assignee_id, due_at, tags, position, created_at, updated_at
)
VALUES (
    'd1000000-0000-4000-8000-000000000005'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'Add PR reviews option',
    'Create/link GitHub PRs from task branches; persist PR number/URL/state; surface review decision in TaskModal and a Reviews list. Acceptance: with GitHub connected and a branch, create a PR, see status on the task and in Reviews; refresh updates after GitHub changes.',
    'high',
    'a2000000-0000-4000-8000-000000000002'::uuid,
    NULL,
    ARRAY['github', 'collaboration']::text[],
    3000,
    '2026-01-31 00:00:00+00'::timestamptz,
    '2026-01-31 00:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO task_dependencies (task_id, depends_on_id)
VALUES (
    'd1000000-0000-4000-8000-000000000005'::uuid,
    'd1000000-0000-4000-8000-000000000004'::uuid
) ON CONFLICT (task_id, depends_on_id) DO NOTHING;

INSERT INTO work_sessions (
    id, project_id, task_id, owner_user_id, actor_kind, tool, intent, phase,
    touched_files, planned_files, branch_name, heartbeat_at, created_at, updated_at
)
VALUES (
    'e2000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'd1000000-0000-4000-8000-000000000004'::uuid,
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'agent',
    'cursor',
    'Scaffold Collaboration overview and activity feed',
    'implementing',
    ARRAY[
        'frontend/src/components/CollaborationView.tsx',
        'frontend/src/types.ts',
        'backend/crates/kanflow-server/src/handlers/collaboration.rs'
    ]::text[],
    ARRAY['MISSION.md']::text[],
    'task/collaboration-overview',
    NOW(),
    '2026-01-31 00:00:00+00'::timestamptz,
    '2026-01-31 00:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO activity_events (id, project_id, actor_id, actor_kind, action, task_id, path, message, created_at)
VALUES
(
    'e3000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'agent',
    'session_claimed',
    'd1000000-0000-4000-8000-000000000004'::uuid,
    'frontend/src/components/CollaborationView.tsx',
    'Agent claimed Collaboration overview',
    '2026-01-31 00:00:00+00'::timestamptz
),
(
    'e3000000-0000-4000-8000-000000000002'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'a2000000-0000-4000-8000-000000000002'::uuid,
    'human',
    'task_created',
    'd1000000-0000-4000-8000-000000000005'::uuid,
    NULL,
    'Created ticket: Add PR reviews option',
    '2026-01-31 00:00:00+00'::timestamptz
)
ON CONFLICT (id) DO NOTHING;
