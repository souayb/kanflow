import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  type Project,
  type Task,
  type Column,
  type User,
  type Notification,
  type PersonalTodo,
  type TimeEntry,
  type DashboardWidget,
  type Comment,
  type IntegrationSettings,
  type DashboardChartWindowDays,
  type WorkSession,
  type ActivityEvent,
  type OverlapFinding,
  type ActorKind,
  type WorkSessionPhase,
  type WorkSessionTool,
  DEFAULT_INTEGRATION_SETTINGS,
} from './types';
import {
  MOCK_PROJECTS,
  MOCK_TASKS,
  MOCK_USERS,
  MOCK_USER_ALEX,
  MOCK_WORK_SESSIONS,
  MOCK_ACTIVITY_EVENTS,
} from './constants';
import { KANFLOW_KEYS, migrateZenithToKanflow, readStoredJson, writeStoredJson } from './lib/storage';
import {
  api,
  type ApiTask,
  type ApiProject,
  type ApiColumn,
  type ApiUserRow,
  type ApiWorkSession,
  type ApiActivityEvent,
  type GithubIntegrationStatus,
} from './lib/api';

interface AppContextType {
  projects: Project[];
  tasks: Task[];
  users: User[];
  notifications: Notification[];
  personalTodos: PersonalTodo[];
  timeEntries: TimeEntry[];
  dashboardWidgets: DashboardWidget[];
  workSessions: WorkSession[];
  activityEvents: ActivityEvent[];
  overlaps: OverlapFinding[];
  activeProjectId: string | null;
  apiOnline: boolean;
  githubStatus: GithubIntegrationStatus;
  refreshGithubStatus: () => Promise<void>;
  setActiveProjectId: (id: string | null) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'position'> & { position?: number }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  createTaskBranch: (taskId: string) => Promise<void>;
  createTaskPr: (taskId: string) => Promise<void>;
  linkTaskPr: (taskId: string, number: number) => Promise<void>;
  refreshTaskPr: (taskId: string) => Promise<void>;
  refreshCollaboration: () => Promise<void>;
  claimWorkSession: (input: {
    intent: string;
    taskId?: string;
    actorKind?: ActorKind;
    tool?: WorkSessionTool;
    phase?: WorkSessionPhase;
    touchedFiles?: string[];
    plannedFiles?: string[];
    branchName?: string;
  }) => Promise<void>;
  releaseWorkSession: (sessionId: string) => Promise<void>;
  addComment: (taskId: string, userId: string, content: string) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  addDependency: (taskId: string, dependencyId: string) => void;
  addPersonalTodo: (content: string, linkedTaskId?: string) => void;
  togglePersonalTodo: (id: string) => void;
  updatePersonalTodo: (id: string, updates: Partial<PersonalTodo>) => void;
  deletePersonalTodo: (id: string) => void;
  startTimeLog: (taskId: string, description: string) => void;
  stopTimeLog: (taskId: string) => void;
  getTimeEntriesForTask: (taskId: string) => TimeEntry[];
  updateDashboardWidgets: (widgets: DashboardWidget[]) => void;
  updateUser: (updates: Partial<Pick<User, 'name' | 'avatar' | 'privacy'>>) => Promise<void>;
  /** Inserts into Postgres (admin realm role) and refreshes the in-memory user directory. */
  createUserAdmin: (body: { name: string; email: string; role?: string }) => Promise<ApiUserRow>;
  activeTimer: { taskId: string; startTime: number } | null;
  currentUser: User | null;
  addProject: (name: string, description: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description'>>) => void;
  deleteProject: (id: string) => void;
  addProjectTeamMember: (projectId: string, userId: string) => Promise<void>;
  removeProjectTeamMember: (projectId: string, userId: string) => Promise<void>;
  /** Header search — filters tasks across projects in the layout dropdown. */
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  /** Switch to Board and open the task modal for this task id. */
  openTaskOnBoard: (taskId: string) => void;
  /** Clears the pending task id after Kanban has opened the modal. */
  clearPendingOpenTask: () => void;
  /** Increments when navigation to board is requested (App listens to switch view). */
  boardNavSeq: number;
  pendingOpenTaskId: string | null;
  integrationSettings: IntegrationSettings;
  setIntegrationSettings: (patch: Partial<IntegrationSettings> | ((prev: IntegrationSettings) => IntegrationSettings)) => void;
  dashboardChartDays: DashboardChartWindowDays;
  setDashboardChartDays: (d: DashboardChartWindowDays) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: '1', type: 'overview', title: 'Project Overview', enabled: true, order: 0 },
  { id: '2', type: 'activity', title: 'Recent Activity', enabled: true, order: 1 },
  { id: '3', type: 'performance', title: 'Performance', enabled: true, order: 2 },
  { id: '4', type: 'upcoming', title: 'High priority tasks', enabled: true, order: 3 },
  { id: '5', type: 'ai_insights', title: 'Kanflow AI insights', enabled: true, order: 4 },
];

