import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  MessageSquare,
  Tag as TagIcon,
  Sparkles,
  Link as LinkIcon,
  Filter,
  Trash2,
  ChevronDown,
  Search,
  X,
  LayoutGrid,
  Rows3,
} from 'lucide-react';
import { cn, formatDate, getPriorityColor } from '../lib/utils';
import Avatar from './Avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { type Priority, type Task } from '../types';
import TaskModal from './TaskModal';
import InviteTeamModal from './InviteTeamModal';

// ── Board filter / view preferences ─────────────────────────────────────────

const VIEW_OPTIONS_KEY = 'kanflow:kanbanViewOptions';

type BoardSort = 'manual' | 'dueSoon' | 'priorityDesc';

interface BoardFilters {
  search: string;
  priority: { low: boolean; medium: boolean; high: boolean };
  assignee: 'any' | 'unassigned' | string;
  tagKeys: string[];
  hideCompleted: boolean;
  overdueOnly: boolean;
}

interface BoardViewOptions {
  cardDensity: 'comfortable' | 'compact';
  columnWidth: 'narrow' | 'medium' | 'wide';
  showTagsOnCards: boolean;
  showMetaOnCards: boolean;
  sortWithinColumn: BoardSort;
}

const DEFAULT_FILTERS: BoardFilters = {
  search: '',
  priority: { low: true, medium: true, high: true },
  assignee: 'any',
  tagKeys: [],
  hideCompleted: false,
  overdueOnly: false,
};

const DEFAULT_VIEW: BoardViewOptions = {
  cardDensity: 'comfortable',
  columnWidth: 'medium',
  showTagsOnCards: true,
  showMetaOnCards: true,
  sortWithinColumn: 'manual',
};

function filtersStorageKey(projectId: string) {
  return `kanflow:kanbanFilters:${projectId}`;
}

