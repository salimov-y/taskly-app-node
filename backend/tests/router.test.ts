import express from 'express';
import request from 'supertest';
import { it, expect, vi } from 'vitest';
import { createTodosRouter } from '../src/features/todos/router.ts';
import { todo } from './fixture.ts';

function setup() {
  const repository = { list: vi.fn().mockResolvedValue([todo]), create: vi.fn().mockResolvedValue(todo), get: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteCompleted: vi.fn().mockResolvedValue(2) };
  const app = express();
  app.use(express.json());
  app.use('/api/todos', createTodosRouter(repository));
  return { app, repository };
}
it('lists tasks from the repository', async () => {
  const { app, repository } = setup();
  const response = await request(app).get('/api/todos');
  expect(response.status).toBe(200);
  expect(response.body).toEqual([todo]);
  expect(repository.list).toHaveBeenCalledOnce();
});
it('creates tasks with trimmed input and defaults', async () => {
  const { app, repository } = setup();
  const response = await request(app).post('/api/todos').send({ title: '  Plan the sprint  ', priority: 'high' });
  expect(response.status).toBe(201);
  expect(response.body).toEqual(todo);
  expect(repository.create).toHaveBeenCalledWith({ title: 'Plan the sprint', description: '', priority: 'high', due_date: null, completed: false });
});
it.each([{ title: '  ' }, { title: 'x'.repeat(121) }, { title: 'Task', priority: 'urgent' }, { title: 'Task', due_date: '2026-02-30' }])(
  'rejects invalid create input without calling the repository: %j', async (payload) => {
    const { app, repository } = setup();
    expect((await request(app).post('/api/todos').send(payload)).status).toBe(422);
    expect(repository.create).not.toHaveBeenCalled();
  },
);
it('gets a task by id', async () => {
  const { app, repository } = setup();
  repository.get.mockResolvedValue(todo);
  const response = await request(app).get('/api/todos/1');
  expect(response.status).toBe(200);
  expect(response.body).toEqual(todo);
  expect(repository.get).toHaveBeenCalledWith(1);
});
it('returns 404 when the task to get is missing', async () => {
  const { app, repository } = setup();
  repository.get.mockResolvedValue(null);
  const response = await request(app).get('/api/todos/7');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
it.each(['abc', '0', '-1', '1.5', '9007199254740992'])('rejects invalid id %s without calling the repository', async (id) => {
  const { app, repository } = setup();
  expect((await request(app).get(`/api/todos/${id}`)).status).toBe(422);
  expect((await request(app).delete(`/api/todos/${id}`)).status).toBe(422);
  expect(repository.get).not.toHaveBeenCalled();
  expect(repository.delete).not.toHaveBeenCalled();
});
it('updates a task with trimmed input', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue(todo);
  const response = await request(app).patch('/api/todos/1').send({ title: '  New  ', completed: true });
  expect(response.status).toBe(200);
  expect(response.body).toEqual(todo);
  expect(repository.update).toHaveBeenCalledWith(1, { title: 'New', completed: true });
});
it('returns 404 when the task to update is missing', async () => {
  const { app, repository } = setup();
  repository.update.mockResolvedValue(null);
  const response = await request(app).patch('/api/todos/7').send({ completed: true });
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
it.each([{}, { title: '' }, { priority: 'urgent' }, { unknown: 1 }])('rejects invalid update input without calling the repository: %j', async (payload) => {
  const { app, repository } = setup();
  expect((await request(app).patch('/api/todos/1').send(payload)).status).toBe(422);
  expect(repository.update).not.toHaveBeenCalled();
});
it('deletes a task', async () => {
  const { app, repository } = setup();
  repository.delete.mockResolvedValue(true);
  const response = await request(app).delete('/api/todos/3');
  expect(response.status).toBe(204);
  expect(repository.delete).toHaveBeenCalledWith(3);
});
it('deletes completed tasks and returns the count', async () => {
  const { app, repository } = setup();
  const response = await request(app).delete('/api/todos/completed');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ deleted: 2 });
  expect(repository.deleteCompleted).toHaveBeenCalledOnce();
  expect(repository.delete).not.toHaveBeenCalled();
});
it('returns a zero count when no completed tasks exist', async () => {
  const { app, repository } = setup();
  repository.deleteCompleted.mockResolvedValue(0);
  const response = await request(app).delete('/api/todos/completed');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ deleted: 0 });
});
it('returns 404 when the task to delete is missing', async () => {
  const { app, repository } = setup();
  repository.delete.mockResolvedValue(false);
  const response = await request(app).delete('/api/todos/3');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ detail: 'Task not found.' });
});
