---
name: backend-unit-tests
description: Conventions for Vitest unit tests of the Taskly App Node backend (Express routers and app factory, Prisma repository, Zod validators, mappers, config). Use it when creating or updating tests for files in backend/src.
---

# Backend unit tests

Stack: Node.js 22, TypeScript (ESM, NodeNext), Express 5, Prisma 7 with the pg adapter, Zod 4, Vitest 4, Supertest.

## Files

- One test file per source module in `backend/tests/`: `router.test.ts`, `repository.test.ts`. Name new ones after the module: `factory.test.ts`, `config.test.ts`, `health.test.ts`.
- Import the source with the `.ts` extension: `import { createTodosRouter } from '../src/features/todos/router.ts'`.
- Import the Vitest functions you use: `import { afterEach, it, expect, vi } from 'vitest'`.
- Shared data is in `tests/fixture.ts`: `record` is a database row, `todo` is the API shape. Reuse it instead of copying data.

## Isolation

- Routers: mount the router on a new `express()` app with `express.json()` and a fake store made of `vi.fn()` methods, as `setup()` in `tests/router.test.ts` does. Call it with `supertest`.
- Repository: create the real client with `createDatabase('postgresql://test:test@localhost:5432/test')` and spy on the delegate, `vi.spyOn(database.todo, 'findMany')`. The client never connects. Restore spies with `afterEach(() => vi.restoreAllMocks())`.
- App factory and health router: pass a fake database object such as `{ todo: { findFirst: vi.fn() } }`, cast to the parameter type, and test status codes and JSON bodies through supertest.
- Error responses: make a fake method reject and assert the response. Silence the expected log with `vi.spyOn(console, 'error').mockImplementation(() => {})` and assert it was called.
- Environment: `vi.stubEnv(name, value)` with `afterEach(() => vi.unstubAllEnvs())`. Do not depend on a real `.env`.
- Raw SQL calls such as `$executeRaw`: spy on the client method and assert the call, not the full SQL text.
- Never listen on a fixed port, connect to PostgreSQL or call the network.

## Assertions

- Every route branch: success, 404 `{ detail: 'Task not found.' }`, 422 with the Zod issues in `detail`, 413 and 422 from the body parser, 500.
- The exact arguments passed to the store or Prisma, and that nothing is called when validation fails.
- Schema boundaries: title 1 to 120 characters after trimming, description up to 2000, priorities `low`, `medium`, `high`, ISO calendar dates, positive integer ids up to `Number.MAX_SAFE_INTEGER`.

## Style

- Top-level `it` blocks like the existing files, `describe` only where the file already groups tests, `it.each` for input tables.
- Compact tests, no comments, variable names after the entity: `createdTodo`, `missingTodoId`.
- Every test builds its own app or repository through a local `setup()`, so tests do not share state.
