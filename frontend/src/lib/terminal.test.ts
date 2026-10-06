import { describe, expect, it } from 'vitest';
import { applyTerminalEvent, buildTerminalWsUrl, type TerminalBlock } from './terminal';

describe('buildTerminalWsUrl', () => {
  it('uses an explicit API origin and encodes the token', () => {
    expect(
      buildTerminalWsUrl({
        token: 'a b',
        protocol: 'http:',
        host: 'localhost:3100',
        apiUrl: 'http://localhost:8080',
      }),
    ).toBe('ws://localhost:8080/api/v1/terminal/ws?token=a%20b');
  });

  it('upgrades https API URLs to wss', () => {
    expect(
      buildTerminalWsUrl({
        token: 'tok',
        protocol: 'https:',
        host: 'app.example',
        apiUrl: 'https://api.example',
      }),
    ).toBe('wss://api.example/api/v1/terminal/ws?token=tok');
  });

  it('uses the Vite dev backend when no API URL is set', () => {
    expect(
      buildTerminalWsUrl({
        token: 'tok',
        protocol: 'http:',
        host: 'localhost:3000',
        isDev: true,
      }),
    ).toBe('ws://localhost:8080/api/v1/terminal/ws?token=tok');
  });

  it('falls back to the page host in production', () => {
    expect(
      buildTerminalWsUrl({
        token: 'tok',
        protocol: 'https:',
        host: 'kanflow.example',
      }),
    ).toBe('wss://kanflow.example/api/v1/terminal/ws?token=tok');
  });

  it('treats an empty API URL as unset so Docker same-origin still works', () => {
    expect(
      buildTerminalWsUrl({
        token: 'tok',
        protocol: 'http:',
        host: 'localhost:3100',
        origin: 'http://localhost:3100',
        apiUrl: '',
      }),
    ).toBe('ws://localhost:3100/api/v1/terminal/ws?token=tok');
  });
});

describe('applyTerminalEvent', () => {
  it('starts a command block and streams output', () => {
    const started = applyTerminalEvent([], {
      type: 'started',
      blockId: 'b1',
      command: 'ls',
    });
    expect(started).toEqual([
      { id: 'b1', command: 'ls', output: '', running: true },
    ]);

    const streamed = applyTerminalEvent(started, {
      type: 'output',
      blockId: 'b1',
      data: 'src\n',
    });
    expect(streamed[0]?.output).toBe('src\n');

    const finished = applyTerminalEvent(streamed, {
      type: 'exit',
      blockId: 'b1',
      code: 0,
    });
    expect(finished[0]).toMatchObject({ running: false, exitCode: 0 });
  });

  it('appends output only to the matching block', () => {
    const blocks: TerminalBlock[] = [
      { id: 'a', command: 'echo a', output: 'a', running: false, exitCode: 0 },
      { id: 'b', command: 'echo b', output: '', running: true },
    ];
    const next = applyTerminalEvent(blocks, { type: 'output', blockId: 'b', data: 'b\n' });
    expect(next[0]?.output).toBe('a');
    expect(next[1]?.output).toBe('b\n');
  });

  it('finishes only running blocks when exit has no blockId', () => {
    const blocks: TerminalBlock[] = [
      { id: 'done', command: 'true', output: '', running: false, exitCode: 0 },
      { id: 'live', command: 'sleep 1', output: '', running: true },
    ];
    const next = applyTerminalEvent(blocks, { type: 'exit', code: 130 });
    expect(next[0]).toMatchObject({ running: false, exitCode: 0 });
    expect(next[1]).toMatchObject({ running: false, exitCode: 130 });
  });

  it('ignores ready events', () => {
    expect(
      applyTerminalEvent([], { type: 'ready', cwd: '/workspace', prompt: '~ % ' }),
    ).toEqual([]);
  });
});