const DEFAULT_NEW_PROJECT_COLUMN_TITLES = ['To Do', 'In Progress', 'Review', 'Done'] as const;

// ── API ↔ local type converters ────────────────────────────────────────────

function apiTaskToTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId,
    dueDate: t.dueDate,
    projectId: t.projectId,
    tags: t.tags ?? [],
    position: t.position ?? 0,
    comments: (t.comments ?? []).map((c) => ({
      id: c.id,
      userId: c.userId,
      userName: c.userName,
      content: c.content,
      createdAt: c.createdAt,
    })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    dependencies: t.dependencies ?? [],
    aiSuggested: t.aiSuggested,
    aiThinking: t.aiThinking,
    githubIssueNumber: t.githubIssueNumber,
    githubIssueUrl: t.githubIssueUrl,
    githubBranchName: t.githubBranchName,
    githubBranchUrl: t.githubBranchUrl,
    githubPrNumber: t.githubPrNumber,
    githubPrUrl: t.githubPrUrl,
    githubPrState: t.githubPrState,
  };
}

function apiSessionToSession(s: ApiWorkSession): WorkSession {
  return {
    id: s.id,
    projectId: s.projectId,
    taskId: s.taskId,
    ownerUserId: s.ownerUserId,
    actorKind: s.actorKind,
    tool: s.tool as WorkSessionTool | undefined,
    intent: s.intent,
    phase: s.phase as WorkSessionPhase,
    touchedFiles: s.touchedFiles ?? [],
    plannedFiles: s.plannedFiles ?? [],
    branchName: s.branchName,
    heartbeatAt: s.heartbeatAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function apiActivityToActivity(e: ApiActivityEvent): ActivityEvent {
  return {
    id: e.id,
    projectId: e.projectId,
    actorId: e.actorId,
    actorKind: e.actorKind,
    action: e.action as ActivityEvent['action'],
    taskId: e.taskId,
    path: e.path,
    message: e.message,
    createdAt: e.createdAt,
  };
}

function computeLocalOverlaps(sessions: WorkSession[], tasks: Task[]): OverlapFinding[] {
  const now = Date.now();
  const active = sessions.filter((s) => now - s.heartbeatAt < 2 * 60 * 60 * 1000);
  const issueByTask = new Map(
    tasks.filter((t) => t.githubIssueNumber != null).map((t) => [t.id, t.githubIssueNumber!]),
  );
  const out: OverlapFinding[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      const pa = new Set([...a.touchedFiles, ...a.plannedFiles]);
      const pb = new Set([...b.touchedFiles, ...b.plannedFiles]);
      const shared = [...pa].filter((p) => pb.has(p));
      if (shared.length) {
        out.push({
          kind: 'file_overlap',
          sessionId: a.id,
          otherSessionId: b.id,
          detail: `${shared.length} shared path(s)`,
          paths: shared,
        });
      }
      if (a.branchName && a.branchName === b.branchName) {
        out.push({
          kind: 'shared_branch',
          sessionId: a.id,
          otherSessionId: b.id,
          detail: `Same branch ${a.branchName}`,
        });
      }
      if (a.taskId && b.taskId) {
        const ia = issueByTask.get(a.taskId);
        const ib = issueByTask.get(b.taskId);
        if (ia != null && ia === ib) {
          out.push({
            kind: 'issue_collision',
            sessionId: a.id,
            otherSessionId: b.id,
            detail: `Same GitHub issue #${ia}`,
            issueNumber: ia,
          });
        }
      }
    }
  }
  return out;
}

function apiColumnToColumn(c: ApiColumn): Column {
  return { id: c.id, title: c.title, order: c.order };
}

function apiProjectToProject(p: ApiProject, columns: ApiColumn[] = []): Project {
  const ownerId = (p.ownerId && p.ownerId.trim()) || MOCK_USER_ALEX;
  const apiMembers = (p.memberIds ?? []).filter(Boolean);
  const memberIds =
    apiMembers.length > 0 ? Array.from(new Set(apiMembers)) : [ownerId];
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    columns: columns.map(apiColumnToColumn).sort((a, b) => a.order - b.order),
    createdAt: Date.now(),
    ownerId,
    memberIds,
  };
}

// ── localStorage bootstrap ─────────────────────────────────────────────────

