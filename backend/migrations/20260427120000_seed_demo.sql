-- Kanflow demo seed — full parity with `frontend/src/constants.ts` (MOCK_USERS, MOCK_PROJECTS, MOCK_TASKS).
-- Uses fixed timestamps (UTC) so API responses are reproducible in tests.
--
-- IDs (UUID):
--   Users:    a2000000-0000-4000-8000-000000000001..003 (Alex, Sam, Jordan)
--   Projects: b1000000-0000-4000-8000-000000000001..002
--   Columns:  c100... (launch), c200... (migration)
--   Tasks:    d100... (launch ×3), d200... (migration ×2)
--   Comment:  e1000000-0000-4000-8000-000000000001
--   Time:     f1000000-0000-4000-8000-000000000001

INSERT INTO users (id, name, email, role)
VALUES
    ('a2000000-0000-4000-8000-000000000001'::uuid, 'Alex Rivera', 'alex@example.com', 'Lead Developer'),
    ('a2000000-0000-4000-8000-000000000002'::uuid, 'Sam Chen', 'sam@example.com', 'Product Designer'),
    ('a2000000-0000-4000-8000-000000000003'::uuid, 'Jordan Taylor', 'jordan@example.com', 'QA Engineer')
ON CONFLICT (email) DO NOTHING;

