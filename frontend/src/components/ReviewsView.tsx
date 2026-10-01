/**
 * PR Reviews queue — tasks in Review or with open/approved/changes PRs (MISSION §5.13).
 */

import React, { useMemo, useState } from 'react';
import { GitPullRequest, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { useApp } from '../AppContext';
import Avatar from './Avatar';
import { cn } from '../lib/utils';
import type { Task } from '../types';

const REVIEW_STATES = new Set(['open', 'approved', 'changes', 'draft']);

function prStateLabel(state?: string): string {
  switch (state) {
    case 'approved':
      return 'Approved';
    case 'changes':
      return 'Changes requested';
    case 'draft':
      return 'Draft';
    case 'merged':
      return 'Merged';
    case 'closed':
      return 'Closed';
    case 'open':
      return 'Open';
    default:
      return 'No PR';
  }
}

export default function ReviewsView() {
  const {
    tasks,
    projects,
    users,
    activeProjectId,
    openTaskOnBoard,
    refreshTaskPr,
    githubStatus,
    apiOnline,
  } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const reviewColumnId = useMemo(() => {
    const col = activeProject?.columns.find((c) => c.title.trim().toLowerCase() === 'review');
    return col?.id;
  }, [activeProject]);

  const reviewTasks = useMemo(() => {
    return tasks
      .filter((t) => t.projectId === activeProjectId)
      .filter(
        (t) =>
          (reviewColumnId != null && t.status === reviewColumnId) ||
          (t.githubPrState != null && REVIEW_STATES.has(t.githubPrState)),
      )
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [tasks, activeProjectId, reviewColumnId]);

  const onRefresh = async (task: Task) => {
    if (!task.githubPrNumber) return;
    setBusyId(task.id);
    setError(null);
    try {
      await refreshTaskPr(task.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight text-kf-charcoal flex items-center gap-3">
          <GitPullRequest className="text-kf-meta-blue" strokeWidth={1.75} />
          Reviews
        </h1>
        <p className="text-kf-slate text-sm mt-2">
          Tasks in Review and pull requests waiting for a decision.
        </p>
      </div>

      {error && <p className="text-sm text-kf-error mb-4">{error}</p>}

      {!githubStatus.connected && apiOnline && (
        <p className="text-sm text-kf-slate mb-6">
          GitHub is not connected on the server — PR status sync is unavailable. Board Review column tasks still appear below.
        </p>
      )}

      <div className="space-y-3 max-w-3xl">
        {reviewTasks.length === 0 && (
          <p className="text-sm text-kf-slate">No review items for this project.</p>
        )}
        {reviewTasks.map((task) => {
          const assignee = users.find((u) => u.id === task.assigneeId);
          const col = activeProject?.columns.find((c) => c.id === task.status);
          return (
            <div
              key={task.id}
              className="kf-card-elevated p-4 md:p-5 flex flex-wrap items-center gap-4 justify-between"
            >
              <button
                type="button"
                className="text-left min-w-0 flex-1"
                onClick={() => openTaskOnBoard(task.id)}
              >
                <div className="text-sm font-medium text-kf-charcoal truncate">{task.title}</div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-kf-slate">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide text-[10px]',
                      task.githubPrState === 'approved' && 'bg-[rgba(36,228,0,0.15)] text-kf-success',
                      task.githubPrState === 'changes' && 'bg-[rgba(255,123,145,0.15)] text-kf-error',
                      (!task.githubPrState || task.githubPrState === 'open' || task.githubPrState === 'draft') &&
                        'bg-kf-baby-blue text-kf-meta-blue',
                    )}
                  >
                    {prStateLabel(task.githubPrState)}
                  </span>
                  {task.githubPrNumber != null && <span>PR #{task.githubPrNumber}</span>}
                  {col && <span>Column: {col.title}</span>}
                  {assignee && (
                    <span className="inline-flex items-center gap-1">
                      <Avatar name={assignee.name} className="w-5 h-5 text-[8px]" />
                      {assignee.name}
                    </span>
                  )}
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {task.githubPrUrl && (
                  <a
                    href={task.githubPrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="kf-btn-secondary text-xs !py-1.5 !px-3 gap-1.5"
                  >
                    <ExternalLink size={13} />
                    GitHub
                  </a>
                )}
                {apiOnline && githubStatus.connected && task.githubPrNumber != null && (
                  <button
                    type="button"
                    onClick={() => onRefresh(task)}
                    disabled={busyId === task.id}
                    className="kf-btn-secondary text-xs !py-1.5 !px-3 gap-1.5 disabled:opacity-60"
                  >
                    {busyId === task.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    Sync
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