function loadCachedState() {
  if (typeof window === 'undefined') {
    return {
      projects: MOCK_PROJECTS,
      tasks: MOCK_TASKS,
      notifications: [] as Notification[],
      personalTodos: [] as PersonalTodo[],
      timeEntries: [] as TimeEntry[],
      dashboardWidgets: DEFAULT_WIDGETS,
      workSessions: MOCK_WORK_SESSIONS,
      activityEvents: MOCK_ACTIVITY_EVENTS,
      activeProjectId: MOCK_PROJECTS[0]?.id ?? null,
      currentUser: MOCK_USERS[0] ?? null,
      integrationSettings: DEFAULT_INTEGRATION_SETTINGS,
      dashboardChartDays: 7 as DashboardChartWindowDays,
    };
  }

  migrateZenithToKanflow();

  const rawProjects = readStoredJson<Project[]>(KANFLOW_KEYS.projects) ?? MOCK_PROJECTS;
  const projects = rawProjects.map((p) => ({
    ...p,
    memberIds:
      p.memberIds && p.memberIds.length > 0
        ? Array.from(new Set(p.memberIds))
        : [p.ownerId || MOCK_USER_ALEX],
  }));
  const tasks = readStoredJson<Task[]>(KANFLOW_KEYS.tasks) ?? MOCK_TASKS;
  const notifications = readStoredJson<Notification[]>(KANFLOW_KEYS.notifications) ?? [];
  const personalTodos = readStoredJson<PersonalTodo[]>(KANFLOW_KEYS.todos) ?? [];
  const timeEntries = readStoredJson<TimeEntry[]>(KANFLOW_KEYS.timeEntries) ?? [];
  const dashboardWidgets = readStoredJson<DashboardWidget[]>(KANFLOW_KEYS.dashboardWidgets) ?? DEFAULT_WIDGETS;
  const workSessions = readStoredJson<WorkSession[]>(KANFLOW_KEYS.workSessions) ?? MOCK_WORK_SESSIONS;
  const activityEvents = readStoredJson<ActivityEvent[]>(KANFLOW_KEYS.activityEvents) ?? MOCK_ACTIVITY_EVENTS;
  const currentUser = readStoredJson<User>(KANFLOW_KEYS.user) ?? MOCK_USERS[0] ?? null;

  let activeProjectId = localStorage.getItem(KANFLOW_KEYS.activeProjectId);
  if (!activeProjectId || !projects.some((p) => p.id === activeProjectId)) {
    activeProjectId = projects[0]?.id ?? null;
  }

  const integrations =
    readStoredJson<IntegrationSettings>(KANFLOW_KEYS.integrations) ?? DEFAULT_INTEGRATION_SETTINGS;
  const mergedIntegrations: IntegrationSettings = {
    ...DEFAULT_INTEGRATION_SETTINGS,
    ...integrations,
    calendar: { ...DEFAULT_INTEGRATION_SETTINGS.calendar, ...integrations.calendar },
  };

  const rawDays = localStorage.getItem(KANFLOW_KEYS.dashboardChartDays);
  const dashboardChartDays: DashboardChartWindowDays =
    rawDays === '14' || rawDays === '30' ? (Number(rawDays) as DashboardChartWindowDays) : 7;

  // Ensure plan tickets exist even when older localStorage caches omit them.
  const taskIds = new Set(tasks.map((t) => t.id));
  const withTickets = [
    ...tasks,
    ...MOCK_TASKS.filter((t) => !taskIds.has(t.id) && (t.id === 'd1000000-0000-4000-8000-000000000004' || t.id === 'd1000000-0000-4000-8000-000000000005')),
  ];

  return {
    projects,
    tasks: withTickets,
    notifications,
    personalTodos,
    timeEntries,
    dashboardWidgets,
    workSessions,
    activityEvents,
    activeProjectId,
    currentUser,
    integrationSettings: mergedIntegrations,
    dashboardChartDays,
  };
}

// ── Provider ───────────────────────────────────────────────────────────────

