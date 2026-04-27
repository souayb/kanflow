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
  twoFactorEnabled?: boolean;
  passwordLastChanged?: number;
}

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
  comments: Comment[];
  createdAt: number;
  updatedAt: number;
  dependencies: string[]; // List of task IDs this task depends on
  aiSuggested?: boolean;
  aiThinking?: string;
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
