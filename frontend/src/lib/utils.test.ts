import { describe, expect, it } from 'vitest';
import { formatDate, getPriorityColor } from './utils';

describe('utils', () => {
  it('formatDate renders a stable short date', () => {
    const s = formatDate(new Date('2026-04-15T12:00:00Z').getTime());
    expect(s).toMatch(/Apr/);
    expect(s).toMatch(/15/);
    expect(s).toMatch(/2026/);
  });

  it('getPriorityColor maps priorities to design tokens', () => {
    expect(getPriorityColor('high')).toContain('#C80A28');
    expect(getPriorityColor('medium')).toContain('#F7B928');
    expect(getPriorityColor('low')).toContain('#007D1E');
  });
});
