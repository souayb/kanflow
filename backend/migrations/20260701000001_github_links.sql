-- GitHub one-way sync: link each task to its GitHub Issue + Projects v2 item.
-- All nullable — tasks created while GitHub is unconfigured (or when a sync fails)
-- simply carry NULLs and can be back-filled on a later update.
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS github_issue_number   INT,
    ADD COLUMN IF NOT EXISTS github_issue_url      TEXT,
    ADD COLUMN IF NOT EXISTS github_node_id        TEXT,
    ADD COLUMN IF NOT EXISTS github_project_item_id TEXT;
