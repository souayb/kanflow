import keycloak from './keycloak';

export type TerminalBlock = {
  id: string;
  command: string;
  output: string;
  exitCode?: number;
  running: boolean;
};

export type TerminalEvent =
  | { type: 'ready'; cwd: string; prompt: string }
  | { type: 'started'; blockId: string; command: string }
  | { type: 'output'; blockId: string; data: string }
  | { type: 'exit'; blockId?: string; code: number; message?: string };

export function buildTerminalWsUrl(opts: {
  token?: string;
  protocol: string;
  host: string;
  origin?: string;
  apiUrl?: string;
  isDev?: boolean;
}): string {
  const query = `token=${encodeURIComponent(opts.token ?? '')}`;
  if (opts.apiUrl) {
    const api = new URL(opts.apiUrl, opts.origin ?? `${opts.protocol}//${opts.host}`);
    const wsProto = api.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProto}://${api.host}/api/v1/terminal/ws?${query}`;
  }
  if (opts.isDev) {
    return `ws://localhost:8080/api/v1/terminal/ws?${query}`;
  }
  const wsProto = opts.protocol === 'https:' ? 'wss' : 'ws';
  return `${wsProto}://${opts.host}/api/v1/terminal/ws?${query}`;
}

export function terminalWsUrl(): string {
  return buildTerminalWsUrl({
    token: keycloak.token ?? '',
    protocol: window.location.protocol,
    host: window.location.host,
    origin: window.location.origin,
    apiUrl: (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL,
    isDev: Boolean(import.meta.env.DEV),
  });
}

export function applyTerminalEvent(blocks: TerminalBlock[], event: TerminalEvent): TerminalBlock[] {
  switch (event.type) {
    case 'started':
      return [
        ...blocks,
        { id: event.blockId, command: event.command, output: '', running: true },
      ];
    case 'output':
      return blocks.map((block) =>
        block.id === event.blockId ? { ...block, output: block.output + event.data } : block,
      );
    case 'exit':
      return blocks.map((block) => {
        const matches = event.blockId ? block.id === event.blockId : block.running;
        return matches ? { ...block, running: false, exitCode: event.code } : block;
      });
    default:
      return blocks;
  }
}
