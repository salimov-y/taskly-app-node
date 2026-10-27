---
name: run-tests
description: Runs and verifies Taskly App Node unit tests, from a single test file while writing it to the full suites with type checks and coverage. Use it after writing or updating tests and before reporting the result.
---

# Run tests

Run the commands from the repository root in exactly these forms. In CI the agent is allowed to run only these commands.

| Goal | Backend | Frontend |
| --- | --- | --- |
| One test file | `npm --prefix backend test -- tests/router.test.ts` | `npm --prefix frontend test -- src/features/todos/components/TodoItem.test.tsx` |
| Type check | `npm --prefix backend run typecheck` | `npm --prefix frontend run typecheck` |
| Full suite with coverage | `npm --prefix backend run test:coverage` | `npm --prefix frontend run test:coverage` |

## Loop

1. Run the test file you changed and read the whole failure: assertion, received value, stack.
2. Decide what is wrong:
   - the test (wrong query, missing mock, async work not awaited): fix the test;
   - the application, which behaves differently from what its code and names clearly intend: remove that case from the test and keep it as a finding. Never change application code.
3. At most three attempts per file. Remove the cases that still fail and report them.
4. When your files pass, run the type check and the full suite with coverage of every package you touched. Both must pass, coverage thresholds included.
5. Keep the totals for the report: tests passed and failed, statement and branch coverage from `coverage/coverage-summary.json`.
