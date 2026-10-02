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

export function terminalWsUrl(): string {
  const token = keycloak.token ?? '';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  const explicit = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
  if (explicit) {
    const api = new URL(explicit, window.location.origin);
    const wsProto = api.protocol === 'https:' ? 'wss' : 'ws';
    return `${wsProto}://${api.host}/api/v1/terminal/ws?token=${encodeURIComponent(token)}`;
  }
  if (import.meta.env.DEV) {
    return `ws://localhost:8080/api/v1/terminal/ws?token=${encodeURIComponent(token)}`;
  }
  return `${proto}://${host}/api/v1/terminal/ws?token=${encodeURIComponent(token)}`;
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
      return blocks.map((block) =>
        !event.blockId || block.id === event.blockId
          ? { ...block, running: false, exitCode: event.code }
          : block,
      );
    default:
      return blocks;
  }
}
