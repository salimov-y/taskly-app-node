import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { start } from '../src/core/lifespan.ts';
import { createDatabase, initialize } from '../src/core/database.ts';
import { createApp } from '../src/factory.ts';

vi.mock('../src/core/database.ts', () => ({ createDatabase: vi.fn(), initialize: vi.fn() }));
vi.mock('../src/core/config.ts', () => ({ resolveDatabaseUrl: vi.fn().mockReturnValue('postgresql://test') }));
vi.mock('../src/factory.ts', () => ({ createApp: vi.fn() }));

function setup() {
  const database = { $connect: vi.fn().mockResolvedValue(undefined), $disconnect: vi.fn().mockResolvedValue(undefined) };
  const server = Object.assign(new EventEmitter(), {
    address: vi.fn().mockReturnValue({ port: 8123 }),
    close: vi.fn((callback: () => void) => callback())
  });
  const listen = vi.fn((port: number, host: string, callback: () => void) => {
    queueMicrotask(callback);
    return server;
  });
  vi.mocked(createDatabase).mockReturnValue(database as never);
  vi.mocked(initialize).mockResolvedValue(undefined);
  vi.mocked(createApp).mockReturnValue({ listen } as never);
  return { database, server, listen };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process, 'once').mockImplementation((() => process) as never);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  process.exitCode = undefined;
});

it('connects, initializes and listens on the configured port', async () => {
  vi.stubEnv('API_PORT', '9001');
  const { database, server, listen } = setup();
  const result = await start();
  expect(database.$connect).toHaveBeenCalled();
  expect(initialize).toHaveBeenCalledWith(database);
  expect(listen).toHaveBeenCalledWith(9001, '0.0.0.0', expect.any(Function));
  expect(result).toEqual({ server, database });
  expect(console.log).toHaveBeenCalledWith('Taskly App Node API listening on port 8123');
});
it('listens on port 8000 by default', async () => {
  vi.stubEnv('API_PORT', '');
  const { listen } = setup();
  await start();
  expect(listen).toHaveBeenCalledWith(8000, '0.0.0.0', expect.any(Function));
});
it('disconnects and rethrows when the connection fails', async () => {
  const { database } = setup();
  database.$connect.mockRejectedValue(new Error('refused'));
  await expect(start()).rejects.toThrow('refused');
  expect(database.$disconnect).toHaveBeenCalled();
});
it('rejects when the server emits an error', async () => {
  const { database, listen } = setup();
  const failure = new Error('in use');
  listen.mockImplementation(() => {
    const failing = new EventEmitter();
    queueMicrotask(() => failing.emit('error', failure));
    return failing as never;
  });
  await expect(start()).rejects.toThrow('in use');
  expect(database.$disconnect).toHaveBeenCalled();
});
it('registers shutdown handlers that close the server and disconnect', async () => {
  const { database, server } = setup();
  await start();
  const calls = vi.mocked(process.once).mock.calls;
  expect(calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGINT']);
  (calls[0][1] as () => void)();
  await vi.waitFor(() => expect(database.$disconnect).toHaveBeenCalled());
  expect(server.close).toHaveBeenCalled();
  expect(process.exitCode).toBeUndefined();
});
it('sets a failing exit code when disconnecting during shutdown fails', async () => {
  const { database } = setup();
  const failure = new Error('stuck');
  await start();
  database.$disconnect.mockRejectedValue(failure);
  (vi.mocked(process.once).mock.calls[1][1] as () => void)();
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
  expect(console.error).toHaveBeenCalledWith(failure);
});
it('exits with code 1 when shutdown takes too long', async () => {
  vi.useFakeTimers();
  const { server } = setup();
  server.close.mockImplementation((() => {}) as never);
  const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  await start();
  (vi.mocked(process.once).mock.calls[0][1] as () => void)();
  vi.advanceTimersByTime(10000);
  expect(exit).toHaveBeenCalledWith(1);
});
