/**
 * KanbanView button interaction tests.
 * Validates: Add task button flow, Cancel button, Enter key submission, empty-title guard.
 */
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../AppContext';
import KanbanView from './KanbanView';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../lib/api', () => ({
  api: {
    getProjects: vi.fn().mockRejectedValue(new Error('offline')),
    getUsers: vi.fn().mockRejectedValue(new Error('offline')),
    getMe: vi.fn().mockRejectedValue(new Error('offline')),
    getColumns: vi.fn().mockRejectedValue(new Error('offline')),
    getTasks: vi.fn().mockRejectedValue(new Error('offline')),
    createTask: vi.fn().mockRejectedValue(new Error('offline')),
    updateTask: vi.fn().mockRejectedValue(new Error('offline')),
    deleteTask: vi.fn().mockRejectedValue(new Error('offline')),
    addComment: vi.fn().mockRejectedValue(new Error('offline')),
  },
}));

// Stub framer-motion so layoutId/etc. don't bleed into the DOM
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_t, tag: string) =>
          // eslint-disable-next-line react/display-name
          ({ children, layoutId: _l, ...rest }: React.HTMLAttributes<HTMLElement> & { layoutId?: string }) =>
            React.createElement(tag as string, rest, children),
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage);
}

async function renderKanban() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <AppProvider>
        <KanbanView />
      </AppProvider>,
    );
  });
  return result!;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('KanbanView buttons', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the board toolbar without a project hero', async () => {
    await renderKanban();
    expect(screen.queryByText('Active project')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /Kanflow product launch/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter/i })).toBeInTheDocument();
  });

  it('renders all 4 column headers from the active project', async () => {
    await renderKanban();
    // Column headers are h3 elements
    const headings = screen.getAllByRole('heading', { level: 3 });
    const titles = headings.map((h) => h.textContent);
    expect(titles).toContain('To Do');
    expect(titles).toContain('In Progress');
    expect(titles).toContain('Review');
    expect(titles).toContain('Done');
  });

  it('"Add task" button shows the task input form', async () => {
    await renderKanban();
    // Each column has an "Add task" button (by accessible name matching the svg+text)
    const addButtons = screen.getAllByRole('button', { name: /Add task/i });
    expect(addButtons.length).toBeGreaterThan(0);

    await act(async () => { fireEvent.click(addButtons[0]); });

    expect(screen.getByPlaceholderText('Task title…')).toBeInTheDocument();
  });

  it('"Cancel" button hides the task input form', async () => {
    await renderKanban();

    const addButtons = screen.getAllByRole('button', { name: /Add task/i });
    await act(async () => { fireEvent.click(addButtons[0]); });

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await act(async () => { fireEvent.click(cancelBtn); });

    expect(screen.queryByPlaceholderText('Task title…')).not.toBeInTheDocument();
  });

  it('submitting a task title via the confirm button adds the task to the board', async () => {
    await renderKanban();

    const addButtons = screen.getAllByRole('button', { name: /Add task/i });
    await act(async () => { fireEvent.click(addButtons[0]); });

    const input = screen.getByPlaceholderText('Task title…');
    await act(async () => { fireEvent.change(input, { target: { value: 'My new task' } }); });

    // The inline confirm "Add task" button (inside the form, not the column footer)
    const confirmBtns = screen.getAllByRole('button', { name: /^Add task$/i });
    // After opening the form, one of these is the confirm button
    const confirmBtn = confirmBtns.find((b) => !b.className.includes('w-full'));
    await act(async () => { fireEvent.click(confirmBtn ?? confirmBtns[0]); });

    expect(screen.queryByPlaceholderText('Task title…')).not.toBeInTheDocument();
    expect(screen.getByText('My new task')).toBeInTheDocument();
  });

  it('pressing Enter in the task input submits the task', async () => {
    await renderKanban();

    const addButtons = screen.getAllByRole('button', { name: /Add task/i });
    await act(async () => { fireEvent.click(addButtons[0]); });

    const input = screen.getByPlaceholderText('Task title…');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Enter-submitted task' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    expect(screen.queryByPlaceholderText('Task title…')).not.toBeInTheDocument();
    expect(screen.getByText('Enter-submitted task')).toBeInTheDocument();
  });

  it('empty title does not submit — input stays visible', async () => {
    await renderKanban();

    const addButtons = screen.getAllByRole('button', { name: /Add task/i });
    await act(async () => { fireEvent.click(addButtons[0]); });

    // Do not type anything — just click the confirm Add task button
    const confirmBtns = screen.getAllByRole('button', { name: /^Add task$/i });
    const confirmBtn = confirmBtns.find((b) => !b.className.includes('w-full'));
    await act(async () => { fireEvent.click(confirmBtn ?? confirmBtns[0]); });

    expect(screen.getByPlaceholderText('Task title…')).toBeInTheDocument();
  });

  it('Filter opens the board filters panel', async () => {
    await renderKanban();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Filter$/i }));
    });
    expect(screen.getByRole('region', { name: 'Board filters' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Title, description, tags/i)).toBeInTheDocument();
  });

  it('clicking a task card opens the task editor', async () => {
    await renderKanban();
    await act(async () => {
      fireEvent.click(screen.getByText('Implement Dark Mode'));
    });
    expect(screen.getByDisplayValue('Implement Dark Mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AI refine/i })).toBeInTheDocument();
  });
});
