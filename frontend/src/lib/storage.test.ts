import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KANFLOW_KEYS, migrateZenithToKanflow, readStoredJson, writeStoredJson } from './storage';

/** Minimal Storage mock — Vitest's jsdom build may omit full localStorage in some setups. */
function mockLocalStorage() {
  const store: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
  vi.stubGlobal('localStorage', ls);
  return store;
}

describe('storage (MISSION §6 — Kanflow keys)', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('readStoredJson returns parsed value from primary key', () => {
    writeStoredJson(KANFLOW_KEYS.projects, [{ id: 'p1', name: 'A' }]);
    const data = readStoredJson<{ id: string; name: string }[]>(KANFLOW_KEYS.projects);
    expect(data).toEqual([{ id: 'p1', name: 'A' }]);
  });

  it('migrateZenithToKanflow copies legacy keys when Kanflow slot is empty', () => {
    localStorage.setItem('zenith_tasks', JSON.stringify([{ id: 't1' }]));
    expect(localStorage.getItem(KANFLOW_KEYS.tasks)).toBeNull();

    migrateZenithToKanflow();

    expect(JSON.parse(localStorage.getItem(KANFLOW_KEYS.tasks)!)).toEqual([{ id: 't1' }]);
  });

  it('migrateZenithToKanflow does not overwrite existing Kanflow data', () => {
    writeStoredJson(KANFLOW_KEYS.tasks, [{ id: 'new' }]);
    localStorage.setItem('zenith_tasks', JSON.stringify([{ id: 'old' }]));
    migrateZenithToKanflow();
    expect(JSON.parse(localStorage.getItem(KANFLOW_KEYS.tasks)!)).toEqual([{ id: 'new' }]);
  });
});
