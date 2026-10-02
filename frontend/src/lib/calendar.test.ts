import { describe, expect, it, vi } from 'vitest';
import { buildTaskCalendar } from './calendar';
import type { Project, Task, User } from '../types';

const user: User = { id: 'u1', name: 'Alex', email: 'alex@example.com', role: 'member' };
const project: Project = {
  id: 'p1',
  name: 'Launch',
  description: '',
  ownerId: 'u1',
  createdAt: 0,
  columns: [
    { id: 'todo', title: 'To Do', order: 0 },
    { id: 'done', title: 'Done', order: 1 },
  ],
};
const task: Task = {
  id: 't1',
  title: 'Ship, safely',
  description: 'Release checklist',
  projectId: 'p1',
  status: 'todo',
  priority: 'high',
  assigneeId: 'u1',
  dueDate: Date.UTC(2026, 9, 5),
  tags: ['release'],
  position: 1,
  comments: [],
  dependencies: [],
  createdAt: 1,
  updatedAt: Date.UTC(2026, 9, 1),
};

describe('buildTaskCalendar', () => {
  it('exports assigned due tasks as valid all-day events', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' } });
    const ics = buildTaskCalendar([task], [project], user, {
      assignedOnly: true,
      includeCompleted: false,
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261005');
    expect(ics).toContain('SUMMARY:Ship\\, safely');
    expect(ics).toContain('UID:t1@kanflow');
    vi.unstubAllGlobals();
  });

  it('excludes completed tasks by default', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3000' } });
    const ics = buildTaskCalendar([{ ...task, status: 'done' }], [project], user, {
      assignedOnly: true,
      includeCompleted: false,
    });
    expect(ics).not.toContain('BEGIN:VEVENT');
    vi.unstubAllGlobals();
  });
});
