-- GitHub branch creation: a task can have a working branch created for it,
-- separate from the one-way issue sync in 20260701000001_github_links.sql.
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS github_branch_name TEXT,
    ADD COLUMN IF NOT EXISTS github_branch_url  TEXT;
