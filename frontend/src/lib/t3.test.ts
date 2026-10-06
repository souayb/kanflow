import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KANFLOW_KEYS } from './storage';
import {
  DEFAULT_T3_URL,
  normalizeT3Url,
  openT3,
  readAgentSurface,
  readT3Url,
  writeAgentSurface,
  writeT3Url,
} from './t3';

function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage);
}

describe('t3 launcher helpers', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes pairing URLs and hostnames', () => {
    expect(normalizeT3Url(' https://app.t3.codes ')).toBe('https://app.t3.codes/');
    expect(normalizeT3Url('127.0.0.1:8787')).toBe('https://127.0.0.1:8787/');
    expect(normalizeT3Url('http://192.168.1.12:8787/pair?token=abc')).toBe(
      'http://192.168.1.12:8787/pair?token=abc',
    );
    expect(normalizeT3Url('ftp://nope')).toBeNull();
    expect(normalizeT3Url('not a url')).toBeNull();
  });

  it('reads the default T3 URL until one is saved', () => {
    expect(readT3Url()).toBe(DEFAULT_T3_URL);
    expect(writeT3Url('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787/');
    expect(localStorage.getItem(KANFLOW_KEYS.t3Url)).toBe('http://127.0.0.1:8787/');
    expect(readT3Url()).toBe('http://127.0.0.1:8787/');
  });

  it('defaults the agent surface to T3 and persists Warp as optional', () => {
    expect(readAgentSurface()).toBe('t3');
    writeAgentSurface('warp');
    expect(readAgentSurface()).toBe('warp');
  });

  it('opens T3 in a new tab', () => {
    const open = vi.fn().mockReturnValue(null);
    openT3('https://app.t3.codes/', open);
    expect(open).toHaveBeenCalledWith('https://app.t3.codes/', '_blank', 'noopener,noreferrer');
  });
});
