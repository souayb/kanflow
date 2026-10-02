/**
 * Typed client for the Kanflow Rust API (MISSION §8).
 * Falls back gracefully — callers should catch errors and use localStorage cache.
 */

const BASE: string =
  (import.meta as any).env?.VITE_API_URL ??
  ((import.meta as any).env?.DEV ? 'http://localhost:8080' : '');

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

/** `mongo_store::list_chat` / `append_chat` (MISSION §5.11). */
export interface ApiChatMessage {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface ApiUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  privacy?: {
    activityVisibility: 'project' | 'private';
    showOnlineStatus: boolean;
    allowAnalytics: boolean;
  };
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
  position: number;
  comments: ApiComment[];
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
  aiSuggested?: boolean;
  aiThinking?: string;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  githubBranchName?: string;
  githubBranchUrl?: string;
  githubPrNumber?: number;
  githubPrUrl?: string;
  githubPrState?: 'draft' | 'open' | 'approved' | 'changes' | 'merged' | 'closed';
}

export interface ApiWorkSession {
  id: string;
  projectId: string;
  taskId?: string;
  ownerUserId: string;
  actorKind: 'human' | 'agent';
  tool?: string;
  intent: string;
  phase: string;
  touchedFiles: string[];
  plannedFiles: string[];
  branchName?: string;
  heartbeatAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface ApiOverlapFinding {
  kind: 'file_overlap' | 'issue_collision' | 'shared_branch';
  sessionId: string;
  otherSessionId: string;
  detail: string;
  paths?: string[];
  issueNumber?: number;
}

export interface ApiActivityEvent {
  id: string;
  projectId: string;
  actorId: string;
  actorKind: 'human' | 'agent';
  action: string;
  taskId?: string;
  path?: string;
  message: string;
  createdAt: number;
}

export interface GithubIntegrationStatus {
  connected: boolean;
  configured?: boolean;
  appAvailable?: boolean;
  authMethod?: 'pat' | 'github_app';
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  error?: 'connection_failed';
}

/**
 * Build JSON body for PATCH /tasks/:id. Omits undefined fields; encodes clear-due as `dueDate: 0`
 * and clear-assignee as `assigneeId: null` so the server can distinguish from "field omitted".
 */
export function buildTaskPatchBody(updates: Partial<ApiTask>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const u = updates as Record<string, unknown>;
  for (const key of ['title', 'description', 'priority', 'status', 'tags', 'position'] as const) {
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
  // Users (Postgres directory; POST requires Keycloak realm role `admin`)
  getUsers: () => apiFetch<{ users: ApiUserRow[] }>('/api/v1/users'),

  createUser: (body: { name: string; email: string; role?: string }) =>
    apiFetch<{ user: ApiUserRow }>('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getMe: () => apiFetch<{ user: ApiUserRow }>('/api/v1/users/me'),

  updateMe: (body: {
    name?: string;
    avatar?: string;
    privacy?: ApiUserRow['privacy'];
  }) =>
    apiFetch<{ user: ApiUserRow }>('/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

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

  addProjectMember: (projectId: string, userId: string) =>
    apiFetch<void>(`/api/v1/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  removeProjectMember: (projectId: string, userId: string) =>
    apiFetch<void>(`/api/v1/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    }),

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

  createTask: (
    projectId: string,
    body: Omit<ApiTask, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'position'> & { position?: number },
  ) =>
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

  createTaskBranch: (taskId: string) =>
    apiFetch<{ task: ApiTask }>(`/api/v1/tasks/${taskId}/github-branch`, { method: 'POST' }),

  createTaskPr: (taskId: string) =>
    apiFetch<{ task: ApiTask }>(`/api/v1/tasks/${taskId}/github-pr`, { method: 'POST' }),

  linkTaskPr: (taskId: string, number: number) =>
    apiFetch<{ task: ApiTask }>(`/api/v1/tasks/${taskId}/github-pr/link`, {
      method: 'POST',
      body: JSON.stringify({ number }),
    }),

  refreshTaskPr: (taskId: string) =>
    apiFetch<{ task: ApiTask }>(`/api/v1/tasks/${taskId}/github-pr/refresh`, { method: 'POST' }),

  // Collaboration
  listSessions: (projectId: string) =>
    apiFetch<{ sessions: ApiWorkSession[]; overlaps: ApiOverlapFinding[] }>(
      `/api/v1/projects/${projectId}/sessions`,
    ),

  claimSession: (
    projectId: string,
    body: {
      ownerUserId: string;
      actorKind?: string;
      tool?: string;
      intent?: string;
      phase?: string;
      taskId?: string;
      touchedFiles?: string[];
      plannedFiles?: string[];
      branchName?: string;
      sessionId?: string;
    },
  ) =>
    apiFetch<{ session: ApiWorkSession }>(`/api/v1/projects/${projectId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateSession: (
    sessionId: string,
    body: Partial<{
      intent: string;
      phase: string;
      taskId: string;
      touchedFiles: string[];
      plannedFiles: string[];
      branchName: string;
      tool: string;
      heartbeat: boolean;
    }>,
  ) =>
    apiFetch<{ session: ApiWorkSession }>(`/api/v1/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  releaseSession: (sessionId: string) =>
    apiFetch<void>(`/api/v1/sessions/${sessionId}`, { method: 'DELETE' }),

  listActivity: (projectId: string) =>
    apiFetch<{ events: ApiActivityEvent[] }>(`/api/v1/projects/${projectId}/activity`),

  // Integrations
  getGithubStatus: () => apiFetch<GithubIntegrationStatus>('/api/v1/integrations/github'),
  configureGithub: (body: {
    token: string;
    owner: string;
    repo: string;
    projectNumber?: number;
    ownerIsOrg?: boolean;
  }) =>
    apiFetch<GithubIntegrationStatus>('/api/v1/integrations/github', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  startGithubAuth: (body: {
    owner: string;
    repo: string;
    projectNumber?: number;
    ownerIsOrg?: boolean;
  }) =>
    apiFetch<{ authorizeUrl: string }>('/api/v1/integrations/github/authorize', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  disconnectGithub: () =>
    apiFetch<void>('/api/v1/integrations/github', { method: 'DELETE' }),

  // Comments
  addComment: (taskId: string, body: { user_id: string; user_name: string; content: string }) =>
    apiFetch<{ comment: ApiComment }>(`/api/v1/tasks/${taskId}/comments`, {
      method: 'POST', body: JSON.stringify(body),
    }),

  // Per-project team chat (#general) — Mongo when enabled; otherwise 503 from server
  listProjectChat: (projectId: string) =>
    apiFetch<{ messages: ApiChatMessage[] }>(`/api/v1/projects/${projectId}/chat`),

  appendProjectChat: (projectId: string, body: { user_id: string; user_name: string; content: string }) =>
    apiFetch<{ id: string; status: string }>(`/api/v1/projects/${projectId}/chat`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
