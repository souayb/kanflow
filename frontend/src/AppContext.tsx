import React, { createContext, useContext, useState, useEffect } from 'react';
import { type Project, type Task, type User, type Notification, type PersonalTodo, type TimeEntry, type DashboardWidget } from './types';
import { MOCK_PROJECTS, MOCK_TASKS, MOCK_USERS } from './constants';
import { KANFLOW_KEYS, migrateZenithToKanflow, readStoredJson, writeStoredJson } from './lib/storage';

interface AppContextType {
  projects: Project[];
  tasks: Task[];
  users: User[];
  notifications: Notification[];
  personalTodos: PersonalTodo[];
  timeEntries: TimeEntry[];
  dashboardWidgets: DashboardWidget[];
  activeProjectId: string | null;
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

function loadInitialState() {
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

  return {
    projects,
    tasks,
    notifications,
    personalTodos,
    timeEntries,
    dashboardWidgets,
    activeProjectId,
    currentUser,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const initial = loadInitialState();
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

  useEffect(() => {
    writeStoredJson(KANFLOW_KEYS.projects, projects);
  }, [projects]);

  useEffect(() => {
    writeStoredJson(KANFLOW_KEYS.tasks, tasks);
  }, [tasks]);

  useEffect(() => {
    writeStoredJson(KANFLOW_KEYS.notifications, notifications);
  }, [notifications]);

  useEffect(() => {
    writeStoredJson(KANFLOW_KEYS.todos, personalTodos);
  }, [personalTodos]);

  useEffect(() => {
    writeStoredJson(KANFLOW_KEYS.timeEntries, timeEntries);
  }, [timeEntries]);

  useEffect(() => {
    writeStoredJson(KANFLOW_KEYS.dashboardWidgets, dashboardWidgets);
  }, [dashboardWidgets]);

  useEffect(() => {
    if (currentUser) {
      writeStoredJson(KANFLOW_KEYS.user, currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem(KANFLOW_KEYS.activeProjectId, activeProjectId);
    } else {
      localStorage.removeItem(KANFLOW_KEYS.activeProjectId);
    }
  }, [activeProjectId]);

  const addTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments'>) => {
    const newTask: Task = {
      ...taskData,
      id: Math.random().toString(36).substring(2, 11),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      comments: [],
      dependencies: [],
    };
    setTasks((prev) => [...prev, newTask]);

    addNotification({
      userId: 'u1',
      title: 'New task created',
      message: `Task "${newTask.title}" has been added to the project.`,
      type: 'task_update',
      relatedId: newTask.id,
    });
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)));

    const oldTask = tasks.find((t) => t.id === id);
    if (updates.status && oldTask && oldTask.status !== updates.status) {
      const project = projects.find((p) => p.id === oldTask.projectId);
      const col = project?.columns.find((c) => c.id === updates.status);
      const label = col?.title ?? updates.status;
      addNotification({
        userId: oldTask.assigneeId || 'u1',
        title: 'Task status updated',
        message: `Task "${oldTask.title}" moved to ${label}.`,
        type: 'task_update',
        relatedId: id,
      });
    }
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const addComment = (taskId: string, userId: string, content: string) => {
    const user = users.find((u) => u.id === userId);
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const newComment = {
            id: Math.random().toString(36).substring(2, 11),
            userId,
            userName: user?.name || 'Unknown',
            content,
            createdAt: Date.now(),
          };
          return {
            ...t,
            comments: [...t.comments, newComment],
            updatedAt: Date.now(),
          };
        }
        return t;
      }),
    );

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.assigneeId !== userId) {
      addNotification({
        userId: task.assigneeId || 'u1',
        title: 'New comment',
        message: `${user?.name} commented on "${task.title}".`,
        type: 'comment',
        relatedId: taskId,
      });
    }
  };

  const addNotification = (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const newN: Notification = {
      ...n,
      id: Math.random().toString(36).substring(2, 11),
      createdAt: Date.now(),
      read: false,
    };
    setNotifications((prev) => [newN, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const addDependency = (taskId: string, dependencyId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, dependencies: [...new Set([...(t.dependencies || []), dependencyId])] } : t,
      ),
    );
  };

  const addPersonalTodo = (content: string, linkedTaskId?: string) => {
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
  };

  const togglePersonalTodo = (id: string) => {
    setPersonalTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const updatePersonalTodo = (id: string, updates: Partial<PersonalTodo>) => {
    setPersonalTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const deletePersonalTodo = (id: string) => {
    setPersonalTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const startTimeLog = (taskId: string, _description: string) => {
    if (activeTimer) stopTimeLog(activeTimer.taskId);
    setActiveTimer({ taskId, startTime: Date.now() });
  };

  const stopTimeLog = (taskId: string) => {
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
  };

  const getTimeEntriesForTask = (taskId: string) => {
    return timeEntries.filter((e) => e.taskId === taskId);
  };

  const updateDashboardWidgets = (widgets: DashboardWidget[]) => {
    setDashboardWidgets(widgets);
  };

  const updateUser = (updates: Partial<User>) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

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
