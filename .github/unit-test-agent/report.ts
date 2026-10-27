import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Decision = 'create' | 'update' | 'none' | 'skip'

type FileDecision = {
  source: string
  decision: Decision
  testFiles: string[]
  reason: string
}

type AgentReport = {
  summary: string
  files: FileDecision[]
  findings: string[]
}

type ContentBlock = {
  type: string
  name?: string
  input?: { skill?: string }
}

type TranscriptEvent = {
  type: string
  message?: { content?: ContentBlock[] }
  structured_output?: AgentReport
  num_turns?: number
  duration_ms?: number
  total_cost_usd?: number
}

type TestRun = {
  numTotalTests: number
  numPassedTests: number
  numFailedTests: number
}

type CoverageMetric = 'statements' | 'branches'

type CoverageSummary = {
  total: Record<CoverageMetric, { pct: number }>
}

const packageNames = ['backend', 'frontend']

const decisionLabels: Record<Decision, string> = {
  create: 'tests added',
  update: 'tests updated',
  none: 'no tests needed',
  skip: 'skipped',
}

const reportDirectory = process.env.REPORT_DIR ?? '.'

const isStringAndNotEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0

const inputIsNotNull = <T>(value: T | null): value is T => value !== null

const isFirstOccurrence = (value: string, index: number, values: string[]) => values.indexOf(value) === index

const isSkillCall = (block: ContentBlock) => block.type === 'tool_use' && block.name === 'Skill'

const readJsonFile = <T>(fileName: string): T | null => {
  const filePath = join(reportDirectory, fileName)
  return existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : null
}

const parseTranscriptLine = (line: string): TranscriptEvent | null => {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

const readTranscript = (): TranscriptEvent[] => {
  const transcriptPath = join(reportDirectory, 'transcript.jsonl')
  return existsSync(transcriptPath)
    ? readFileSync(transcriptPath, 'utf8').split('\n').filter(isStringAndNotEmpty).map(parseTranscriptLine).filter(inputIsNotNull)
    : []
}

const getSkillsUsed = (transcript: TranscriptEvent[]) => transcript
  .filter(event => event.type === 'assistant')
  .flatMap(event => event.message?.content ?? [])
  .filter(isSkillCall)
  .map(block => block.input?.skill)
  .filter(isStringAndNotEmpty)
  .filter(isFirstOccurrence)

const getStatusLine = () => {
  const commitSha = process.env.COMMIT_SHA
  const pushResult = isStringAndNotEmpty(commitSha) ? `Verified tests pushed in ${commitSha.slice(0, 7)}.` : null
  if (process.env.AGENT_CONFIGURED !== 'true') return '⚠️ The agent is not configured: add the `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` repository secret.'
  if (process.env.RUN_AGENT !== 'true') return 'ℹ️ No application code changed, nothing to test.'
  if (process.env.GUARD_OUTCOME === 'failure') return '❌ The agent changed files outside the tests. Its changes were discarded and nothing was pushed.'
  if (process.env.VERIFY_OUTCOME === 'failure') return '❌ The type check or the tests failed after the agent run. Nothing was pushed.'
  if (process.env.AGENT_OUTCOME !== 'success') return `⚠️ The agent run did not finish. ${pushResult ?? 'Nothing was pushed.'}`
  return pushResult ? `✅ ${pushResult}` : '✅ No test changes were needed. All tests pass.'
}

const escapeCell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ')

const formatTestFiles = (testFiles: string[]) => testFiles.length > 0
  ? testFiles.map(testFile => `\`${testFile}\``).join('<br>')
  : '—'

const buildDecisionTable = (fileDecisions: FileDecision[]) => [
  '| Source file | Decision | Test files | Reason |',
  '| --- | --- | --- | --- |',
  ...fileDecisions.map(fileDecision => `| \`${fileDecision.source}\` | ${decisionLabels[fileDecision.decision]} | ${formatTestFiles(fileDecision.testFiles)} | ${escapeCell(fileDecision.reason)} |`),
].join('\n')

const formatTestRun = (testRun: TestRun | null) => {
  if (!testRun) return 'not run'
  return testRun.numFailedTests > 0
    ? `${testRun.numFailedTests} of ${testRun.numTotalTests} failed`
    : `${testRun.numPassedTests} passed`
}

const formatCoverage = (coverageSummary: CoverageSummary | null, metric: CoverageMetric) => coverageSummary
  ? `${coverageSummary.total[metric].pct}%`
  : 'n/a'

const buildPackageRow = (packageName: string) => {
  const testRun = readJsonFile<TestRun>(`${packageName}-tests.json`)
  const coverageBefore = readJsonFile<CoverageSummary>(`${packageName}-coverage-before.json`)
  const coverageAfter = readJsonFile<CoverageSummary>(`${packageName}-coverage-after.json`)
  return `| ${packageName} | ${formatTestRun(testRun)} | ${formatCoverage(coverageBefore, 'statements')} → ${formatCoverage(coverageAfter, 'statements')} | ${formatCoverage(coverageBefore, 'branches')} → ${formatCoverage(coverageAfter, 'branches')} |`
}

const buildPackageTable = () => [
  '| Package | Tests | Statements | Branches |',
  '| --- | --- | --- | --- |',
  ...packageNames.map(buildPackageRow),
].join('\n')

const formatDuration = (durationMs: number) => `${Math.floor(durationMs / 60_000)}m ${Math.round((durationMs % 60_000) / 1000)}s`

const buildRunLine = (resultEvent: TranscriptEvent | undefined) => {
  const runDetails = resultEvent
    ? [`${resultEvent.num_turns ?? 0} turns`, formatDuration(resultEvent.duration_ms ?? 0), `$${(resultEvent.total_cost_usd ?? 0).toFixed(2)}`]
    : []
  return `<sub>${[...runDetails, `[workflow run](${process.env.RUN_URL})`].join(' · ')}</sub>`
}

const transcript = readTranscript()
const resultEvent = transcript.find(event => event.type === 'result')
const agentReport = resultEvent?.structured_output
const skillsUsed = getSkillsUsed(transcript)

const reportSections = [
  '<!-- unit-test-agent -->',
  '## Unit test agent',
  getStatusLine(),
  agentReport?.summary,
  agentReport && agentReport.files.length > 0 ? buildDecisionTable(agentReport.files) : null,
  skillsUsed.length > 0 ? `**Skills used:** ${skillsUsed.map(skill => `\`${skill}\``).join(', ')}` : null,
  process.env.RUN_AGENT === 'true' ? buildPackageTable() : null,
  agentReport && agentReport.findings.length > 0 ? ['**Findings**', ...agentReport.findings.map(finding => `- ${finding}`)].join('\n') : null,
  buildRunLine(resultEvent),
].filter(isStringAndNotEmpty)

writeFileSync(join(reportDirectory, 'report.md'), `${reportSections.join('\n\n')}\n`)
