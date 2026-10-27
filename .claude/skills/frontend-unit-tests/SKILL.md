---
name: frontend-unit-tests
description: Conventions for Vitest and React Testing Library unit tests of the Taskly App Node frontend (components, hooks, API client, utilities). Use it when creating or updating tests for files in frontend/src.
---

# Frontend unit tests

Stack: React 19, TypeScript, TanStack Query 5, styled-components, Vitest 4 with jsdom, React Testing Library, user-event and the jest-dom matchers from `src/test/setup.ts`.

## Files

- Next to the source: `TodoItem.tsx` → `TodoItem.test.tsx`, `todos.ts` → `todos.test.ts`.
- Import the Vitest functions you use: `import { expect, it, vi } from 'vitest'`.
- Shared data is `todoFixture` in `src/test/todoFixture.ts`. Put new shared helpers in `src/test/`.

## Isolation

- Design system: `vi.mock('../../design-system', () => import('../../design-system/mocks'))` with the path relative to the test. The mocks render plain HTML and are `vi.fn()`, so the props a component passed are in `vi.mocked(Button).mock.calls`.
- Pages: mock child components and hooks with `vi.mock` and drive the page through the hook return values, as `TodosPage.test.tsx` does.
- API client: mock `request` from `lib/http`: `vi.mock('../../../lib/http', () => ({ request: vi.fn() }))`.
- `lib/http` itself: `vi.stubGlobal('fetch', vi.fn())` returning `new Response(...)`, and `vi.unstubAllGlobals()` after each test.
- Query and mutation hooks: `renderHook` with a wrapper that provides a new `QueryClient` per test with retries off. Mock `todosApi` and check the cache with `queryClient.getQueryData(todoKeys.list)`.
- Timers and dates: `vi.useFakeTimers()` and `vi.setSystemTime(...)`, advance time inside `act`, restore with `vi.useRealTimers()`.

## Assertions

- What the user sees and does: query by role and accessible name, `getByRole('button', { name: 'Delete' })`, and interact through `userEvent.setup()`.
- Callbacks with their exact arguments, disabled and busy states, error and empty states.
- Pure functions: every branch, with `it.each` tables.

## Style

- The frontend Prettier config: no semicolons, single quotes, trailing commas. The workflow formats test files after the run.
- No comments, no snapshots, no class names or internal state in assertions.
