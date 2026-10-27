# Unit test agent

A custom Claude Code agent with four reusable skills writes and updates the unit tests of this repository. A GitHub Actions workflow runs it on every pull request that changes application code, verifies its tests on its own, pushes them to the pull request branch and reports the result in a pull request comment. The same agent, in coverage mode, added the missing tests to the existing code (pull request #1).

## Main decisions

- **Claude Code as the agent environment.** It runs headless in CI (`claude -p`) and supports custom agents (`--agent`), skills, structured output against a JSON schema, permission rules, a sandbox for shell commands and budget limits. The CLI version is pinned in the workflow.
- **One agent, two modes.** `pull-request` covers the files changed by a pull request, `coverage` adds the missing tests to the whole codebase. Both use the same skills, so the conventions live in one place.
- **Skills split by responsibility.** `analyze-changes` decides what needs tests, `backend-unit-tests` and `frontend-unit-tests` hold the conventions of each package, `run-tests` defines the commands, the fix loop and the final check. The agent loads them on demand: a frontend-only change never loads the backend conventions, and the transcript shows which skills were used.
- **Deterministic steps around the agent.** Finding the changed files, checking what the agent changed, verification, the commit and the comment are plain workflow steps. The agent runs tests while it works, but the result in the pull request comes from the workflow running the type checks and full suites of both packages again.
- **Security.**
  - The trigger is `pull_request`, not `pull_request_target`, and the job runs only for pull requests from branches of this repository; drafts are skipped. The workflow has no permissions by default, the job gets `contents: write` and `pull-requests: write`.
  - The agent never sees the GitHub token: the checkout does not persist credentials, only the push and comment steps get the token.
  - The agent definition, skills, permissions and report script come from the base branch, so a pull request can't change the instructions or permissions of its own run.
  - The agent runs in `dontAsk` mode with an allow list: file reads, edits under the test paths only, and a fixed set of `npm` commands. Web tools are denied, hooks and MCP servers are off.
  - Every shell command of the agent, test runs included, runs in the Claude Code sandbox (bubblewrap): no network, writes only inside the repository and the temp directory, no way to run unsandboxed, and the model credentials are removed from its environment.
  - After the run a guard checks `git status`. Any change outside the test paths discards the agent's work and fails the job.
  - Actions are pinned to commit SHAs. Turns, budget and job time are capped.
- **Reliability.** One run per pull request at a time (`concurrency` with cancel-in-progress). The bot commit is pushed with `GITHUB_TOKEN`, which does not trigger workflows, so the agent can't loop on its own commits. A pull request that changes only tests or other files skips the model call. The report comment is updated in place, the transcript is kept as a run artifact, and the job fails when the agent, the guard or the verification fails.
- **Useful tests.** The agent tests intended behaviour. When application code looks wrong it leaves the case out and reports a finding instead of writing the bug into an expectation. No `.only`, `.skip`, snapshots or loosened assertions.

## Running it

Prerequisites:

- GitHub Actions enabled for the repository.
- A repository secret with model access: `CLAUDE_CODE_OAUTH_TOKEN` (created with `claude setup-token`) or `ANTHROPIC_API_KEY`. Without it the workflow reports that the agent is not configured and passes.
- Pull requests opened from a branch of this repository.

Pull request workflow: open or update a pull request that changes `backend/src` or `frontend/src`. The `Unit test agent` workflow analyzes the changes, pushes the verified tests to the branch as `github-actions[bot]` and posts the report. Pull the branch before pushing again.

Coverage mode: Actions → Unit test agent → Run workflow, on a feature branch. The agent pushes its tests to that branch, then open a pull request from it. Runs on the default branch are refused.

Locally, from the repository root, with Claude Code logged in:

```sh
claude --agent unit-test-agent --settings .github/unit-test-agent/settings.json "Mode: coverage"
```

## Where the agent and skills are

| Path | Purpose |
| --- | --- |
| `.claude/agents/unit-test-agent.md` | The custom agent: role, rules, the order of the steps, tools and model |
| `.claude/skills/analyze-changes/SKILL.md` | What needs tests, in pull request and coverage mode |
| `.claude/skills/backend-unit-tests/SKILL.md` | Backend conventions: Vitest, Supertest, Prisma spies, fixtures |
| `.claude/skills/frontend-unit-tests/SKILL.md` | Frontend conventions: React Testing Library, design-system mocks, query hooks |
| `.claude/skills/run-tests/SKILL.md` | Allowed commands, the fix loop and the final verification |
| `.github/workflows/unit-test-agent.yml` | The workflow |
| `.github/unit-test-agent/settings.json` | Permissions and sandbox of the agent run |
| `.github/unit-test-agent/report.schema.json` | Schema of the agent's structured report |
| `.github/unit-test-agent/report.ts` | Builds the pull request comment and the job summary |

The workflow starts Claude Code with `--agent unit-test-agent`, so the agent file is the system prompt and its `tools` list limits what the run can use. The agent loads each skill with the Skill tool when it reaches the matching step and ends with the report defined by the schema. The workflow adds the skills it really called (read from the transcript), the verified test results and the coverage before and after.

## Example run

Pull request #2, "Add clear completed tasks": `DELETE /api/todos/completed`, a repository method, an API client call, a mutation hook and a header button. It was pushed without tests and broke the type check of two test files and the tests of the page.

First run, on the feature commit (34 turns, 1 min 56 s, $0.25, model `claude-sonnet-5-5`):

| Source file | Decision | Tests |
| --- | --- | --- |
| `backend/src/features/todos/repository.ts` | updated | `deleteCompleted` arguments and the returned counts |
| `backend/src/features/todos/router.ts` | updated | `DELETE /completed` with 2 and 0 deleted; the fake store got the new method; the `:id` route is not called |
| `backend/src/features/todos/types.ts` | skipped | types only |
| `frontend/src/features/todos/api/queryKeys.ts` | skipped | excluded from coverage |
| `frontend/src/features/todos/api/todos.ts` | updated | `clearCompleted` sends `DELETE /todos/completed` |
| `frontend/src/features/todos/hooks/useClearCompletedMutation.ts` | created | cache filtering, never-loaded cache, failure |
| `frontend/src/features/todos/components/TodosHeader.tsx` | updated | new props in the old test, button hidden at 0, label, click, disabled |
| `frontend/src/features/todos/TodosPage.tsx` | updated | count passed to the header, notices, failed clear, busy guard, error order, reset on retry |

Skills used: `analyze-changes`, `backend-unit-tests`, `frontend-unit-tests`, `run-tests`. The workflow verified and pushed the tests: backend 94 tests, 96.99% statements; frontend 124 tests, 98.93% statements. Findings: no application bugs.

Second run, after a commit that changed the notice texts and added a "nothing to clear" notice (13 turns, 57 s, $0.12): every other file was `none` because its tests already covered it, `TodosPage.test.tsx` was updated to the new texts. Skills used: `analyze-changes`, `run-tests`. The comment on the pull request was updated in place.

Coverage mode, pull request #1: two runs added 1,552 lines of tests in 25 files.

| Package | Tests | Statements | Branches |
| --- | --- | --- | --- |
| backend | 48 → 91 | 30.2% → 96.9% | 33.3% → 97.9% |
| frontend | 18 → 110 | 46.4% → 99.4% | 43.8% → 98.5% |

The agent left `backend/src/main.ts` (entry point) and three branches it could not reach through public behaviour uncovered and listed them as findings. In the second run it tried `cd frontend/src/features/todos && cat ...` and `npx --prefix frontend vitest ...`; both were denied by the permission rules and the agent continued with the allowed forms. On pull request #1, which changed only tests, the workflow skipped the model.

## Assumptions

- Pull request authors have write access to the repository. Forks are out of scope: their runs don't get secrets.
- Unit tests only: no database, network or browser. The existing tests define the boundaries to mock.
- A pull request needs tests when it changes files that the Vitest coverage configs include.
- When a pull request changes behaviour on purpose, the agent updates the tests to match; the reviewer of the pull request judges whether the new expectations are right.

## Limitations

- The model decides what is worth testing. The verification proves the tests compile and pass, not that they would catch a real fault, so the pull request review still matters.
- The agent's commit lands on the branch. Someone pushing at the same time gets a rejected push, and the next run starts from the new head.
- Deleted or renamed source files are not handled: tests of a deleted module have to be removed by the author.
- A pull request that changes the agent or its skills runs with the version from the base branch, so the change takes effect after the merge.
- The Claude Code process itself runs outside the sandbox with the model token; the sandbox covers the commands it starts.
- The report shows the coverage of whole packages, not of the changed lines.

## For production

- Run the whole agent job in a container or VM whose only outbound access is the model API.
- Mutation testing (for example Stryker) on the changed files, to check that the new tests catch faults, reported in the comment.
- Coverage of the changed lines as a required check with a threshold.
- Handle deleted and renamed files, and an option to post the tests as review suggestions instead of commits.
- Cost and run metrics per pull request, and a list of who may trigger the agent.
