import request from 'supertest';
import { afterEach, it, expect, vi } from 'vitest';
import { createApp } from '../src/factory.ts';
import type { Database } from '../src/features/todos/types.ts';
import { record, todo } from './fixture.ts';

function setup() {
  const database = { todo: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([record]) } };
  return { app: createApp(database as unknown as Database), database };
}
afterEach(() => vi.restoreAllMocks());

it('serves the todos router', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
});
it('serves the health router', async () => {
  const { app } = setup();
  const response = await request(app).get('/api/health');
  expect(response.body).toEqual({ status: 'ok' });
});
it('serves the openapi specification', async () => {
  const { app } = setup();
  const response = await request(app).get('/openapi.json');
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('openapi');
});
it('does not expose the x-powered-by header', async () => {
  const { app } = setup();
  expect((await request(app).get('/api/health')).headers['x-powered-by']).toBeUndefined();
});
it('returns 404 for unknown routes', async () => {
  const { app } = setup();
  const response = await request(app).get('/nope');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Not Found' });
});
it('returns 422 for malformed JSON', async () => {
  const { app } = setup();
  const response = await request(app).post('/api/todos').set('Content-Type', 'application/json').send('{bad');
  expect(response.status).toBe(422);
  expect(response.body).toEqual({ detail: 'Invalid JSON.' });
});
it('returns 413 for oversized bodies', async () => {
  const { app } = setup();
  const response = await request(app).post('/api/todos').send({ title: 'x'.repeat(200000) });
  expect(response.status).toBe(413);
  expect(response.body).toEqual({ detail: 'Request body too large.' });
});
it('returns 500 and logs unexpected errors', async () => {
  const { app, database } = setup();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  database.todo.findMany.mockRejectedValue(new Error('boom'));
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ detail: 'Internal Server Error' });
  expect(log).toHaveBeenCalled();
});
