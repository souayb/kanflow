/**
 * Collaboration overview — AgentBoardMCP-inspired who-is-working view (MISSION §5.12).
 */

import React, { useMemo, useState } from 'react';
import { Users, AlertTriangle, Map as MapIcon, Activity, Bot, RefreshCw } from 'lucide-react';
import { useApp } from '../AppContext';
import Avatar from './Avatar';
import { cn } from '../lib/utils';
import type { OverlapFinding, WorkSession } from '../types';

const PHASE_LABEL: Record<string, string> = {
  exploring: 'Exploring',
  implementing: 'Building',
  testing: 'Testing',
  pr_open: 'PR open',
  review: 'In review',
  blocked: 'Blocked',
};

function folderOf(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 1) return '(top-level)';
  return parts[0]!;
}

function sessionFreshness(heartbeatAt: number): 'active' | 'stale' {
  const age = Date.now() - heartbeatAt;
  return age < 2 * 60 * 60 * 1000 ? 'active' : 'stale';
}

export default function CollaborationView() {
  const {
    users,
    tasks,
    workSessions,
    activityEvents,
    overlaps,
    activeProjectId,
    currentUser,
    refreshCollaboration,
    apiOnline,
  } = useApp();
  const [justMe, setJustMe] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const projectSessions = useMemo(
    () => workSessions.filter((s) => s.projectId === activeProjectId),
    [workSessions, activeProjectId],
  );

  const projectOverlaps = useMemo(() => {
    const ids = new Set(projectSessions.map((s) => s.id));
    return overlaps.filter((o) => ids.has(o.sessionId) && ids.has(o.otherSessionId));
  }, [overlaps, projectSessions]);

  const myOverlaps = useMemo(() => {
    if (!currentUser) return projectOverlaps;
    const mine = new Set(
      projectSessions.filter((s) => s.ownerUserId === currentUser.id).map((s) => s.id),
    );
    return projectOverlaps.filter((o) => mine.has(o.sessionId) || mine.has(o.otherSessionId));
  }, [projectOverlaps, projectSessions, currentUser]);

  const grouped = useMemo(() => {
    let list = projectSessions;
    if (justMe && currentUser) {
      const related = new Set<string>();
      for (const s of list.filter((x) => x.ownerUserId === currentUser.id)) {
        related.add(s.id);
        for (const o of projectOverlaps) {
          if (o.sessionId === s.id) related.add(o.otherSessionId);
          if (o.otherSessionId === s.id) related.add(o.sessionId);
        }
      }
      list = list.filter((s) => related.has(s.id) || s.ownerUserId === currentUser.id);
    }
    const byOwner = new Map<string, WorkSession[]>();
    for (const s of list) {
      const arr = byOwner.get(s.ownerUserId) ?? [];
      arr.push(s);
      byOwner.set(s.ownerUserId, arr);
    }
    return [...byOwner.entries()].sort((a, b) => {
      if (currentUser && a[0] === currentUser.id) return -1;
      if (currentUser && b[0] === currentUser.id) return 1;
      return 0;
    });
  }, [projectSessions, justMe, currentUser, projectOverlaps]);

  const repoMap = useMemo(() => {
    const folderOwners = new Map<string, Map<string, number>>();
    const conflictFolders = new Set<string>();
    for (const s of projectSessions) {
      if (sessionFreshness(s.heartbeatAt) !== 'active') continue;
      for (const path of [...s.touchedFiles, ...s.plannedFiles]) {
        const folder = folderOf(path);
        const owners = folderOwners.get(folder) ?? new Map();
        owners.set(s.ownerUserId, (owners.get(s.ownerUserId) ?? 0) + 1);
        folderOwners.set(folder, owners);
      }
    }
    for (const o of projectOverlaps) {
      if (o.kind !== 'file_overlap' || !o.paths) continue;
      for (const p of o.paths) conflictFolders.add(folderOf(p));
    }
    const ownerColors = new Map<string, string>();
    const palette = ['#E8F3FF', '#E8F8EF', '#F3E8FF', '#FFF3E0', '#FCE4EC'];
    let i = 0;
    for (const [ownerId] of grouped) {
      ownerColors.set(ownerId, palette[i % palette.length]!);
      i += 1;
    }
    return [...folderOwners.entries()].map(([folder, owners]) => {
      let topOwner = '';
      let topCount = 0;
      let total = 0;
      for (const [oid, c] of owners) {
        total += c;
        if (c > topCount) {
          topCount = c;
          topOwner = oid;
        }
      }
      return {
        folder,
        topOwner,
        total,
        conflict: conflictFolders.has(folder),
        color: ownerColors.get(topOwner) ?? '#F1F4F7',
        owners: [...owners.entries()],
      };
    });
  }, [projectSessions, projectOverlaps, grouped]);

  const liveEvents = useMemo(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    return activityEvents
      .filter((e) => e.projectId === activeProjectId && e.createdAt >= cutoff)
      .slice(0, 20);
  }, [activityEvents, activeProjectId]);

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';
  const taskTitle = (id?: string) => (id ? tasks.find((t) => t.id === id)?.title : undefined);

  const conflictDetail = (o: OverlapFinding) => {
    const a = projectSessions.find((s) => s.id === o.sessionId);
    const b = projectSessions.find((s) => s.id === o.otherSessionId);
    const an = a ? userName(a.ownerUserId) : '?';
    const bn = b ? userName(b.ownerUserId) : '?';
    if (o.kind === 'file_overlap' && o.paths?.length) {
      return `You and ${bn === userName(currentUser?.id ?? '') ? an : bn} would conflict in ${o.paths[0]}${o.paths.length > 1 ? ` (+${o.paths.length - 1})` : ''}`;
    }
    return o.detail || `${an} ↔ ${bn}`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCollaboration();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-kf-charcoal">Collaboration</h1>
          <p className="text-kf-slate text-sm mt-2">
            Who is working on what — humans and agents, with file-level overlap warnings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-kf-slate cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-kf-divider-gray text-kf-meta-blue"
              checked={justMe}
              onChange={(e) => setJustMe(e.target.checked)}
            />
            Just me
          </label>
          {apiOnline && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="kf-btn-secondary text-xs !py-1.5 !px-3 gap-1.5"
            >
              <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {myOverlaps.length > 0 && (
        <section className="mb-8 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-kf-slate mb-3">Needs you</h2>
          {myOverlaps.map((o, idx) => (
            <div
              key={`${o.sessionId}-${o.otherSessionId}-${idx}`}
              className="flex items-start gap-3 rounded-xl border border-kf-error/30 bg-[rgba(255,123,145,0.12)] px-4 py-3"
            >
              <AlertTriangle size={18} className="text-kf-error shrink-0 mt-0.5" />
              <div className="text-sm text-kf-charcoal">{conflictDetail(o)}</div>
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="font-medium text-sm text-kf-charcoal mb-4 flex items-center gap-2">
            <Users size={18} className="text-kf-meta-blue" strokeWidth={1.75} />
            Who is working on what
            <span className="text-xs text-kf-slate font-normal">
              · {projectSessions.filter((s) => sessionFreshness(s.heartbeatAt) === 'active').length} active
            </span>
          </h2>
          <div className="space-y-5">
            {grouped.length === 0 && (
              <p className="text-sm text-kf-slate">No active work sessions for this project.</p>
            )}
            {grouped.map(([ownerId, sessions]) => {
              const owner = users.find((u) => u.id === ownerId);
              const label =
                currentUser?.id === ownerId ? `You (${owner?.name?.split(' ')[0] ?? 'me'})` : owner?.name ?? 'Unknown';
              return (
                <div key={ownerId} className="kf-card-elevated p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={owner?.name ?? '?'} className="w-8 h-8 text-xs" />
                    <span className="text-sm font-medium text-kf-charcoal">{label}</span>
                  </div>
                  {sessions.map((s) => {
                    const task = taskTitle(s.taskId);
                    const conflicts = projectOverlaps.filter(
                      (o) => o.sessionId === s.id || o.otherSessionId === s.id,
                    );
                    const linkedTask = s.taskId ? tasks.find((t) => t.id === s.taskId) : undefined;
                    return (
                      <div key={s.id} className="pl-2 border-l-2 border-kf-divider-gray space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {s.actorKind === 'agent' && (
                            <Bot size={14} className="text-kf-meta-blue" aria-label="Agent" />
                          )}
                          <span className="text-sm text-kf-charcoal">{s.intent || task || 'Untitled work'}</span>
                          <span className="text-[10px] uppercase tracking-wide font-semibold text-kf-slate bg-kf-warm-gray px-2 py-0.5 rounded-full">
                            {PHASE_LABEL[s.phase] ?? s.phase}
                          </span>
                          {sessionFreshness(s.heartbeatAt) === 'stale' && (
                            <span className="text-[10px] text-kf-slate">stale</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-kf-meta-blue">
                          {linkedTask?.githubPrNumber != null && (
                            <a
                              href={linkedTask.githubPrUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              #{linkedTask.githubPrNumber}{' '}
                              {linkedTask.githubPrState === 'approved'
                                ? 'approved'
                                : linkedTask.githubPrState === 'changes'
                                  ? 'changes requested'
                                  : 'in review'}
                            </a>
                          )}
                          {linkedTask?.githubIssueNumber != null && (
                            <a
                              href={linkedTask.githubIssueUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              Issue #{linkedTask.githubIssueNumber}
                            </a>
                          )}
                          {s.tool && <span className="text-kf-slate">via {s.tool}</span>}
                        </div>
                        {conflicts.length > 0 && (
                          <p className="text-xs text-kf-error">
                            Conflicts with{' '}
                            {conflicts
                              .map((c) => {
                                const otherId = c.sessionId === s.id ? c.otherSessionId : c.sessionId;
                                const other = projectSessions.find((x) => x.id === otherId);
                                return other ? userName(other.ownerUserId) : '?';
                              })
                              .filter((n, i, arr) => arr.indexOf(n) === i)
                              .join(', ')}
                          </p>
                        )}
                        {s.touchedFiles.length > 0 && (
                          <p className="text-[11px] text-kf-slate truncate">
                            {s.touchedFiles.slice(0, 3).join(', ')}
                            {s.touchedFiles.length > 3 ? ` +${s.touchedFiles.length - 3}` : ''}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <h3 className="font-medium text-sm text-kf-charcoal mb-3 flex items-center gap-2">
              <Activity size={16} className="text-kf-meta-blue" />
              Live
            </h3>
            <div className="space-y-3">
              {liveEvents.length === 0 && (
                <p className="text-xs text-kf-slate">No activity in the last two hours.</p>
              )}
              {liveEvents.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <Avatar name={userName(e.actorId)} className="w-8 h-8 text-[10px] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-kf-charcoal truncate">{e.message}</div>
                    <div className="text-xs text-kf-slate mt-0.5">
                      {e.actorKind === 'agent' ? 'Agent · ' : ''}
                      {Math.max(1, Math.round((Date.now() - e.createdAt) / 60000))} min ago
                      {e.path ? ` · ${e.path}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-medium text-sm text-kf-charcoal mb-4 flex items-center gap-2">
            <MapIcon size={18} className="text-kf-meta-blue" strokeWidth={1.75} />
            Where in the repository
          </h2>
          <p className="text-xs text-kf-slate mb-4">
            Colour: who changes the most there. Stronger: more files. Red border: conflict.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {repoMap.length === 0 && (
              <p className="text-sm text-kf-slate col-span-2">No touched files on active sessions yet.</p>
            )}
            {repoMap.map((cell) => (
              <div
                key={cell.folder}
                className={cn(
                  'rounded-xl p-4 min-h-[88px] border',
                  cell.conflict ? 'border-kf-error' : 'border-kf-divider-gray',
                )}
                style={{ backgroundColor: cell.color }}
              >
                <div className="text-sm font-medium text-kf-charcoal truncate">{cell.folder}</div>
                <div className="text-xs text-kf-slate mt-1">{cell.total} touched</div>
                <div className="text-[11px] text-kf-slate mt-2 truncate">
                  {userName(cell.topOwner)}
                  {cell.conflict ? ' · conflict' : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