function loadViewOptions(): BoardViewOptions {
  if (typeof localStorage === 'undefined') return DEFAULT_VIEW;
  try {
    const raw = localStorage.getItem(VIEW_OPTIONS_KEY);
    if (!raw) return DEFAULT_VIEW;
    return { ...DEFAULT_VIEW, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_VIEW;
  }
}

function loadFiltersForProject(projectId: string): BoardFilters {
  if (typeof sessionStorage === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = sessionStorage.getItem(filtersStorageKey(projectId));
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<BoardFilters>;
    return {
      ...DEFAULT_FILTERS,
      ...parsed,
      priority: { ...DEFAULT_FILTERS.priority, ...parsed.priority },
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function taskMatchesFilters(
  task: Task,
  f: BoardFilters,
  doneColumnId: string | null,
  now: number,
  globalSearch: string,
): boolean {
  const qGlobal = globalSearch.trim().toLowerCase();
  if (qGlobal) {
    const hayG = `${task.title}\n${task.description}\n${task.tags.join(' ')}`.toLowerCase();
    if (!hayG.includes(qGlobal)) return false;
  }
  const q = f.search.trim().toLowerCase();
  if (q) {
    const hay = `${task.title}\n${task.description}\n${task.tags.join(' ')}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  const allPri = f.priority.low && f.priority.medium && f.priority.high;
  if (!allPri && !f.priority[task.priority]) return false;

  if (f.assignee === 'unassigned') {
    if (task.assigneeId) return false;
  } else if (f.assignee !== 'any') {
    if (task.assigneeId !== f.assignee) return false;
  }

  if (f.tagKeys.length > 0) {
    const has = f.tagKeys.some((tag) => task.tags.includes(tag));
    if (!has) return false;
  }

  if (f.hideCompleted && doneColumnId != null && task.status === doneColumnId) return false;

  if (f.overdueOnly) {
    const done = doneColumnId != null && task.status === doneColumnId;
    if (!task.dueDate || task.dueDate >= now || done) return false;
  }

  return true;
}

function sortColumnTasks(tasks: Task[], sort: BoardSort): Task[] {
  const arr = [...tasks];
  if (sort === 'manual') {
    arr.sort((a, b) => a.createdAt - b.createdAt);
    return arr;
  }
  if (sort === 'dueSoon') {
    arr.sort((a, b) => {
      const ad = a.dueDate ?? Number.POSITIVE_INFINITY;
      const bd = b.dueDate ?? Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return a.createdAt - b.createdAt;
    });
    return arr;
  }
  const rank = (p: Priority) => (p === 'high' ? 0 : p === 'medium' ? 1 : 2);
  arr.sort((a, b) => {
    const pr = rank(a.priority) - rank(b.priority);
    if (pr !== 0) return pr;
    return a.createdAt - b.createdAt;
  });
  return arr;
}

function filtersActive(f: BoardFilters, globalSearch: string): boolean {
  if (globalSearch.trim()) return true;
  if (f.search.trim()) return true;
  if (!f.priority.low || !f.priority.medium || !f.priority.high) return true;
  if (f.assignee !== 'any') return true;
  if (f.tagKeys.length > 0) return true;
  if (f.hideCompleted) return true;
  if (f.overdueOnly) return true;
  return false;
}

function countActiveFilterBits(f: BoardFilters, globalSearch: string): number {
  let n = 0;
  if (globalSearch.trim()) n++;
  if (f.search.trim()) n++;
  if (!f.priority.low || !f.priority.medium || !f.priority.high) n++;
  if (f.assignee !== 'any') n++;
  if (f.tagKeys.length > 0) n++;
  if (f.hideCompleted) n++;
  if (f.overdueOnly) n++;
  return n;
}

const COLUMN_WIDTH: Record<BoardViewOptions['columnWidth'], string> = {
  narrow: 'w-[min(100%,17rem)]',
  medium: 'w-[min(100%,20rem)]',
  wide: 'w-[min(100%,26rem)]',
};

export default function KanbanView() {
  const {
    tasks,
    projects,
    users,
    activeProjectId,
    addTask,
    deleteTask,
    globalSearchQuery,
    pendingOpenTaskId,
    clearPendingOpenTask,
  } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);
  const [viewOptions, setViewOptions] = useState<BoardViewOptions>(() => loadViewOptions());
  const filterWrapRef = useRef<HTMLDivElement>(null);
  const viewWrapRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const doneColumnId = useMemo(() => {
    if (!activeProject?.columns.length) return null;
    const sorted = [...activeProject.columns].sort((a, b) => a.order - b.order);
    return sorted[sorted.length - 1]?.id ?? null;
  }, [activeProject]);

  useEffect(() => {
    if (!activeProjectId) return;
    setFilters(loadFiltersForProject(activeProjectId));
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    try {
      sessionStorage.setItem(filtersStorageKey(activeProjectId), JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters, activeProjectId]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_OPTIONS_KEY, JSON.stringify(viewOptions));
    } catch {
      /* ignore */
    }
  }, [viewOptions]);

  useEffect(() => {
    if (!filterOpen && !viewOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (filterWrapRef.current?.contains(t) || viewWrapRef.current?.contains(t)) return;
      setFilterOpen(false);
      setViewOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterOpen, viewOpen]);

  useEffect(() => {
    if (!pendingOpenTaskId || !activeProjectId) return;
    const t = tasks.find((x) => x.id === pendingOpenTaskId);
    if (!t || t.projectId !== activeProjectId) return;
    setSelectedTaskId(pendingOpenTaskId);
    clearPendingOpenTask();
  }, [pendingOpenTaskId, activeProjectId, tasks, clearPendingOpenTask]);

  const now = Date.now();
  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === activeProjectId),
    [tasks, activeProjectId],
  );

  const filteredTasks = useMemo(
    () => projectTasks.filter((t) => taskMatchesFilters(t, filters, doneColumnId, now, globalSearchQuery)),
    [projectTasks, filters, doneColumnId, now, globalSearchQuery],
  );

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const t of projectTasks) for (const tag of t.tags) s.add(tag);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [projectTasks]);

  const teamMembers = useMemo(() => {
    if (!activeProject) return [];
    const ids = Array.from(new Set([activeProject.ownerId, ...(activeProject.memberIds ?? [])].filter(Boolean)));
    return ids
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is (typeof users)[number] => Boolean(u))
      .slice(0, 8);
  }, [activeProject, users]);

  const filterCount = countActiveFilterBits(filters, globalSearchQuery);
  const hasFilters = filtersActive(filters, globalSearchQuery);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const toggleTagFilter = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tagKeys: prev.tagKeys.includes(tag) ? prev.tagKeys.filter((x) => x !== tag) : [...prev.tagKeys, tag],
    }));
  }, []);

  if (!activeProject) {
    return (
      <div className="p-20 text-center text-kf-slate text-lg font-medium animate-pulse">
        Select or create a project to open the board.
      </div>
    );
  }

  const handleAddTask = (columnId: string) => {
    if (!newTaskTitle.trim()) return;
    addTask({
      title: newTaskTitle,
      description: '',
      status: columnId,
      priority: 'medium',
      projectId: activeProjectId!,
      tags: [],
      dependencies: [],
    });
    setNewTaskTitle('');
    setIsAddingTask(null);
  };

  return (
    <div className="h-full flex flex-col gap-6 md:gap-8 overflow-hidden">
      <div className="kf-section-dark rounded-[24px] px-6 py-8 md:px-10 md:py-10 shadow-inner relative">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div>
            <p className="text-sm text-kf-slate font-normal mb-2">Active project</p>
            <h2 className="text-2xl md:text-4xl font-medium tracking-tight text-kf-white">{activeProject.name}</h2>
            <p className="text-kf-slate mt-2 max-w-xl text-sm md:text-base leading-relaxed">{activeProject.description}</p>
            {hasFilters && (
              <p className="text-xs text-kf-white/70 mt-3 font-medium">
                Showing {filteredTasks.length} of {projectTasks.length} tasks in this project
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2 shrink-0">
            <div className="relative" ref={filterWrapRef}>
              <button
                type="button"
                aria-expanded={filterOpen}
                aria-haspopup="true"
                onClick={() => {
                  setViewOpen(false);
                  setFilterOpen((o) => !o);
                }}
                className={cn(
                  'kf-btn-secondary !text-kf-white/90 !border-white/20 hover:!bg-white/10 gap-2',
                  hasFilters && '!border-kf-meta-blue-light/60 !bg-white/10',
                )}
              >
                <Filter size={16} />
                Filter
                {filterCount > 0 && (
                  <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-kf-meta-blue-light text-kf-near-black text-[10px] font-bold flex items-center justify-center">
                    {filterCount}
                  </span>
                )}
              </button>
              {filterOpen && (
                <div
                  role="region"
                  aria-label="Board filters"
                  className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-kf-divider-gray bg-kf-white shadow-2xl p-4 text-kf-charcoal"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-kf-slate">Filters</span>
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className="p-1 rounded-lg text-kf-icon-secondary hover:bg-kf-warm-gray hover:text-kf-charcoal"
                      aria-label="Close filters"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <label className="block text-[11px] font-medium text-kf-slate mb-1.5">Search</label>
                  <div className="relative mb-4">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-kf-icon-secondary" />
                    <input
                      type="search"
                      className="kf-input text-sm w-full pl-9"
                      placeholder="Title, description, tags…"
                      value={filters.search}
                      onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                    />
                  </div>

                  <span className="block text-[11px] font-medium text-kf-slate mb-2">Priority</span>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(['low', 'medium', 'high'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            priority: { ...prev.priority, [p]: !prev.priority[p] },
                          }))
                        }
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition-colors',
                          filters.priority[p]
                            ? 'border-kf-meta-blue/40 bg-kf-baby-blue/50 text-kf-meta-blue'
                            : 'border-kf-divider-gray bg-kf-warm-gray text-kf-slate line-through decoration-kf-slate/50',
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <label className="block text-[11px] font-medium text-kf-slate mb-1">Assignee</label>
                  <select
                    className="kf-input text-sm w-full mb-4"
                    value={filters.assignee}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        assignee: e.target.value as BoardFilters['assignee'],
                      }))
                    }
                  >
                    <option value="any">Anyone</option>
                    <option value="unassigned">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>

                  {allTags.length > 0 && (
                    <>
                      <span className="block text-[11px] font-medium text-kf-slate mb-2">Tags (match any)</span>
                      <div className="flex flex-wrap gap-1.5 mb-4 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                        {allTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTagFilter(tag)}
                            className={cn(
                              'text-[10px] font-medium px-2 py-1 rounded-full border transition-colors',
                              filters.tagKeys.includes(tag)
                                ? 'border-kf-meta-blue bg-kf-meta-blue text-kf-white'
                                : 'border-kf-divider-gray bg-kf-soft-gray text-kf-slate hover:border-kf-meta-blue/30',
                            )}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <label className="flex items-center gap-2 text-sm text-kf-charcoal mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-kf-divider-gray text-kf-meta-blue focus:ring-kf-meta-blue/30"
                      checked={filters.hideCompleted}
                      onChange={(e) => setFilters((p) => ({ ...p, hideCompleted: e.target.checked }))}
                    />
                    Hide completed column tasks
                  </label>
                  <label className="flex items-center gap-2 text-sm text-kf-charcoal mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-kf-divider-gray text-kf-meta-blue focus:ring-kf-meta-blue/30"
                      checked={filters.overdueOnly}
                      onChange={(e) => setFilters((p) => ({ ...p, overdueOnly: e.target.checked }))}
                    />
                    Overdue only
                  </label>

                  <div className="flex gap-2 pt-2 border-t border-kf-divider-gray">
                    <button type="button" onClick={clearFilters} className="kf-btn-secondary text-xs !py-2 flex-1">
                      Reset filters
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className="kf-btn-primary text-xs !py-2 flex-1"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={viewWrapRef}>
              <button
                type="button"
                aria-expanded={viewOpen}
                aria-haspopup="true"
                onClick={() => {
                  setFilterOpen(false);
                  setViewOpen((o) => !o);
                }}
                className="kf-btn-primary !bg-kf-meta-blue-light !text-kf-near-black hover:!bg-kf-white gap-2"
              >
                <LayoutGrid size={16} />
                View
                <ChevronDown size={16} className={cn('transition-transform', viewOpen && 'rotate-180')} />
              </button>
              {viewOpen && (
                <div
                  role="region"
                  aria-label="Board view options"
                  className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,20rem)] rounded-2xl border border-kf-divider-gray bg-kf-white shadow-2xl p-4 text-kf-charcoal"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-kf-slate">View</span>
                    <button
                      type="button"
                      onClick={() => setViewOpen(false)}
                      className="p-1 rounded-lg text-kf-icon-secondary hover:bg-kf-warm-gray"
                      aria-label="Close view options"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <span className="block text-[11px] font-medium text-kf-slate mb-1.5">Card density</span>
                  <div className="flex rounded-xl border border-kf-divider-gray p-0.5 mb-4 bg-kf-soft-gray">
                    <button
                      type="button"
                      onClick={() => setViewOptions((v) => ({ ...v, cardDensity: 'comfortable' }))}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
                        viewOptions.cardDensity === 'comfortable'
                          ? 'bg-kf-white text-kf-charcoal shadow-sm'
                          : 'text-kf-slate hover:text-kf-charcoal',
                      )}
                    >
                      <Rows3 size={14} />
                      Comfortable
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewOptions((v) => ({ ...v, cardDensity: 'compact' }))}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
                        viewOptions.cardDensity === 'compact'
                          ? 'bg-kf-white text-kf-charcoal shadow-sm'
                          : 'text-kf-slate hover:text-kf-charcoal',
                      )}
                    >
                      <LayoutGrid size={14} />
                      Compact
                    </button>
                  </div>

                  <label className="block text-[11px] font-medium text-kf-slate mb-1">Column width</label>
                  <select
                    className="kf-input text-sm w-full mb-4"
                    value={viewOptions.columnWidth}
                    onChange={(e) =>
                      setViewOptions((v) => ({
                        ...v,
                        columnWidth: e.target.value as BoardViewOptions['columnWidth'],
                      }))
                    }
                  >
                    <option value="narrow">Narrow</option>
                    <option value="medium">Medium</option>
                    <option value="wide">Wide</option>
                  </select>

                  <label className="block text-[11px] font-medium text-kf-slate mb-1.5">Sort tasks in columns</label>
                  <select
                    className="kf-input text-sm w-full mb-4"
                    value={viewOptions.sortWithinColumn}
                    onChange={(e) =>
                      setViewOptions((v) => ({
                        ...v,
                        sortWithinColumn: e.target.value as BoardSort,
                      }))
                    }
                  >
                    <option value="manual">Manual (created order)</option>
                    <option value="dueSoon">Due date (soonest first)</option>
                    <option value="priorityDesc">Priority (high first)</option>
                  </select>

                  <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-kf-divider-gray text-kf-meta-blue"
                      checked={viewOptions.showTagsOnCards}
                      onChange={(e) => setViewOptions((v) => ({ ...v, showTagsOnCards: e.target.checked }))}
                    />
                    Show tags on cards
                  </label>
                  <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-kf-divider-gray text-kf-meta-blue"
                      checked={viewOptions.showMetaOnCards}
                      onChange={(e) => setViewOptions((v) => ({ ...v, showMetaOnCards: e.target.checked }))}
                    />
                    Show due date and activity row
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setViewOptions(DEFAULT_VIEW);
                      try {
                        localStorage.removeItem(VIEW_OPTIONS_KEY);
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="mt-3 w-full kf-btn-secondary text-xs !py-2"
                  >
                    Reset view to defaults
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {teamMembers.map((u) => (
              <Avatar
                key={u.id}
                name={u.name}
                className="w-9 h-9 text-xs border-2 border-kf-white shadow-sm"
              />
            ))}
            {teamMembers.length === 0 && (
              <span className="text-xs text-kf-slate px-2">No teammates yet</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="text-sm font-medium text-kf-meta-blue hover:text-kf-meta-blue-hover px-2 min-h-[44px]"
          >
            Invite teammates
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 md:gap-6 overflow-x-auto pb-4 items-start custom-scrollbar">
        {activeProject.columns.map((column) => {
          const columnTasks = sortColumnTasks(
            filteredTasks.filter((t) => t.status === column.id),
            viewOptions.sortWithinColumn,
          );
          const totalInColumn = projectTasks.filter((t) => t.status === column.id).length;

          return (
            <div
              key={column.id}
              className={cn(COLUMN_WIDTH[viewOptions.columnWidth], 'flex-shrink-0 flex flex-col max-h-full')}
            >
              <div className="flex items-center justify-between mb-4 group px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-medium text-sm text-kf-charcoal truncate">{column.title}</h3>
                  <span className="bg-kf-warm-gray text-kf-slate text-xs font-medium px-2.5 py-0.5 rounded-full border border-kf-divider-gray shrink-0">
                    {columnTasks.length}
                    {hasFilters && totalInColumn !== columnTasks.length ? (
                      <span className="text-kf-secondary-text font-normal">/{totalInColumn}</span>
                    ) : null}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-kf-icon-secondary opacity-0 group-hover:opacity-100 hover:text-kf-charcoal transition-all p-1 rounded-[8px]"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar min-h-[50px]">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    doneColumnId={doneColumnId}
                    density={viewOptions.cardDensity}
                    showTags={viewOptions.showTagsOnCards}
                    showMeta={viewOptions.showMetaOnCards}
                    onClick={() => setSelectedTaskId(task.id)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}

                {isAddingTask === column.id ? (
                  <div className="kf-card-elevated p-4 border-kf-meta-blue/25">
                    <input
                      autoFocus
                      className="kf-input mb-4 text-sm"
                      placeholder="Task title…"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask(column.id)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingTask(null)}
                        className="kf-btn-secondary text-sm !py-2 !px-4"
                      >
                        Cancel
                      </button>
                      <button type="button" onClick={() => handleAddTask(column.id)} className="kf-btn-primary text-sm !py-2 !px-4">
                        Add task
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(column.id)}
                    className="w-full py-3 min-h-[44px] flex items-center justify-center gap-2 text-sm font-medium text-kf-slate hover:bg-kf-white hover:text-kf-charcoal rounded-[20px] border border-dashed border-kf-divider-gray transition-all group/addbtn bg-kf-white/60"
                  >
                    <Plus size={18} className="group-hover/addbtn:scale-110 transition-transform" />
                    Add task
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          className={cn(
            COLUMN_WIDTH[viewOptions.columnWidth],
            'flex-shrink-0 min-h-[100px] flex items-center justify-center gap-2 text-sm font-medium text-kf-slate hover:bg-kf-white hover:border-kf-divider rounded-[20px] border border-dashed border-kf-divider-gray transition-all bg-kf-white/40',
          )}
        >
          <Plus size={18} />
          Add column
        </button>
      </div>

      <AnimatePresence>
        {selectedTaskId && <TaskModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
      </AnimatePresence>

      {activeProjectId && (
        <InviteTeamModal open={inviteOpen} onClose={() => setInviteOpen(false)} projectId={activeProjectId} />
      )}
    </div>
  );
}

function TaskCard({
  task,
  doneColumnId,
  onClick,
  onDelete,
  density = 'comfortable',
  showTags = true,
  showMeta = true,
}: {
  task: Task;
  doneColumnId: string | null;
  onClick: () => void;
  onDelete: () => void;
  density?: 'comfortable' | 'compact';
  showTags?: boolean;
  showMeta?: boolean;
}) {
  const { users, tasks } = useApp();
  const assignee = users.find((u) => u.id === task.assigneeId);
  const compact = density === 'compact';

  const blockedBy = tasks.filter(
    (t) => task.dependencies?.includes(t.id) && doneColumnId != null && t.status !== doneColumnId,
  );
  const isBlocked = blockedBy.length > 0;
  const isDone = doneColumnId != null && task.status === doneColumnId;

  return (
    <motion.div
      layoutId={task.id}
      onClick={onClick}
      className={cn(
        'kf-card-elevated cursor-grab active:cursor-grabbing group relative overflow-hidden border-kf-divider-gray',
        compact ? 'p-3' : 'p-4',
        isBlocked ? 'border-kf-error/40 opacity-90' : 'hover:border-kf-meta-blue/20',
      )}
    >
      {isBlocked && (
        <div className="absolute inset-0 bg-kf-white/70 flex items-center justify-center pointer-events-none group-hover:bg-kf-white/50 transition-all">
          <div className="bg-[rgba(255,123,145,0.15)] border border-kf-error/30 px-3 py-1.5 rounded-full flex items-center gap-2">
            <LinkIcon size={12} className="text-kf-error" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-kf-error">Blocked</span>
          </div>
        </div>
      )}

      {task.aiSuggested && (
        <div className="absolute top-0 right-0 p-1.5 bg-kf-baby-blue rounded-bl-[16px] border-l border-b border-kf-divider-gray">
          <Sparkles size={compact ? 12 : 14} className="text-kf-meta-blue" />
        </div>
      )}

      <div className={cn('flex items-start justify-between gap-2', compact ? 'mb-1.5' : 'mb-2')}>
        <span
          className={cn(
            'uppercase font-semibold tracking-wide rounded-full',
            compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1',
            getPriorityColor(task.priority),
          )}
        >
          {task.priority}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-kf-icon-secondary opacity-0 group-hover:opacity-100 hover:text-kf-error transition-all p-1 rounded-[8px]"
        >
          <Trash2 size={compact ? 12 : 14} />
        </button>
      </div>

      <h4
        className={cn(
          'font-medium group-hover:text-kf-meta-blue transition-colors text-kf-charcoal leading-snug',
          compact ? 'text-sm mb-2' : 'text-[15px] mb-3',
        )}
      >
        {task.title}
      </h4>

      {showTags && task.tags.length > 0 && (
        <div className={cn('flex flex-wrap gap-1.5', compact ? 'mb-2 gap-1' : 'mb-4 gap-1.5')}>
          {task.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                'flex items-center gap-1 bg-kf-baby-blue text-kf-meta-blue rounded-full font-medium border border-kf-meta-blue/10',
                compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1',
              )}
            >
              <TagIcon size={compact ? 8 : 10} />
              {tag}
            </span>
          ))}
        </div>
      )}

      {(showMeta || assignee) && (
        <div
          className={cn(
            'flex items-center justify-between text-kf-slate gap-2',
            showTags && task.tags.length > 0 && !compact ? '' : compact ? 'mt-0' : 'mt-0',
          )}
        >
          {showMeta ? (
            <div className="flex items-center gap-2 md:gap-3 flex-wrap min-w-0">
              {task.dueDate && (
                <div
                  className={cn(
                    'flex items-center gap-1 font-medium',
                    compact ? 'text-[10px]' : 'text-[11px]',
                    task.dueDate < Date.now() && !isDone ? 'text-kf-error' : '',
                  )}
                >
                  <Calendar size={compact ? 10 : 12} />
                  {formatDate(task.dueDate)}
                </div>
              )}
              {task.comments.length > 0 && (
                <div className={cn('flex items-center gap-1 font-medium', compact ? 'text-[10px]' : 'text-[11px]')}>
                  <MessageSquare size={compact ? 10 : 12} />
                  {task.comments.length}
                </div>
              )}
              {task.dependencies && task.dependencies.length > 0 && (
                <div
                  className={cn(
                    'flex items-center gap-1 font-medium text-kf-warning',
                    compact ? 'text-[10px]' : 'text-[11px]',
                  )}
                >
                  <LinkIcon size={compact ? 10 : 12} />
                  {task.dependencies.length} linked
                </div>
              )}
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          {assignee && (
            <Avatar
              name={assignee.name}
              className={cn(
                'border border-kf-divider-gray shadow-sm shrink-0',
                compact ? 'w-6 h-6 text-[8px]' : 'w-7 h-7 text-[10px]',
              )}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
