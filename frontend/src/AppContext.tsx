import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { type Project, type Task, type Column, type User, type Notification, type PersonalTodo, type TimeEntry, type DashboardWidget, type Comment } from './types';
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_USERS } from './constants';
import { KANFLOW_KEYS, migrateZenithToKanflow, readStoredJson, writeStoredJson } from './lib/storage';
import { api, type ApiTask, type ApiProject, type ApiColumn } from './lib/api';

interface AppContextType {
  projects: Project[];
  tasks: Task[];
  users: User[];
  notifications: Notification[];
  personalTodos: PersonalTodo[];
  timeEntries: TimeEntry[];
  dashboardWidgets: DashboardWidget[];
  activeProjectId: string | null;
  apiOnline: boolean;
  setActiveProjectId: (id: string | null) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
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
  updateUser: (updates: Partial<User>) => void;
  activeTimer: { taskId: string; startTime: number } | null;
  currentUser: User | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: '1', type: 'overview', title: 'Project Overview', enabled: true, order: 0 },
  { id: '2', type: 'activity', title: 'Recent Activity', enabled: true, order: 1 },
  { id: '3', type: 'performance', title: 'Performance', enabled: true, order: 2 },
  { id: '4', type: 'upcoming', title: 'High priority tasks', enabled: true, order: 3 },
  { id: '5', type: 'ai_insights', title: 'Kanflow AI insights', enabled: true, order: 4 },
];

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
  };
}

function apiColumnToColumn(c: ApiColumn): Column {
  return { id: c.id, title: c.title, order: c.order };
}

function apiProjectToProject(p: ApiProject, columns: ApiColumn[] = []): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    columns: columns.map(apiColumnToColumn).sort((a, b) => a.order - b.order),
    createdAt: Date.now(),
    ownerId: 'u1',
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
      activeProjectId: MOCK_PROJECTS[0]?.id ?? null,
      currentUser: MOCK_USERS[0] ?? null,
    };
  }

  migrateZenithToKanflow();

  const projects = readStoredJson<Project[]>(KANFLOW_KEYS.projects) ?? MOCK_PROJECTS;
  const tasks = readStoredJson<Task[]>(KANFLOW_KEYS.tasks) ?? MOCK_TASKS;
  const notifications = readStoredJson<Notification[]>(KANFLOW_KEYS.notifications) ?? [];
  const personalTodos = readStoredJson<PersonalTodo[]>(KANFLOW_KEYS.todos) ?? [];
  const timeEntries = readStoredJson<TimeEntry[]>(KANFLOW_KEYS.timeEntries) ?? [];
  const dashboardWidgets = readStoredJson<DashboardWidget[]>(KANFLOW_KEYS.dashboardWidgets) ?? DEFAULT_WIDGETS;
  const currentUser = readStoredJson<User>(KANFLOW_KEYS.user) ?? MOCK_USERS[0] ?? null;

  let activeProjectId = localStorage.getItem(KANFLOW_KEYS.activeProjectId);
  if (!activeProjectId || !projects.some((p) => p.id === activeProjectId)) {
    activeProjectId = projects[0]?.id ?? null;
  }

  return { projects, tasks, notifications, personalTodos, timeEntries, dashboardWidgets, activeProjectId, currentUser };
}

// ── Provider ───────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const initial = loadCachedState();
  const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [users] = useState<User[]>(MOCK_USERS);
  const [notifications, setNotifications] = useState<Notification[]>(initial.notifications);
  const [personalTodos, setPersonalTodos] = useState<PersonalTodo[]>(initial.personalTodos);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initial.timeEntries);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(initial.dashboardWidgets);
  const [activeTimer, setActiveTimer] = useState<{ taskId: string; startTime: number } | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initial.activeProjectId);
  const [currentUser, setCurrentUser] = useState<User | null>(initial.currentUser);
  const [apiOnline, setApiOnline] = useState(false);

  // ── Bootstrap from API ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { projects: apiProjects } = await api.getProjects();
        if (cancelled) return;

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

        setProjects(hydratedProjects);
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
    (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments'>) => {
      const tempId = Math.random().toString(36).substring(2, 11);
      const now = Date.now();
      const newTask: Task = {
        ...taskData,
        id: tempId,
        createdAt: now,
        updatedAt: now,
        comments: [],
        dependencies: taskData.dependencies ?? [],
      };
      setTasks((prev) => [...prev, newTask]);

      addNotification({
        userId: 'u1',
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
          })
          .then(({ task }) => {
            // Swap temp ID for server-assigned ID
            setTasks((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: task.id } : t)));
          })
          .catch(() => {/* keep optimistic state */});
      }
    },
    [apiOnline, addNotification],
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)),
      );

      setTasks((prev) => {
        const oldTask = prev.find((t) => t.id === id);
        if (updates.status && oldTask && oldTask.status !== updates.status) {
          // notification fired below after state update
        }
        return prev;
      });

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
        userId: currentUser?.id || 'u1',
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

  const updateUser = useCallback((updates: Partial<User>) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...updates } : null));
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
        activeProjectId,
        apiOnline,
        setActiveProjectId,
        addTask,
        updateTask,
        deleteTask,
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
        activeTimer,
        currentUser,
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
