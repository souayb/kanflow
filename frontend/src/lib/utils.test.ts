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
    expect(getPriorityColor('high')).toContain('#eb5757');
    expect(getPriorityColor('medium')).toContain('#f7b928');
    expect(getPriorityColor('low')).toContain('#27a644');
  });
});
