/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type LucideIcon } from 'lucide-react';

export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'in-progress' | 'review' | 'done';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  privacy?: PrivacySettings;
}

export interface PrivacySettings {
  activityVisibility: 'project' | 'private';
  showOnlineStatus: boolean;
  allowAnalytics: boolean;
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  activityVisibility: 'project',
  showOnlineStatus: true,
  allowAnalytics: false,
};

export type WidgetType = 'overview' | 'activity' | 'performance' | 'upcoming' | 'ai_insights';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  enabled: boolean;
  order: number;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string; // Dynamic statuses based on columns
  priority: Priority;
  assigneeId?: string;
  dueDate?: number;
  projectId: string;
  tags: string[];
  /** Manual sort position within its column (drag-and-drop order). */
  position: number;
  comments: Comment[];
  createdAt: number;
  updatedAt: number;
  dependencies: string[]; // List of task IDs this task depends on
  aiSuggested?: boolean;
  aiThinking?: string;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  githubBranchName?: string;
  githubBranchUrl?: string;
  githubPrNumber?: number;
  githubPrUrl?: string;
  githubPrState?: GithubPrState;
}

export type GithubPrState = 'draft' | 'open' | 'approved' | 'changes' | 'merged' | 'closed';

export type ActorKind = 'human' | 'agent';

export type WorkSessionPhase =
  | 'exploring'
  | 'implementing'
  | 'testing'
  | 'pr_open'
  | 'review'
  | 'blocked';

export type WorkSessionTool = 'cursor' | 'claude' | 'codex' | 'ollama' | 'human';

/** AgentBoardMCP-style work card: who is working on what (MISSION §5.12). */
export interface WorkSession {
  id: string;
  projectId: string;
  taskId?: string;
  ownerUserId: string;
  actorKind: ActorKind;
  tool?: WorkSessionTool;
  intent: string;
  phase: WorkSessionPhase;
  touchedFiles: string[];
  plannedFiles: string[];
  branchName?: string;
  heartbeatAt: number;
  createdAt: number;
  updatedAt: number;
}

export type OverlapKind = 'file_overlap' | 'issue_collision' | 'shared_branch';

export interface OverlapFinding {
  kind: OverlapKind;
  sessionId: string;
  otherSessionId: string;
  detail: string;
  paths?: string[];
  issueNumber?: number;
}

export type ActivityAction =
  | 'task_created'
  | 'task_updated'
  | 'task_moved'
  | 'comment_added'
  | 'ai_applied'
  | 'session_claimed'
  | 'session_released'
  | 'pr_opened'
  | 'pr_updated'
  | 'file_touched';

/** Project-scoped audit / blame feed (MISSION §5.12). */
export interface ActivityEvent {
  id: string;
  projectId: string;
  actorId: string;
  actorKind: ActorKind;
  action: ActivityAction;
  taskId?: string;
  path?: string;
  message: string;
  createdAt: number;
}

export interface Column {
  id: string;
  title: string;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  columns: Column[];
  createdAt: number;
  ownerId: string;
  /** User ids with access to this project (MISSION — project team). Always includes owner in UI. */
  memberIds?: string[];
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_update' | 'comment' | 'mention' | 'ai_insight';
  read: boolean;
  createdAt: number;
  relatedId?: string; // taskId or projectId
}

export interface PerformanceData {
  date: string;
  completed: number;
  added: number;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: number;
}

export interface PersonalTodo {
  id: string;
  userId: string;
  content: string;
  completed: boolean;
  linkedTaskId?: string;
  quadrant?: 1 | 2 | 3 | 4;
  createdAt: number;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  duration: number; // in ms
  description: string;
  createdAt: number;
}

/** Persisted in localStorage (`kanflow_integrations`). */
export interface IntegrationSettings {
  calendar: {
    assignedOnly: boolean;
    includeCompleted: boolean;
  };
}

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  calendar: { assignedOnly: true, includeCompleted: false },
};

export type DashboardChartWindowDays = 7 | 14 | 30;
