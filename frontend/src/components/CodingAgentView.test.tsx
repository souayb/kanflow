import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider } from '../AppContext';
import CodingAgentView from './CodingAgentView';
import { DEFAULT_T3_URL } from '../lib/t3';

vi.mock('../lib/keycloak', () => ({
  default: { token: 'test-token' },
}));

vi.mock('../lib/terminal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/terminal')>();
  return {
    ...actual,
    terminalWsUrl: () => 'ws://terminal.test/api/v1/terminal/ws?token=test-token',
  };
});

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

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    });
  }

  send(data: string) {
    this.sent.push(String(data));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  emit(payload: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }
}

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

async function renderAgent() {
  await act(async () => {
    render(
      <AppProvider>
        <CodingAgentView />
      </AppProvider>,
    );
  });
}

describe('CodingAgentView', () => {
  beforeEach(() => {
    mockLocalStorage();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'block-fixed',
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('opens T3 in a new tab and does not connect the in-app shell by default', async () => {
    const open = vi.fn().mockReturnValue({ closed: false });
    vi.stubGlobal('open', open);
    const user = userEvent.setup();
    await renderAgent();

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(screen.getByLabelText('T3 URL or pairing link')).toHaveValue(DEFAULT_T3_URL);
    await user.click(screen.getByRole('button', { name: /Open T3 Code/ }));
    expect(open).toHaveBeenCalledWith(DEFAULT_T3_URL, '_blank', 'noopener,noreferrer');
  });

  it('saves a pairing URL then opens it', async () => {
    const open = vi.fn().mockReturnValue({ closed: false });
    vi.stubGlobal('open', open);
    const user = userEvent.setup();
    await renderAgent();

    const field = screen.getByLabelText('T3 URL or pairing link');
    await user.clear(field);
    await user.type(field, 'http://127.0.0.1:8787/pair?token=abc');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: /Open T3 Code/ }));
    expect(open).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/pair?token=abc',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('opens a typed T3 URL without requiring Save first', async () => {
    const open = vi.fn().mockReturnValue({ closed: false });
    vi.stubGlobal('open', open);
    const user = userEvent.setup();
    await renderAgent();

    const field = screen.getByLabelText('T3 URL or pairing link');
    await user.clear(field);
    await user.type(field, 'https://app.t3.codes');
    await user.click(screen.getByRole('button', { name: /Open T3 Code/ }));
    expect(open).toHaveBeenCalledWith('https://app.t3.codes/', '_blank', 'noopener,noreferrer');
  });

  it('connects the optional Warp-style shell after switching surfaces', async () => {
    const user = userEvent.setup();
    await renderAgent();
    expect(FakeWebSocket.instances).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'In-app terminal' }));

    const socket = FakeWebSocket.instances[0];
    expect(socket).toBeDefined();
    expect(socket?.url).toContain('/api/v1/terminal/ws');

    await act(async () => {
      socket?.emit({ type: 'ready', cwd: '/workspace', prompt: '~/kanban % ' });
    });

    await waitFor(() => {
      expect(screen.getByText(/Ready · \/workspace/)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Command'), 'ls');
    await user.click(screen.getByRole('button', { name: 'Run' }));

    expect(socket?.sent).toEqual([
      JSON.stringify({ type: 'input', blockId: 'block-fixed', data: 'ls' }),
    ]);

    await act(async () => {
      socket?.emit({ type: 'started', blockId: 'block-fixed', command: 'ls' });
      socket?.emit({ type: 'output', blockId: 'block-fixed', data: 'src\n' });
    });

    expect(screen.getByText('~/kanban % ls')).toBeInTheDocument();
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.getByLabelText('Command')).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(socket?.sent[1]).toBe(JSON.stringify({ type: 'interrupt' }));

    await act(async () => {
      socket?.emit({ type: 'exit', blockId: 'block-fixed', code: 130 });
    });

    expect(screen.getByText('Exit 130')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  });

  it('shows a connection error when the optional shell socket fails', async () => {
    const user = userEvent.setup();
    await renderAgent();
    await user.click(screen.getByRole('button', { name: 'In-app terminal' }));
    const socket = FakeWebSocket.instances[0];
    await act(async () => {
      socket?.onerror?.(new Event('error'));
    });
    expect(screen.getByText('Could not reach the coding-agent terminal.')).toBeInTheDocument();
  });
});
