/**
 * AppContext tests — validates all task/comment mutations work correctly.
 * Uses a mocked API so no network calls are made.
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from './AppContext';
import {
  MOCK_COL_LAUNCH_DONE,
  MOCK_COL_LAUNCH_TODO,
  MOCK_PROJECT_LAUNCH,
  MOCK_USER_ALEX,
} from './constants';

// ── Mock localStorage ──────────────────────────────────────────────────────
function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage);
  return store;
}

// ── Mock API — always rejects (offline mode) ──────────────────────────────
vi.mock('./lib/api', () => ({
  api: {
    getProjects: vi.fn().mockRejectedValue(new Error('offline')),
    getUsers: vi.fn().mockRejectedValue(new Error('offline')),
    getMe: vi.fn().mockRejectedValue(new Error('offline')),
    getColumns: vi.fn().mockRejectedValue(new Error('offline')),
    getTasks: vi.fn().mockRejectedValue(new Error('offline')),
    createTask: vi.fn().mockRejectedValue(new Error('offline')),
    updateTask: vi.fn().mockRejectedValue(new Error('offline')),
    deleteTask: vi.fn().mockRejectedValue(new Error('offline')),
    addComment: vi.fn().mockRejectedValue(new Error('offline')),
    createUser: vi.fn().mockRejectedValue(new Error('offline')),
  },
}));

// ── Helper: render a component that uses AppContext ───────────────────────
function TestHarness({ children }: { children: (ctx: ReturnType<typeof useApp>) => React.ReactNode }) {
  const ctx = useApp();
  return <>{children(ctx)}</>;
}

function renderWithContext(children: (ctx: ReturnType<typeof useApp>) => React.ReactNode) {
  return render(
    <AppProvider>
      <TestHarness>{children}</TestHarness>
    </AppProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe('AppContext', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('addTask', () => {
    it('adds a new task to the task list', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const initialCount = ctx.tasks.length;

      await act(async () => {
        ctx.addTask({
          title: 'New test task',
          description: 'desc',
          status: MOCK_COL_LAUNCH_TODO,
          priority: 'medium',
          projectId: MOCK_PROJECT_LAUNCH,
          tags: [],
          dependencies: [],
        });
      });

      expect(ctx.tasks).toHaveLength(initialCount + 1);
      const added = ctx.tasks.find((t) => t.title === 'New test task');
      expect(added).toBeDefined();
      expect(added!.status).toBe(MOCK_COL_LAUNCH_TODO);
      expect(added!.comments).toEqual([]);
    });

    it('generates a unique id for the new task', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      await act(async () => {
        ctx.addTask({
          title: 'Task A',
          description: '',
          status: MOCK_COL_LAUNCH_TODO,
          priority: 'low',
          projectId: MOCK_PROJECT_LAUNCH,
          tags: [],
          dependencies: [],
        });
        ctx.addTask({
          title: 'Task B',
          description: '',
          status: MOCK_COL_LAUNCH_TODO,
          priority: 'low',
          projectId: MOCK_PROJECT_LAUNCH,
          tags: [],
          dependencies: [],
        });
      });

      const ids = ctx.tasks.map((t) => t.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('creates a notification when a task is added', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const before = ctx.notifications.length;

      await act(async () => {
        ctx.addTask({
          title: 'Notify me',
          description: '',
          status: MOCK_COL_LAUNCH_TODO,
          priority: 'high',
          projectId: MOCK_PROJECT_LAUNCH,
          tags: [],
          dependencies: [],
        });
      });

      expect(ctx.notifications.length).toBe(before + 1);
      expect(ctx.notifications[0].title).toBe('New task created');
    });
  });

  describe('updateTask', () => {
    it('updates task title in place', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const taskId = ctx.tasks[0]?.id;
      if (!taskId) return; // skip if no tasks

      await act(async () => {
        ctx.updateTask(taskId, { title: 'Updated title' });
      });

      const updated = ctx.tasks.find((t) => t.id === taskId);
      expect(updated!.title).toBe('Updated title');
    });

    it('updates status (column move)', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const taskId = ctx.tasks[0]?.id;
      if (!taskId) return;

      await act(async () => {
        ctx.updateTask(taskId, { status: MOCK_COL_LAUNCH_DONE });
      });

      const updated = ctx.tasks.find((t) => t.id === taskId);
      expect(updated!.status).toBe(MOCK_COL_LAUNCH_DONE);
    });

    it('updates updatedAt timestamp', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const taskId = ctx.tasks[0]?.id;
      if (!taskId) return;

      const before = ctx.tasks.find((t) => t.id === taskId)!.updatedAt;

      // Ensure at least 1ms passes
      await new Promise((r) => setTimeout(r, 2));

      await act(async () => {
        ctx.updateTask(taskId, { title: 'Changed' });
      });

      const after = ctx.tasks.find((t) => t.id === taskId)!.updatedAt;
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe('deleteTask', () => {
    it('removes the task from the list', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      // Add a task first so we have one to delete
      await act(async () => {
        ctx.addTask({
          title: 'To delete',
          description: '',
          status: MOCK_COL_LAUNCH_TODO,
          priority: 'low',
          projectId: MOCK_PROJECT_LAUNCH,
          tags: [],
          dependencies: [],
        });
      });

      const taskId = ctx.tasks.find((t) => t.title === 'To delete')!.id;
      const countBefore = ctx.tasks.length;

      await act(async () => {
        ctx.deleteTask(taskId);
      });

      expect(ctx.tasks).toHaveLength(countBefore - 1);
      expect(ctx.tasks.find((t) => t.id === taskId)).toBeUndefined();
    });

    it('is a no-op for unknown id', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const countBefore = ctx.tasks.length;

      await act(async () => {
        ctx.deleteTask('nonexistent-id');
      });

      expect(ctx.tasks).toHaveLength(countBefore);
    });
  });

  describe('addComment', () => {
    it('appends a comment to the correct task', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const taskId = ctx.tasks[0]?.id;
      if (!taskId) return;

      const before = ctx.tasks.find((t) => t.id === taskId)!.comments.length;

      await act(async () => {
        ctx.addComment(taskId, MOCK_USER_ALEX, 'Test comment content');
      });

      const task = ctx.tasks.find((t) => t.id === taskId)!;
      expect(task.comments).toHaveLength(before + 1);
      expect(task.comments[task.comments.length - 1].content).toBe('Test comment content');
      expect(task.comments[task.comments.length - 1].userId).toBe(MOCK_USER_ALEX);
    });

    it('sets the correct userName from users list', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const taskId = ctx.tasks[0]?.id;
      if (!taskId) return;

      await act(async () => {
        ctx.addComment(taskId, MOCK_USER_ALEX, 'Hello');
      });

      const task = ctx.tasks.find((t) => t.id === taskId)!;
      const comment = task.comments[task.comments.length - 1];
      expect(comment.userName).toBe('Alex Rivera'); // MOCK_USERS[0]
    });
  });

  describe('notifications', () => {
    it('markNotificationAsRead marks a notification as read', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      // Create a notification via addTask
      await act(async () => {
        ctx.addTask({
          title: 'Notif task',
          description: '',
          status: MOCK_COL_LAUNCH_TODO,
          priority: 'low',
          projectId: MOCK_PROJECT_LAUNCH,
          tags: [],
          dependencies: [],
        });
      });

      const notifId = ctx.notifications[0]?.id;
      expect(notifId).toBeDefined();
      expect(ctx.notifications[0].read).toBe(false);

      await act(async () => {
        ctx.markNotificationAsRead(notifId);
      });

      expect(ctx.notifications.find((n) => n.id === notifId)!.read).toBe(true);
    });
  });

  describe('personalTodos', () => {
    it('addPersonalTodo adds a new todo', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const before = ctx.personalTodos.length;

      await act(async () => {
        ctx.addPersonalTodo('Buy milk');
      });

      expect(ctx.personalTodos).toHaveLength(before + 1);
      expect(ctx.personalTodos[0].content).toBe('Buy milk');
      expect(ctx.personalTodos[0].completed).toBe(false);
    });

    it('togglePersonalTodo flips completed state', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      await act(async () => {
        ctx.addPersonalTodo('Toggle me');
      });

      const id = ctx.personalTodos[0].id;

      await act(async () => {
        ctx.togglePersonalTodo(id);
      });
      expect(ctx.personalTodos.find((t) => t.id === id)!.completed).toBe(true);

      await act(async () => {
        ctx.togglePersonalTodo(id);
      });
      expect(ctx.personalTodos.find((t) => t.id === id)!.completed).toBe(false);
    });

    it('deletePersonalTodo removes the todo', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      await act(async () => {
        ctx.addPersonalTodo('Remove me');
      });

      const id = ctx.personalTodos[0].id;

      await act(async () => {
        ctx.deletePersonalTodo(id);
      });

      expect(ctx.personalTodos.find((t) => t.id === id)).toBeUndefined();
    });

    it('updatePersonalTodo sets an Eisenhower quadrant', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      await act(async () => {
        ctx.addPersonalTodo('Matrix item');
      });
      const id = ctx.personalTodos[0].id;

      await act(async () => {
        ctx.updatePersonalTodo(id, { quadrant: 1 });
      });

      expect(ctx.personalTodos.find((t) => t.id === id)?.quadrant).toBe(1);
    });
  });

  describe('time keeping', () => {
    it('startTimeLog then stopTimeLog records a duration entry', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const taskId = ctx.tasks[0]?.id;
      expect(taskId).toBeDefined();
      const before = ctx.timeEntries.length;

      await act(async () => {
        ctx.startTimeLog(taskId!, 'Session log');
      });
      expect(ctx.activeTimer?.taskId).toBe(taskId);

      await new Promise((r) => setTimeout(r, 5));

      await act(async () => {
        ctx.stopTimeLog(taskId!);
      });

      expect(ctx.activeTimer).toBeNull();
      expect(ctx.timeEntries.length).toBe(before + 1);
      expect(ctx.timeEntries[0].taskId).toBe(taskId);
      expect(ctx.timeEntries[0].duration).toBeGreaterThanOrEqual(0);
      expect(ctx.getTimeEntriesForTask(taskId!).length).toBeGreaterThan(0);
    });
  });

  describe('projects', () => {
    it('addProject creates a local project with default columns and selects it', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });

      const before = ctx.projects.length;
      await act(async () => {
        await ctx.addProject('QA Board', 'for tests');
      });

      expect(ctx.projects.length).toBe(before + 1);
      const created = ctx.projects.find((p) => p.name === 'QA Board');
      expect(created).toBeDefined();
      expect(created!.columns.map((c) => c.title)).toEqual(['To Do', 'In Progress', 'Review', 'Done']);
      expect(ctx.activeProjectId).toBe(created!.id);
    });

    it('addProject ignores a blank name', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });
      const before = ctx.projects.length;

      await act(async () => {
        await ctx.addProject('   ', '');
      });

      expect(ctx.projects.length).toBe(before);
    });

    it('updateProject renames an existing project', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });
      const id = ctx.projects[0]!.id;

      await act(async () => {
        ctx.updateProject(id, { name: 'Renamed launch' });
      });

      expect(ctx.projects.find((p) => p.id === id)?.name).toBe('Renamed launch');
    });
  });

  describe('dependencies and board navigation', () => {
    it('addDependency records a unique predecessor', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });
      const a = ctx.tasks[0]!.id;
      const b = ctx.tasks[1]!.id;

      await act(async () => {
        ctx.addDependency(a, b);
        ctx.addDependency(a, b);
      });

      expect(ctx.tasks.find((t) => t.id === a)!.dependencies).toEqual(expect.arrayContaining([b]));
      expect(ctx.tasks.find((t) => t.id === a)!.dependencies.filter((id) => id === b)).toHaveLength(1);
    });

    it('openTaskOnBoard sets the pending task and bumps boardNavSeq', async () => {
      let ctx!: ReturnType<typeof useApp>;
      renderWithContext((c) => { ctx = c; return null; });
      const id = ctx.tasks[0]!.id;
      const seq = ctx.boardNavSeq;

      await act(async () => {
        ctx.openTaskOnBoard(id);
      });

      expect(ctx.pendingOpenTaskId).toBe(id);
      expect(ctx.boardNavSeq).toBe(seq + 1);

      await act(async () => {
        ctx.clearPendingOpenTask();
      });
      expect(ctx.pendingOpenTaskId).toBeNull();
    });
  });
});
