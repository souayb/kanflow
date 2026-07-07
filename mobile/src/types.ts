// Mirrors the backend JSON contract (see frontend/src/lib/api.ts).

export interface ApiProject {
  id: string;
  name: string;
  description: string;
  ownerId?: string;
  memberIds?: string[];
}

export interface ApiColumn {
  id: string;
  projectId: string;
  title: string;
  order: number;
}

export type Priority = 'low' | 'medium' | 'high';

export interface ApiTask {
  id: string;
  projectId: string;
  status: string; // = column UUID
  title: string;
  description: string;
  priority: Priority;
  assigneeId?: string;
  dueDate?: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  /** Populated by the backend after a one-way GitHub sync. */
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
}

export interface AuthUser {
  sub: string;
  name?: string;
  email?: string;
}
