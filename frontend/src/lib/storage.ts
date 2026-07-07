/**
 * Kanflow localStorage keys (MISSION §6 — persistence).
 * Migrates legacy `zenith_*` keys once per session.
 */

export const KANFLOW_KEYS = {
  projects: 'kanflow_projects',
  tasks: 'kanflow_tasks',
  notifications: 'kanflow_notifications',
  todos: 'kanflow_todos',
  timeEntries: 'kanflow_time_entries',
  dashboardWidgets: 'kanflow_dashboard_widgets',
  user: 'kanflow_user',
  activeProjectId: 'kanflow_active_project_id',
  integrations: 'kanflow_integrations',
  dashboardChartDays: 'kanflow_dashboard_chart_days',
} as const;

const LEGACY = {
  projects: 'zenith_projects',
  tasks: 'zenith_tasks',
  notifications: 'zenith_notifications',
  todos: 'zenith_todos',
  timeEntries: 'zenith_time_entries',
  dashboardWidgets: 'zenith_dashboard_widgets',
  user: 'zenith_user',
} as const;

export function readStoredJson<T>(primaryKey: string, legacyKey?: string): T | null {
  const raw = localStorage.getItem(primaryKey) ?? (legacyKey ? localStorage.getItem(legacyKey) : null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeStoredJson(primaryKey: string, value: unknown): void {
  localStorage.setItem(primaryKey, JSON.stringify(value));
}

export function migrateZenithToKanflow(): void {
  const pairs: [string, string][] = [
    [KANFLOW_KEYS.projects, LEGACY.projects],
    [KANFLOW_KEYS.tasks, LEGACY.tasks],
    [KANFLOW_KEYS.notifications, LEGACY.notifications],
    [KANFLOW_KEYS.todos, LEGACY.todos],
    [KANFLOW_KEYS.timeEntries, LEGACY.timeEntries],
    [KANFLOW_KEYS.dashboardWidgets, LEGACY.dashboardWidgets],
    [KANFLOW_KEYS.user, LEGACY.user],
  ];
  for (const [next, prev] of pairs) {
    if (!localStorage.getItem(next) && localStorage.getItem(prev)) {
      localStorage.setItem(next, localStorage.getItem(prev)!);
    }
  }
}
