import express from 'express';
import request from 'supertest';
import { it, expect, vi } from 'vitest';
import { createHealthRouter } from '../src/api/health.ts';
import type { Database } from '../src/features/todos/types.ts';

function setup() {
  const database = { todo: { findFirst: vi.fn().mockResolvedValue(null) } };
  const app = express();
  app.use('/api', createHealthRouter(database as unknown as Database));
  return { app, database };
}
it('reports ok after querying the database', async () => {
  const { app, database } = setup();
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok' });
  expect(database.todo.findFirst).toHaveBeenCalledWith({ select: { id: true } });
});
it('returns 500 when the database query fails', async () => {
  const { app, database } = setup();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  database.todo.findFirst.mockRejectedValue(new Error('down'));
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(500);
});
