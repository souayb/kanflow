import { describe, expect, it } from 'vitest';
import { getAvatarColor, getAvatarInitials } from './utils';

const AVATAR_COLORS = ['#0064E0', '#9360F7', '#F3425F', '#2ABBA7', '#FB724B', '#465A69'];

describe('getAvatarInitials', () => {
  it('returns first letters of two-word name', () => {
    expect(getAvatarInitials('Alice Bob')).toBe('AB');
  });

  it('uses first two chars for single-word name', () => {
    expect(getAvatarInitials('Alice')).toBe('AL');
  });

  it('uppercases result', () => {
    expect(getAvatarInitials('john doe')).toBe('JD');
  });

  it('handles extra whitespace', () => {
    expect(getAvatarInitials('  Jane   Smith  ')).toBe('JS');
  });

  it('uses more than two name parts — only first two initials', () => {
    expect(getAvatarInitials('Mary Jane Watson')).toBe('MJ');
  });
});

describe('getAvatarColor', () => {
  it('returns one of the 6 palette colors', () => {
    const color = getAvatarColor('Alice');
    expect(AVATAR_COLORS).toContain(color);
  });

  it('is deterministic — same input always returns same color', () => {
    expect(getAvatarColor('Bob')).toBe(getAvatarColor('Bob'));
    expect(getAvatarColor('Charlie')).toBe(getAvatarColor('Charlie'));
  });

  it('different inputs produce potentially different colors', () => {
    // At least one pair should differ (6 colors, pigeonhole)
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta'];
    const colors = names.map(getAvatarColor);
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('handles empty string without throwing', () => {
    expect(() => getAvatarColor('')).not.toThrow();
    expect(AVATAR_COLORS).toContain(getAvatarColor(''));
  });
});
