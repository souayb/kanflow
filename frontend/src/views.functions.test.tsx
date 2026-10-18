/**
 * Cross-view function coverage — each main surface renders and its primary action works offline.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from './AppContext';
import type { AppView } from './App';
import Layout from './components/Layout';
import DashboardView from './components/DashboardView';
import KanbanView from './components/KanbanView';
import CollaborationView from './components/CollaborationView';
import ReviewsView from './components/ReviewsView';
import ReportingView from './components/ReportingView';
import PersonalTodoView from './components/PersonalTodoView';
import TimeKeepingView from './components/TimeKeepingView';
import CodingAgentView from './components/CodingAgentView';

vi.mock('./lib/api', () => ({
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
    getGithubStatus: vi.fn().mockRejectedValue(new Error('offline')),
    listWorkSessions: vi.fn().mockRejectedValue(new Error('offline')),
    listActivity: vi.fn().mockRejectedValue(new Error('offline')),
    listChat: vi.fn().mockRejectedValue(new Error('offline')),
  },
}));

vi.mock('./lib/ai', () => ({
  summarizeProjectProgress: vi.fn().mockResolvedValue('Offline insight for tests.'),
  enhanceTask: vi.fn().mockRejectedValue(new Error('offline')),
}));

vi.mock('./components/AuthProvider', () => ({
  useAuth: () => ({ logout: vi.fn(), kcUser: null }),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_t, tag: string) =>
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
  } as Storage);
}

function AppShell() {
  const [currentView, setCurrentView] = React.useState<AppView>('kanban');
  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'dashboard' && <DashboardView />}
      {currentView === 'kanban' && <KanbanView />}
      {currentView === 'collaboration' && <CollaborationView />}
      {currentView === 'reviews' && <ReviewsView />}
      {currentView === 'reporting' && <ReportingView />}
      {currentView === 'todos' && <PersonalTodoView />}
      {currentView === 'time' && <TimeKeepingView />}
      {currentView === 'agent' && <CodingAgentView />}
    </Layout>
  );
}

async function renderApp() {
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <AppProvider>
        <AppShell />
      </AppProvider>,
    );
  });
  return result!;
}

describe('app view functions', () => {
  beforeEach(() => {
    mockLocalStorage();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sidebar switches every primary view', async () => {
    await renderApp();
    const nav = () => screen.getByRole('navigation', { name: 'Primary' });
    const clickNav = async (label: string) => {
      await act(async () => {
        fireEvent.click(within(nav()).getByRole('button', { name: label }));
      });
    };

    await clickNav('Dashboard');
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    await clickNav('Collaboration');
    expect(screen.getByRole('heading', { name: 'Collaboration' })).toBeInTheDocument();
    await clickNav('Reviews');
    expect(screen.getByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
    await clickNav('Reporting');
    expect(screen.getByRole('heading', { name: 'Reporting' })).toBeInTheDocument();
    await clickNav('Personal todos');
    expect(screen.getByRole('heading', { name: 'Personal todos' })).toBeInTheDocument();
    await clickNav('Time');
    expect(screen.getByRole('heading', { name: 'Time keeping' })).toBeInTheDocument();
    await clickNav('Coding agent');
    expect(screen.getByRole('heading', { name: 'Coding agent' })).toBeInTheDocument();
    await clickNav('Board');
    expect(screen.getByRole('button', { name: /^Filter$/i })).toBeInTheDocument();
  });

  it('personal todos can be added from the form', async () => {
    await renderApp();
    await act(async () => {
      fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Personal todos' }));
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('What needs doing?'), {
        target: { value: 'Ship tests' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));
    });

    expect(screen.getByText('Ship tests')).toBeInTheDocument();
  });

  it('time keeping starts and stops a timer on a project task', async () => {
    await renderApp();
    await act(async () => {
      fireEvent.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('button', { name: 'Time' }));
    });

    expect(screen.getByText('Ready')).toBeInTheDocument();

    const trackButtons = screen.getAllByRole('button').filter((b) => b.textContent?.includes('priority'));
    expect(trackButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(trackButtons[0]!);
    });
    expect(screen.getByText('Timer running')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Stop timer/i }));
    });
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Logged')).toBeInTheDocument();
  });

  it('dashboard and reporting render project overview widgets', async () => {
    await renderApp();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await act(async () => {
      fireEvent.click(within(nav).getByRole('button', { name: 'Dashboard' }));
    });
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Customize widgets/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(nav).getByRole('button', { name: 'Reporting' }));
    });
    expect(screen.getByRole('heading', { name: 'Reporting' })).toBeInTheDocument();
    expect(screen.getByText(/Completion rate by assignee/i)).toBeInTheDocument();
  });
});
