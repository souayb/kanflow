import type { Project, Task, User } from '../types';

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function dateOnly(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
}

function addUtcDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.getTime();
}

export function buildTaskCalendar(
  tasks: Task[],
  projects: Project[],
  currentUser: User | null,
  options: { assignedOnly: boolean; includeCompleted: boolean },
): string {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const events = tasks.filter((task) => {
    if (!task.dueDate) return false;
    if (options.assignedOnly && task.assigneeId !== currentUser?.id) return false;
    const project = projectById.get(task.projectId);
    const done = project?.columns.some(
      (column) => column.id === task.status && column.title.trim().toLowerCase() === 'done',
    );
    return options.includeCompleted || !done;
  });

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kanflow//Task Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Kanflow Tasks',
  ];
  for (const task of events) {
    const project = projectById.get(task.projectId);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@kanflow`,
      `DTSTAMP:${new Date(task.updatedAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      `DTSTART;VALUE=DATE:${dateOnly(task.dueDate!)}`,
      `DTEND;VALUE=DATE:${dateOnly(addUtcDay(task.dueDate!))}`,
      `SUMMARY:${escapeIcs(task.title)}`,
      `DESCRIPTION:${escapeIcs(task.description || 'Kanflow task')}`,
      `CATEGORIES:${escapeIcs([project?.name, ...task.tags].filter(Boolean).join(','))}`,
      `URL:${window.location.origin}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadCalendar(ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'kanflow-tasks.ics';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
