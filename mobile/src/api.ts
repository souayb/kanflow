import { API_URL } from './config';
import type { ApiColumn, ApiProject, ApiTask, Priority } from './types';

// The AuthProvider injects a token getter so requests carry a fresh Bearer token.
let tokenGetter: () => Promise<string | null> = async () => null;
export function setTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await tokenGetter();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? res.statusText);
  return data as T;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  status: string; // column id
  tags?: string[];
}

export const api = {
  getProjects: () => request<{ projects: ApiProject[] }>('/api/v1/projects'),

  getColumns: (projectId: string) =>
    request<{ columns: ApiColumn[] }>(`/api/v1/projects/${projectId}/columns`),

  getTasks: (projectId: string) =>
    request<{ tasks: ApiTask[] }>(`/api/v1/projects/${projectId}/tasks`),

  createTask: (projectId: string, body: CreateTaskInput) =>
    request<{ task: ApiTask }>(`/api/v1/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ priority: 'medium', description: '', tags: [], ...body }),
    }),

  updateTask: (taskId: string, body: Partial<Pick<ApiTask, 'title' | 'description' | 'priority' | 'status' | 'tags'>>) =>
    request<{ task: ApiTask }>(`/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteTask: (taskId: string) =>
    request<void>(`/api/v1/tasks/${taskId}`, { method: 'DELETE' }),
};