export function AppProvider({ children, kcUser }: { children: React.ReactNode; kcUser?: User | null }) {
  const initial = loadCachedState();
  const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [notifications, setNotifications] = useState<Notification[]>(initial.notifications);
  const [personalTodos, setPersonalTodos] = useState<PersonalTodo[]>(initial.personalTodos);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initial.timeEntries);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(initial.dashboardWidgets);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>(initial.workSessions);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(initial.activityEvents);
  const [overlaps, setOverlaps] = useState<OverlapFinding[]>(() =>
    computeLocalOverlaps(initial.workSessions, initial.tasks),
  );
  const [activeTimer, setActiveTimer] = useState<{ taskId: string; startTime: number } | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initial.activeProjectId);
  // Prefer the Keycloak-authenticated user; fall back to localStorage/mock
  const [currentUser, setCurrentUser] = useState<User | null>(kcUser ?? initial.currentUser);
  const [apiOnline, setApiOnline] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GithubIntegrationStatus>({ connected: false });
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [pendingOpenTaskId, setPendingOpenTaskId] = useState<string | null>(null);
  const [boardNavSeq, setBoardNavSeq] = useState(0);
  const [integrationSettings, setIntegrationSettingsState] = useState<IntegrationSettings>(initial.integrationSettings);
  const [dashboardChartDays, setDashboardChartDaysState] = useState<DashboardChartWindowDays>(initial.dashboardChartDays);

  // Keycloak owns identity; preserve app-owned profile/privacy fields on token refresh.
  useEffect(() => {
    if (kcUser) {
      setCurrentUser((previous) => ({
        ...previous,
        ...kcUser,
        avatar: previous?.avatar,
        privacy: previous?.privacy,
      }));
    }
  }, [kcUser]);

  const refreshGithubStatus = useCallback(async () => {
    try {
      setGithubStatus(await api.getGithubStatus());
    } catch {
      setGithubStatus({ connected: false });
    }
  }, []);

  useEffect(() => {
    void refreshGithubStatus();
  }, [refreshGithubStatus, apiOnline]);

  // ── Bootstrap from API ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ projects: apiProjects }, usersRes, meRes] = await Promise.all([
          api.getProjects(),
          api.getUsers().catch(() => ({ users: [] as ApiUserRow[] })),
          api.getMe().catch(() => null),
        ]);
        if (cancelled) return;

        if (usersRes.users.length > 0) {
          setUsers(
            usersRes.users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              avatar: u.avatar,
              privacy: u.privacy,
            })),
          );
        }
        if (meRes?.user) {
          setCurrentUser((previous) => ({
            ...previous,
            ...meRes.user,
            privacy: meRes.user.privacy ?? previous?.privacy,
          }));
        }

        const hydratedProjects: Project[] = await Promise.all(
          apiProjects.map(async (p) => {
            try {
              const { columns } = await api.getColumns(p.id);
              return apiProjectToProject(p, columns);
            } catch {
              return apiProjectToProject(p, []);
            }
          }),
        );

        const allTasks: Task[] = (
          await Promise.all(
            apiProjects.map(async (p) => {
              try {
                const { tasks: ts } = await api.getTasks(p.id);
                return ts.map(apiTaskToTask);
              } catch {
                return [];
              }
            }),
          )
        ).flat();

        if (cancelled) return;

        // Empty API result must not wipe local mock / cached projects (MISSION — offline-tolerant).
        if (hydratedProjects.length === 0) {
          setApiOnline(true);
          return;
        }

        setProjects((prev) =>
          hydratedProjects.map((merged) => {
            const old = prev.find((o) => o.id === merged.id);
            const memberIds =
              merged.memberIds && merged.memberIds.length > 0
                ? merged.memberIds
                : old?.memberIds && old.memberIds.length > 0
                  ? old.memberIds
                  : [merged.ownerId || MOCK_USER_ALEX];
            return {
              ...merged,
              ownerId: merged.ownerId || MOCK_USER_ALEX,
              memberIds: Array.from(new Set(memberIds)),
            };
          }),
        );
        setTasks(allTasks);
        setApiOnline(true);

        if (!activeProjectId || !hydratedProjects.some((p) => p.id === activeProjectId)) {
          setActiveProjectId(hydratedProjects[0]?.id ?? null);
        }
      } catch {
        // API unavailable — keep localStorage data
        setApiOnline(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist to localStorage on change ───────────────────────────────────
  useEffect(() => { writeStoredJson(KANFLOW_KEYS.projects, projects); }, [projects]);
  useEffect(() => { writeStoredJson(KANFLOW_KEYS.tasks, tasks); }, [tasks]);
  useEffect(() => { writeStoredJson(KANFLOW_KEYS.notifications, notifications); }, [notifications]);
  useEffect(() => { writeStoredJson(KANFLOW_KEYS.todos, personalTodos); }, [personalTodos]);
  useEffect(() => { writeStoredJson(KANFLOW_KEYS.timeEntries, timeEntries); }, [timeEntries]);
  useEffect(() => { writeStoredJson(KANFLOW_KEYS.dashboardWidgets, dashboardWidgets); }, [dashboardWidgets]);
  useEffect(() => { writeStoredJson(KANFLOW_KEYS.workSessions, workSessions); }, [workSessions]);
  useEffect(() => { writeStoredJson(KANFLOW_KEYS.activityEvents, activityEvents); }, [activityEvents]);
  useEffect(() => { if (currentUser) writeStoredJson(KANFLOW_KEYS.user, currentUser); }, [currentUser]);
  useEffect(() => {
    if (activeProjectId) localStorage.setItem(KANFLOW_KEYS.activeProjectId, activeProjectId);
    else localStorage.removeItem(KANFLOW_KEYS.activeProjectId);
  }, [activeProjectId]);

  // ── Notification helper ──────────────────────────────────────────────────
  const addNotification = useCallback((n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newN: Notification = {
      ...n,
      id: Math.random().toString(36).substring(2, 11),
      createdAt: Date.now(),
      read: false,
    };
    setNotifications((prev) => [newN, ...prev]);
  }, []);

  // ── Task mutations ───────────────────────────────────────────────────────
  const addTask = useCallback(
    (
      taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'position'> & {
        position?: number;
      },
    ) => {
      const tempId = Math.random().toString(36).substring(2, 11);
      const now = Date.now();
      const position =
        taskData.position ??
        Math.max(0, ...tasks.filter((t) => t.status === taskData.status).map((t) => t.position)) + 1000;
      const newTask: Task = {
        ...taskData,
        id: tempId,
        position,
        createdAt: now,
        updatedAt: now,
        comments: [],
        dependencies: taskData.dependencies ?? [],
      };
      setTasks((prev) => [...prev, newTask]);

      addNotification({
        userId: currentUser?.id ?? MOCK_USER_ALEX,
        title: 'New task created',
        message: `Task "${newTask.title}" has been added to the project.`,
        type: 'task_update',
        relatedId: tempId,
      });

      if (apiOnline) {
        api
          .createTask(taskData.projectId, {
            title: taskData.title,
            description: taskData.description ?? '',
            priority: taskData.priority,
            status: taskData.status,
            projectId: taskData.projectId,
            tags: taskData.tags ?? [],
            dependencies: taskData.dependencies ?? [],
            assigneeId: taskData.assigneeId,
            dueDate: taskData.dueDate,
            position,
          })
          .then(({ task }) => {
            setTasks((prev) =>
              prev.map((local) =>
                local.id === tempId
                  ? {
                      ...apiTaskToTask(task),
                      comments: local.comments,
                      dependencies: local.dependencies,
                    }
                  : local,
              ),
            );
          })
          .catch(() => {/* keep optimistic state */});
      }
    },
    [apiOnline, addNotification, currentUser, tasks],
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)),
      );

      if (apiOnline) {
        api.updateTask(id, updates as Parameters<typeof api.updateTask>[1]).catch(() => {});
      }
    },
    [apiOnline],
  );

  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (apiOnline) {
        api.deleteTask(id).catch(() => {});
      }
    },
    [apiOnline],
  );

  const createTaskBranch = useCallback(async (taskId: string) => {
    const { task } = await api.createTaskBranch(taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? apiTaskToTask(task) : t)));
  }, []);

  const createTaskPr = useCallback(async (taskId: string) => {
    const { task } = await api.createTaskPr(taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? apiTaskToTask(task) : t)));
  }, []);

  const linkTaskPr = useCallback(async (taskId: string, number: number) => {
    const { task } = await api.linkTaskPr(taskId, number);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? apiTaskToTask(task) : t)));
  }, []);

  const refreshTaskPr = useCallback(async (taskId: string) => {
    const { task } = await api.refreshTaskPr(taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? apiTaskToTask(task) : t)));
  }, []);

  const pushLocalActivity = useCallback(
    (partial: Omit<ActivityEvent, 'id' | 'createdAt'>) => {
      const event: ActivityEvent = {
        ...partial,
        id: Math.random().toString(36).substring(2, 11),
        createdAt: Date.now(),
      };
      setActivityEvents((prev) => [event, ...prev].slice(0, 200));
    },
    [],
  );

  const refreshCollaboration = useCallback(async () => {
    if (!activeProjectId) return;
    if (!apiOnline) {
      setOverlaps(computeLocalOverlaps(workSessions, tasks));
      return;
    }
    try {
      const [sess, act] = await Promise.all([
        api.listSessions(activeProjectId),
        api.listActivity(activeProjectId),
      ]);
      setWorkSessions(sess.sessions.map(apiSessionToSession));
      setOverlaps(
        (sess.overlaps ?? []).map((o) => ({
          kind: o.kind,
          sessionId: o.sessionId,
          otherSessionId: o.otherSessionId,
          detail: o.detail,
          paths: o.paths,
          issueNumber: o.issueNumber,
        })),
      );
      setActivityEvents(act.events.map(apiActivityToActivity));
    } catch {
      setOverlaps(computeLocalOverlaps(workSessions, tasks));
    }
  }, [activeProjectId, apiOnline, workSessions, tasks]);

  useEffect(() => {
    if (!activeProjectId) return;
    void refreshCollaboration();
    // Intentionally when project / online flips — not on every session edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, apiOnline]);

  const claimWorkSession = useCallback(
    async (input: {
      intent: string;
      taskId?: string;
      actorKind?: ActorKind;
      tool?: WorkSessionTool;
      phase?: WorkSessionPhase;
      touchedFiles?: string[];
      plannedFiles?: string[];
      branchName?: string;
    }) => {
      if (!activeProjectId || !currentUser) return;
      if (apiOnline) {
        const { session } = await api.claimSession(activeProjectId, {
          ownerUserId: currentUser.id,
          actorKind: input.actorKind ?? 'human',
          tool: input.tool,
          intent: input.intent,
          phase: input.phase ?? 'implementing',
          taskId: input.taskId,
          touchedFiles: input.touchedFiles,
          plannedFiles: input.plannedFiles,
          branchName: input.branchName,
        });
        setWorkSessions((prev) => {
          const next = [apiSessionToSession(session), ...prev.filter((s) => s.id !== session.id)];
          setOverlaps(computeLocalOverlaps(next, tasks));
          return next;
        });
        await refreshCollaboration();
        return;
      }
      const now = Date.now();
      const session: WorkSession = {
        id: Math.random().toString(36).substring(2, 11),
        projectId: activeProjectId,
        taskId: input.taskId,
        ownerUserId: currentUser.id,
        actorKind: input.actorKind ?? 'human',
        tool: input.tool ?? 'human',
        intent: input.intent,
        phase: input.phase ?? 'implementing',
        touchedFiles: input.touchedFiles ?? [],
        plannedFiles: input.plannedFiles ?? [],
        branchName: input.branchName,
        heartbeatAt: now,
        createdAt: now,
        updatedAt: now,
      };
      setWorkSessions((prev) => {
        const next = [session, ...prev];
        setOverlaps(computeLocalOverlaps(next, tasks));
        return next;
      });
      pushLocalActivity({
        projectId: activeProjectId,
        actorId: currentUser.id,
        actorKind: session.actorKind,
        action: 'session_claimed',
        taskId: input.taskId,
        path: session.touchedFiles[0],
        message: `Claimed: ${input.intent}`,
      });
    },
    [activeProjectId, currentUser, apiOnline, tasks, refreshCollaboration, pushLocalActivity],
  );

  const releaseWorkSession = useCallback(
    async (sessionId: string) => {
      const existing = workSessions.find((s) => s.id === sessionId);
      if (apiOnline) {
        await api.releaseSession(sessionId);
      }
      setWorkSessions((prev) => {
        const next = prev.filter((s) => s.id !== sessionId);
        setOverlaps(computeLocalOverlaps(next, tasks));
        return next;
      });
      if (existing && currentUser) {
        pushLocalActivity({
          projectId: existing.projectId,
          actorId: currentUser.id,
          actorKind: existing.actorKind,
          action: 'session_released',
          taskId: existing.taskId,
          message: 'Released work session',
        });
      }
    },
    [apiOnline, workSessions, tasks, currentUser, pushLocalActivity],
  );

  const addComment = useCallback(
    (taskId: string, userId: string, content: string) => {
      const user = users.find((u) => u.id === userId);
      const newComment: Comment = {
        id: Math.random().toString(36).substring(2, 11),
        userId,
        userName: user?.name || 'Unknown',
        content,
        createdAt: Date.now(),
      };

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, comments: [...t.comments, newComment], updatedAt: Date.now() }
            : t,
        ),
      );

      if (apiOnline) {
        api
          .addComment(taskId, { user_id: userId, user_name: newComment.userName, content })
          .catch(() => {});
      }
    },
    [apiOnline, users],
  );

  // ── Other mutations ──────────────────────────────────────────────────────
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const addDependency = useCallback((taskId: string, dependencyId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, dependencies: [...new Set([...(t.dependencies || []), dependencyId])] }
          : t,
      ),
    );
  }, []);

  const addPersonalTodo = useCallback(
    (content: string, linkedTaskId?: string) => {
      if (!currentUser) return;
      const newTodo: PersonalTodo = {
        id: Math.random().toString(36).substring(2, 11),
        userId: currentUser.id,
        content,
        completed: false,
        linkedTaskId,
        createdAt: Date.now(),
      };
      setPersonalTodos((prev) => [newTodo, ...prev]);
    },
    [currentUser],
  );

  const togglePersonalTodo = useCallback((id: string) => {
    setPersonalTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  }, []);

  const updatePersonalTodo = useCallback((id: string, updates: Partial<PersonalTodo>) => {
    setPersonalTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deletePersonalTodo = useCallback((id: string) => {
    setPersonalTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startTimeLog = useCallback(
    (taskId: string, _description: string) => {
      if (activeTimer) stopTimeLog(activeTimer.taskId);
      setActiveTimer({ taskId, startTime: Date.now() });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTimer],
  );

  const stopTimeLog = useCallback(
    (taskId: string) => {
      if (!activeTimer || activeTimer.taskId !== taskId) return;
      const endTime = Date.now();
      const duration = endTime - activeTimer.startTime;
      const newEntry: TimeEntry = {
        id: Math.random().toString(36).substring(2, 11),
        taskId,
        userId: currentUser?.id ?? MOCK_USER_ALEX,
        startTime: activeTimer.startTime,
        endTime,
        duration,
        description: 'Session log',
        createdAt: Date.now(),
      };
      setTimeEntries((prev) => [newEntry, ...prev]);
      setActiveTimer(null);
    },
    [activeTimer, currentUser],
  );

  const getTimeEntriesForTask = useCallback(
    (taskId: string) => timeEntries.filter((e) => e.taskId === taskId),
    [timeEntries],
  );

  const updateDashboardWidgets = useCallback((widgets: DashboardWidget[]) => {
    setDashboardWidgets(widgets);
  }, []);

  const addProject = useCallback(
    async (name: string, description: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const localId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const columns: Column[] = DEFAULT_NEW_PROJECT_COLUMN_TITLES.map((title, order) => ({
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `col-${order}-${Math.random().toString(36).slice(2)}`,
        title,
        order,
      }));
      const ownerId = currentUser?.id ?? MOCK_USER_ALEX;
      const newProject: Project = {
        id: localId,
        name: trimmed,
        description: description.trim(),
        columns,
        createdAt: Date.now(),
        ownerId,
        memberIds: [ownerId],
      };
      setProjects((p) => [...p, newProject]);
      setActiveProjectId(localId);

      if (apiOnline) {
        try {
          const { project } = await api.createProject({
            name: trimmed,
            description: description.trim(),
          });
          for (let i = 0; i < DEFAULT_NEW_PROJECT_COLUMN_TITLES.length; i++) {
            await api.createColumn(project.id, { title: DEFAULT_NEW_PROJECT_COLUMN_TITLES[i], order: i });
          }
          const { columns: serverCols } = await api.getColumns(project.id);
          const cols = serverCols.map(apiColumnToColumn).sort((a, b) => a.order - b.order);
          setProjects((prev) =>
            prev.map((pr) =>
              pr.id === localId
                ? {
                    ...pr,
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    ownerId: (project.ownerId && project.ownerId.trim()) || ownerId,
                    columns: cols,
                    memberIds: pr.memberIds,
                  }
                : pr,
            ),
          );
          setTasks((prev) => prev.map((t) => (t.projectId === localId ? { ...t, projectId: project.id } : t)));
          setActiveProjectId((aid) => (aid === localId ? project.id : aid));
        } catch {
          /* keep optimistic local project */
        }
      }
    },
    [apiOnline, currentUser],
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<Pick<Project, 'name' | 'description'>>) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const nextName = updates.name !== undefined ? updates.name.trim() : p.name;
          if (updates.name !== undefined && nextName === '') return p;
          const nextDesc = updates.description !== undefined ? updates.description : p.description;
          return {
            ...p,
            ...(updates.name !== undefined ? { name: nextName } : {}),
            ...(updates.description !== undefined ? { description: nextDesc } : {}),
          };
        }),
      );
      if (apiOnline) {
        const patch: { name?: string; description?: string } = {};
        if (updates.name !== undefined) patch.name = updates.name.trim();
        if (updates.description !== undefined) patch.description = updates.description;
        if (Object.keys(patch).length > 0) {
          void api.updateProject(id, patch).catch(() => {});
        }
      }
    },
    [apiOnline],
  );

  const deleteProject = useCallback(
    (id: string) => {
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);
      setTasks((t) => t.filter((x) => x.projectId !== id));
      try {
        localStorage.removeItem(`kanflow_chat_${id}`);
      } catch {
        /* ignore */
      }
      setActiveProjectId((aid) => (aid === id ? remaining[0]?.id ?? null : aid));
      if (apiOnline) {
        void api.deleteProject(id).catch(() => {});
      }
    },
    [apiOnline, projects],
  );

  const addProjectTeamMember = useCallback(async (projectId: string, userId: string) => {
    if (!apiOnline) throw new Error('API is offline');
    await api.addProjectMember(projectId, userId);
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const cur = new Set([...(p.memberIds ?? []), p.ownerId]);
        cur.add(userId);
        return { ...p, memberIds: Array.from(cur) };
      }),
    );
  }, [apiOnline]);

  const removeProjectTeamMember = useCallback(async (projectId: string, userId: string) => {
    if (!apiOnline) throw new Error('API is offline');
    await api.removeProjectMember(projectId, userId);
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        if (userId === p.ownerId) return p;
        const cur = new Set([...(p.memberIds ?? []), p.ownerId]);
        cur.delete(userId);
        return { ...p, memberIds: Array.from(cur) };
      }),
    );
  }, [apiOnline]);

  const clearPendingOpenTask = useCallback(() => {
    setPendingOpenTaskId(null);
  }, []);

  const openTaskOnBoard = useCallback(
    (taskId: string) => {
      const t = tasks.find((x) => x.id === taskId);
      if (!t) return;
      setActiveProjectId(t.projectId);
      setPendingOpenTaskId(taskId);
      setBoardNavSeq((s) => s + 1);
    },
    [tasks],
  );

  const setIntegrationSettings = useCallback(
    (patch: Partial<IntegrationSettings> | ((prev: IntegrationSettings) => IntegrationSettings)) => {
      setIntegrationSettingsState((prev) => {
        if (typeof patch === 'function') return patch(prev);
        return {
          ...prev,
          ...patch,
          calendar: { ...prev.calendar, ...(patch.calendar ?? {}) },
        };
      });
    },
    [],
  );

  const setDashboardChartDays = useCallback((d: DashboardChartWindowDays) => {
    setDashboardChartDaysState(d);
  }, []);

  useEffect(() => {
    writeStoredJson(KANFLOW_KEYS.integrations, integrationSettings);
  }, [integrationSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(KANFLOW_KEYS.dashboardChartDays, String(dashboardChartDays));
    } catch {
      /* ignore */
    }
  }, [dashboardChartDays]);

  const updateUser = useCallback(
    async (updates: Partial<Pick<User, 'name' | 'avatar' | 'privacy'>>) => {
      const previous = currentUser;
      setCurrentUser((current) => (current ? { ...current, ...updates } : null));
      if (!apiOnline) return;
      try {
        const { user } = await api.updateMe(updates);
        setCurrentUser((current) =>
          current
            ? { ...current, ...user, privacy: user.privacy ?? current.privacy }
            : null,
        );
        setUsers((rows) =>
          rows.map((row) => (row.id === user.id ? { ...row, ...user } : row)),
        );
      } catch (error) {
        setCurrentUser(previous);
        throw error;
      }
    },
    [apiOnline, currentUser],
  );

  const createUserAdmin = useCallback(async (body: { name: string; email: string; role?: string }) => {
    const { user } = await api.createUser(body);
    setUsers((prev) => {
      const filtered = prev.filter((u) => u.email.toLowerCase() !== user.email.toLowerCase());
      return [...filtered, { id: user.id, name: user.name, email: user.email, role: user.role }];
    });
    return user;
  }, []);

  return (
    <AppContext.Provider
      value={{
        projects,
        tasks,
        users,
        notifications,
        personalTodos,
        timeEntries,
        dashboardWidgets,
        workSessions,
        activityEvents,
        overlaps,
        activeProjectId,
        apiOnline,
        githubStatus,
        refreshGithubStatus,
        setActiveProjectId,
        addTask,
        updateTask,
        deleteTask,
        createTaskBranch,
        createTaskPr,
        linkTaskPr,
        refreshTaskPr,
        refreshCollaboration,
        claimWorkSession,
        releaseWorkSession,
        addComment,
        addNotification,
        markNotificationAsRead,
        addDependency,
        addPersonalTodo,
        togglePersonalTodo,
        updatePersonalTodo,
        deletePersonalTodo,
        startTimeLog,
        stopTimeLog,
        getTimeEntriesForTask,
        updateDashboardWidgets,
        updateUser,
        createUserAdmin,
        activeTimer,
        currentUser,
        addProject,
        updateProject,
        deleteProject,
        addProjectTeamMember,
        removeProjectTeamMember,
        globalSearchQuery,
        setGlobalSearchQuery,
        openTaskOnBoard,
        clearPendingOpenTask,
        boardNavSeq,
        pendingOpenTaskId,
        integrationSettings,
        setIntegrationSettings,
        dashboardChartDays,
        setDashboardChartDays,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
