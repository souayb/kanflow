/**
 * Typed client for the Kanflow Rust API (MISSION §8).
 * Falls back gracefully — callers should catch errors and use localStorage cache.
 */

const BASE: string = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8080';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface ApiProject {
  id: string;
  name: string;
  description: string;
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

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
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
      method: 'PATCH', body: JSON.stringify(body),
    }),

  deleteTask: (id: string) =>
    apiFetch<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' }),

  // Comments
  addComment: (taskId: string, body: { user_id: string; user_name: string; content: string }) =>
    apiFetch<{ comment: ApiComment }>(`/api/v1/tasks/${taskId}/comments`, {
      method: 'POST', body: JSON.stringify(body),
    }),
};
