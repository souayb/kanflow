import { describe, expect, it } from 'vitest';
import { applyTerminalEvent, type TerminalBlock } from './terminal';

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
});