-- Project "Kanflow product launch"
INSERT INTO projects (id, name, description, owner_id, created_at)
VALUES (
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'Kanflow product launch',
    'Modernizing the core platform with a focus on usability and speed.',
    'a2000000-0000-4000-8000-000000000001'::uuid,
    '2026-01-10 12:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO columns (id, project_id, title, sort_order)
VALUES
    ('c1000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'To Do', 0),
    ('c1000000-0000-4000-8000-000000000002'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'In Progress', 1),
    ('c1000000-0000-4000-8000-000000000003'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Review', 2),
    ('c1000000-0000-4000-8000-000000000004'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Done', 3)
ON CONFLICT (id) DO NOTHING;

-- Project "Back-end Migration"
INSERT INTO projects (id, name, description, owner_id, created_at)
VALUES (
    'b1000000-0000-4000-8000-000000000002'::uuid,
    'Back-end Migration',
    'Moving from legacy servers to a cloud-native architecture.',
    'a2000000-0000-4000-8000-000000000001'::uuid,
    '2026-01-15 09:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO columns (id, project_id, title, sort_order)
VALUES
    ('c2000000-0000-4000-8000-000000000001'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Backlog', 0),
    ('c2000000-0000-4000-8000-000000000002'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Developing', 1),
    ('c2000000-0000-4000-8000-000000000003'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Staging', 2),
    ('c2000000-0000-4000-8000-000000000004'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Production', 3)
ON CONFLICT (id) DO NOTHING;

-- Tasks: Kanflow product launch (3)
INSERT INTO tasks (
    id, project_id, column_id, title, description, priority, assignee_id, due_at, tags, created_at, updated_at
)
VALUES (
    'd1000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000002'::uuid,
    'Finalize core typography',
    'Establish the type scales and font pairings for the new design system.',
    'high',
    'a2000000-0000-4000-8000-000000000002'::uuid,
    '2026-01-22 12:00:00+00'::timestamptz,
    ARRAY['design', 'system']::text[],
    '2026-01-19 15:00:00+00'::timestamptz,
    '2026-01-20 14:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (
    id, project_id, column_id, title, description, priority, assignee_id, due_at, tags, created_at, updated_at
)
VALUES (
    'd1000000-0000-4000-8000-000000000002'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'Implement Dark Mode',
    'Add support for system-level dark mode switching.',
    'medium',
    'a2000000-0000-4000-8000-000000000001'::uuid,
    '2026-01-25 12:00:00+00'::timestamptz,
    ARRAY['feature']::text[],
    '2026-01-18 12:00:00+00'::timestamptz,
    '2026-01-18 12:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (
    id, project_id, column_id, title, description, priority, assignee_id, due_at, tags, created_at, updated_at
)
VALUES (
    'd1000000-0000-4000-8000-000000000003'::uuid,
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'c1000000-0000-4000-8000-000000000004'::uuid,
    'User Testing: Prototype A',
    'Recruit 5 participants for a remote usability study.',
    'low',
    'a2000000-0000-4000-8000-000000000003'::uuid,
    '2026-01-16 12:00:00+00'::timestamptz,
    ARRAY['testing']::text[],
    '2026-01-16 12:00:00+00'::timestamptz,
    '2026-01-19 12:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

-- Tasks: Back-end Migration (2)
INSERT INTO tasks (
    id, project_id, column_id, title, description, priority, assignee_id, due_at, tags, created_at, updated_at
)
VALUES (
    'd2000000-0000-4000-8000-000000000001'::uuid,
    'b1000000-0000-4000-8000-000000000002'::uuid,
    'c2000000-0000-4000-8000-000000000001'::uuid,
    'Inventory legacy APIs',
    'Catalog REST and SOAP endpoints still serving production traffic.',
    'high',
    'a2000000-0000-4000-8000-000000000001'::uuid,
    '2026-01-28 17:00:00+00'::timestamptz,
    ARRAY['discovery', 'api']::text[],
    '2026-01-15 10:00:00+00'::timestamptz,
    '2026-01-17 11:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (
    id, project_id, column_id, title, description, priority, assignee_id, due_at, tags, created_at, updated_at
)
VALUES (
    'd2000000-0000-4000-8000-000000000002'::uuid,
    'b1000000-0000-4000-8000-000000000002'::uuid,
    'c2000000-0000-4000-8000-000000000002'::uuid,
    'Provision staging cluster',
    'Stand up k8s namespace and secrets mirror for pre-prod validation.',
    'medium',
    'a2000000-0000-4000-8000-000000000002'::uuid,
    '2026-01-30 09:00:00+00'::timestamptz,
    ARRAY['infra', 'k8s']::text[],
    '2026-01-16 14:00:00+00'::timestamptz,
    '2026-01-18 09:30:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

-- Comment on first task (matches MOCK_TASKS[0].comments[0])
INSERT INTO comments (id, task_id, user_id, user_name, content, created_at)
VALUES (
    'e1000000-0000-4000-8000-000000000001'::uuid,
    'd1000000-0000-4000-8000-000000000001'::uuid,
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'Alex Rivera',
    'Let''s stick with Inter for sans-serif.',
    '2026-01-20 14:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

-- Dark mode task depends on typography task (demo dependency graph)
INSERT INTO task_dependencies (task_id, depends_on_id)
VALUES (
    'd1000000-0000-4000-8000-000000000002'::uuid,
    'd1000000-0000-4000-8000-000000000001'::uuid
) ON CONFLICT (task_id, depends_on_id) DO NOTHING;

-- Sample time entry (completed session on typography task; times derived from UTC timestamps)
INSERT INTO time_entries (id, task_id, user_id, start_time, end_time, duration, description, created_at)
VALUES (
    'f1000000-0000-4000-8000-000000000001'::uuid,
    'd1000000-0000-4000-8000-000000000001'::uuid,
    'a2000000-0000-4000-8000-000000000001',
    (EXTRACT(EPOCH FROM '2026-01-20 14:00:00+00'::timestamptz) * 1000)::bigint,
    (EXTRACT(EPOCH FROM '2026-01-20 16:00:00+00'::timestamptz) * 1000)::bigint,
    7200000,
    'Design review session',
    '2026-01-20 16:00:00+00'::timestamptz
) ON CONFLICT (id) DO NOTHING;

-- Project team (matches MOCK_PROJECTS[].memberIds)
INSERT INTO project_members (project_id, user_id) VALUES
    ('b1000000-0000-4000-8000-000000000001'::uuid, 'a2000000-0000-4000-8000-000000000001'::uuid),
    ('b1000000-0000-4000-8000-000000000001'::uuid, 'a2000000-0000-4000-8000-000000000002'::uuid),
    ('b1000000-0000-4000-8000-000000000001'::uuid, 'a2000000-0000-4000-8000-000000000003'::uuid),
    ('b1000000-0000-4000-8000-000000000002'::uuid, 'a2000000-0000-4000-8000-000000000001'::uuid)
ON CONFLICT (project_id, user_id) DO NOTHING;
