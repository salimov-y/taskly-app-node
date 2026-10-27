---
name: analyze-changes
description: Decides which source files of Taskly App Node need new or updated unit tests, from a pull request diff or from a coverage report, and lists the cases to cover. Use it before writing any test.
---

# Analyze changes

## Scope

A source file is in scope when the Vitest coverage config of its package includes it. The configs are the source of truth, read them when in doubt:

- backend, `backend/vitest.config.ts`: `backend/src/**/*.ts` except `types.ts` files and `src/generated/**`.
- frontend, `frontend/vite.config.ts`: `frontend/src/**/*.{ts,tsx}` except tests, `src/test/**`, `src/design-system/**`, `main.tsx`, `types.ts` and `*.types.ts`, `index.ts` barrels, constants, `api/queryKeys.ts` and `lib/queryClient.ts`.

## Where the tests are

- backend: `backend/tests/<module>.test.ts`, importing the source by path, e.g. `tests/router.test.ts` for `src/features/todos/router.ts`.
- frontend: next to the source, `TodoItem.tsx` → `TodoItem.test.tsx`.

When the name does not match, search the test folders for the module path with Grep before deciding there is no test.

## Pull request mode

1. Read the diff of every changed file: `git diff <base>...<head> -- <file>`, then the whole file for context.
2. Read the existing tests of the file.
3. Decide per file:
   - `create`: changed behaviour and no test file yet.
   - `update`: the test file exists, but it does not cover the new or changed behaviour, or its expectations describe the old behaviour.
   - `none`: the change needs no tests (types only, formatting, comments, renames, styles) or the existing tests already cover it. Say which tests cover it.
   - `skip`: the file is out of scope.
4. Behaviour means exported functions, components, hooks, routes, branches, validation rules, error handling and data mapping. For `create` and `update` write down the concrete cases: inputs, expected output, the branch they hit.

## Coverage mode

1. Run `npm --prefix backend run test:coverage` and `npm --prefix frontend run test:coverage`.
2. Read `backend/coverage/coverage-summary.json` and `frontend/coverage/coverage-summary.json`. Take the in-scope files with uncovered statements or branches, the lowest coverage first.
3. Read each file and its tests and list the uncovered cases. `coverage/lcov.info` has the line numbers.
4. Process entry points only wire the runtime, such as `backend/src/main.ts`: decide `skip` and say why.

## Result

A plan per file: decision, test file, cases. Keep it, the final report is built from it.
