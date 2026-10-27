import { afterEach, it, expect, vi } from 'vitest';
import { createDatabase, initialize } from '../src/core/database.ts';
import type { Database } from '../src/features/todos/types.ts';

afterEach(() => vi.restoreAllMocks());

it('creates a client with a todo delegate', () => {
  const database = createDatabase('postgresql://test:test@localhost:5432/test');
  expect(database.todo).toBeDefined();
});
it('creates the todos table', async () => {
  const executeRaw = vi.fn().mockResolvedValue(0);
  await initialize({ $executeRaw: executeRaw } as unknown as Database);
  expect(executeRaw).toHaveBeenCalledTimes(1);
});
it('propagates initialization failures', async () => {
  const executeRaw = vi.fn().mockRejectedValue(new Error('denied'));
  await expect(initialize({ $executeRaw: executeRaw } as unknown as Database)).rejects.toThrow('denied');
});
