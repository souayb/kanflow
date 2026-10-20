-- Manual drag-and-drop ordering within a column: a float so a card can be
-- dropped between two others without renumbering the whole column.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill existing rows so the initial manual order matches today's implicit
-- (created_at) order, spaced out to leave room for inserts between them.
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY column_id ORDER BY created_at ASC) AS rn
    FROM tasks
)
UPDATE tasks SET position = ranked.rn * 1000
FROM ranked
WHERE tasks.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON tasks (column_id, position);
