/**
 * Typed client for the Kanflow Rust API (MISSION §8).
 * Falls back gracefully — callers should catch errors and use localStorage cache.
 */

const BASE: string = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8080';

// ── Auth token getter (set by AuthProvider once Keycloak initialises) ─────────

let _getToken: (() => string | undefined) | null = null;

export function setTokenGetter(fn: () => string | undefined): void {
  _getToken = fn;
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ApiProject {
  id: string;
  name: string;
  description: string;
  ownerId?: string;
  /** From `project_members` + owner (MISSION — team in DB). */
  memberIds?: string[];
}

export interface ApiColumn {
  id: string;
  projectId: string;
  title: string;
  order: number;
}

export interface ApiComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
}

export interface ApiTask {
  id: string;
  projectId: string;
  status: string;        // = column UUID
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assigneeId?: string;
  dueDate?: number;      // Unix ms
  tags: string[];
  comments: ApiComment[];
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
  aiSuggested?: boolean;
  aiThinking?: string;
}

/**
 * Build JSON body for PATCH /tasks/:id. Omits undefined fields; encodes clear-due as `dueDate: 0`
 * and clear-assignee as `assigneeId: null` so the server can distinguish from "field omitted".
 */
export function buildTaskPatchBody(updates: Partial<ApiTask>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const u = updates as Record<string, unknown>;
  for (const key of ['title', 'description', 'priority', 'status', 'tags'] as const) {
    if (key in updates && u[key] !== undefined) out[key] = u[key];
  }
  if ('dueDate' in updates) out.dueDate = u.dueDate == null ? 0 : u.dueDate;
  if ('assigneeId' in updates) out.assigneeId = u.assigneeId ?? null;
  return out;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = _getToken?.();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((data as any)?.error ?? res.statusText);
  return data as T;
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  // Projects
  getProjects: () =>
    apiFetch<{ projects: ApiProject[] }>('/api/v1/projects'),

  createProject: (body: { name: string; description?: string }) =>
    apiFetch<{ project: ApiProject }>('/api/v1/projects', {
      method: 'POST', body: JSON.stringify(body),
    }),

  updateProject: (id: string, body: { name?: string; description?: string }) =>
    apiFetch<{ project: ApiProject }>(`/api/v1/projects/${id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  deleteProject: (id: string) =>
    apiFetch<void>(`/api/v1/projects/${id}`, { method: 'DELETE' }),

  // Columns
  getColumns: (projectId: string) =>
    apiFetch<{ columns: ApiColumn[] }>(`/api/v1/projects/${projectId}/columns`),

  createColumn: (projectId: string, body: { title: string; order?: number }) =>
    apiFetch<{ column: ApiColumn }>(`/api/v1/projects/${projectId}/columns`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  updateColumn: (projectId: string, columnId: string, body: { title?: string; order?: number }) =>
    apiFetch<{ column: ApiColumn }>(`/api/v1/projects/${projectId}/columns/${columnId}`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),

  deleteColumn: (projectId: string, columnId: string) =>
    apiFetch<void>(`/api/v1/projects/${projectId}/columns/${columnId}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (projectId: string) =>
    apiFetch<{ tasks: ApiTask[] }>(`/api/v1/projects/${projectId}/tasks`),

  createTask: (projectId: string, body: Omit<ApiTask, 'id' | 'createdAt' | 'updatedAt' | 'comments'>) =>
    apiFetch<{ task: ApiTask }>(`/api/v1/projects/${projectId}/tasks`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  updateTask: (id: string, body: Partial<ApiTask>) =>
    apiFetch<{ task: ApiTask }>(`/api/v1/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(buildTaskPatchBody(body)),
    }),

  deleteTask: (id: string) =>
    apiFetch<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' }),

  // Comments
  addComment: (taskId: string, body: { user_id: string; user_name: string; content: string }) =>
    apiFetch<{ comment: ApiComment }>(`/api/v1/tasks/${taskId}/comments`, {
      method: 'POST', body: JSON.stringify(body),
    }),
};
