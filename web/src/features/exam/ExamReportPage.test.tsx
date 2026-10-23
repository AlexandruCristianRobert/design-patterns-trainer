import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { getCatalogText } from '../../content/catalog'
import { getExamPool, getExamQuestion } from '../../content/exam'
import { getExamQuestionText } from '../../content/text'
import { abandonSession, createSession, finishSession } from '../../exam/examStore'
import { isPass, questionScore, sessionScore } from '../../exam/scoring'
import type { ExamSetup, QuestionGrade, QuestionResult } from '../../exam/types'
import { getDb, resetDbForTests } from '../../progress/db'
import { ExamReportPage } from './ExamReportPage'

const keys = getExamPool()
  .filter((q) => q.patternId === 'observer')
  .map((q) => q.key)
const setupOf = (over: Partial<ExamSetup> = {}): ExamSetup => ({ count: keys.length, scope: { kind: 'all' }, named: false, timed: false, ...over })
const checkIds = (key: string) => Object.keys(getExamQuestionText(key, 'en').value.checks)

function Where() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

function mount(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/exam/${id}/report`]}>
      <Routes>
        <Route path="/exam/:sessionId/report" element={<ExamReportPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

function result(key: string, named: boolean, identification: string | null, grade: QuestionGrade): QuestionResult {
  const total = checkIds(key).length
  const passed = grade.kind === 'checked' ? grade.results.filter((r) => r.status === 'passed').length : 0
  const correct = named ? null : identification === 'observer'
  return {
    questionKey: key,
    patternId: 'observer',
    identification,
    identifiedCorrectly: correct,
    grade,
    checksPassed: passed,
    checksTotal: total,
    score: questionScore(named, correct === true, passed, total),
  }
}

const allPass = (key: string): QuestionGrade => ({ kind: 'checked', results: checkIds(key).map((id) => ({ id, status: 'passed' as const })) })

async function seed(opts: { named?: boolean; grades?: QuestionGrade[]; identification?: string | null; by?: 'learner' | 'timer' } = {}) {
  const named = opts.named ?? false
  const s = await createSession(setupOf({ named }), keys, new Date('2026-10-20T10:00:00Z'))
  const identification = opts.identification === undefined ? 'observer' : opts.identification
  const results = keys.map((k, i) => result(k, named, identification, opts.grades?.[i] ?? allPass(k)))
  const score = sessionScore(results.map((r) => r.score))
  await finishSession(s.id, { results, score, passed: isPass(score), by: opts.by ?? 'learner' }, new Date('2026-10-20T10:20:00Z'))
  return s
}

beforeEach(async () => {
  await resetDbForTests()
})

describe('ExamReportPage', () => {
  it('shows the score, pass/fail, the summary facts and each question with its checks', async () => {
    const s = await seed()
    mount(s.id)
    expect(await screen.findByRole('heading', { level: 1, name: 'Exam report' })).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Passed')).toBeInTheDocument()
    expect(screen.getByText('Pass mark 70%')).toBeInTheDocument()
    expect(screen.getByText('Submitted by you')).toBeInTheDocument()
    const text = getExamQuestionText(keys[0], 'en').value
    const first = screen.getByRole('region', { name: `Question 1: ${text.title}` })
    for (const c of Object.values(text.checks)) expect(within(first).getByText(c.title)).toBeInTheDocument()
    const n = checkIds(keys[0]).length
    expect(within(first).getByText(`${n} of ${n} checks passed · 100%`)).toBeInTheDocument()
    expect(within(first).getByRole('link', { name: 'Read the Observer Lesson' })).toHaveAttribute('href', '/patterns/observer')
    expect(within(first).getByText('Your code')).toBeInTheDocument()
    expect(within(first).getByText('Reference solution')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Take another exam' })).toHaveAttribute('href', '/exam')
    expect(screen.getByRole('link', { name: 'See exam history' })).toHaveAttribute('href', '/progress#exam-history')
  })

  it('shows Not passed below the pass mark and names the timer as the submitter', async () => {
    const failing: QuestionGrade = { kind: 'error' }
    const s = await seed({ grades: [failing, failing, failing], identification: null, by: 'timer' })
    mount(s.id)
    expect(await screen.findByText('Not passed')).toBeInTheDocument()
    expect(screen.getByText('Submitted when time ran out')).toBeInTheDocument()
    expect(screen.getAllByText('No answer')).toHaveLength(keys.length)
  })

  it('shows both names when the Identification was wrong', async () => {
    const s = await seed({ identification: 'singleton' })
    mount(s.id)
    const first = await screen.findByRole('region', { name: /^Question 1:/ })
    expect(within(first).getByText(`You chose ${getCatalogText('singleton', 'en').value.name}`)).toBeInTheDocument()
    expect(within(first).getByText('Correct: Observer')).toBeInTheDocument()
    expect(within(first).getByText('Incorrect')).toBeInTheDocument()
  })

  it('has no Identification block in Named mode', async () => {
    const s = await seed({ named: true })
    mount(s.id)
    const first = await screen.findByRole('region', { name: /^Question 1:/ })
    expect(within(first).queryByText(/^You chose/)).toBeNull()
    expect(within(first).queryByText(/^Correct:/)).toBeNull()
    expect(screen.getByText('Named')).toBeInTheDocument()
  })

  it('says the checks could not run for the error grade', async () => {
    const s = await seed({ grades: [{ kind: 'error' }, allPass(keys[1]), allPass(keys[2])] })
    mount(s.id)
    expect(await screen.findByText("The checks couldn't run for this answer.")).toBeInTheDocument()
  })

  it('lists compile errors and Contract violations', async () => {
    const diag = { id: 'CS0103', level: 'error' as const, message: 'x', file: 'user' as const, startLine: 3, startColumn: 4, endLine: 3, endColumn: 5 }
    const s = await seed({
      grades: [
        { kind: 'compileErrors', diagnostics: [diag] },
        { kind: 'contractViolations', violations: [{ code: 'missingType', type: 'Foo' } as never] },
        allPass(keys[2]),
      ],
    })
    mount(s.id)
    expect(await screen.findByText('Line 3, column 4')).toBeInTheDocument()
    expect(screen.getByText(/^The checks can't run until your code matches the Contract/)).toBeInTheDocument()
  })

  it('puts both code blocks in one column container so they stack at 390 px', async () => {
    const s = await seed()
    mount(s.id)
    const first = await screen.findByRole('region', { name: /^Question 1:/ })
    const pres = first.querySelectorAll('pre')
    expect(pres).toHaveLength(2)
    const container = pres[0].closest('.report-code')
    expect(container).not.toBeNull()
    expect(pres[1].closest('.report-code')).toBe(container)
    expect(pres[0]).toHaveTextContent('// Write your solution here.')
    expect(pres[1]).toHaveTextContent(getExamQuestion(keys[0])!.solution.trim().split('\n')[0])
  })

  it('still renders a question whose content was removed', async () => {
    const s = await seed()
    const db = await getDb()
    const stored = (await db.get('examSessions', s.id))!
    stored.results![0] = { ...stored.results![0], questionKey: 'observer/gone' }
    stored.questionKeys[0] = 'observer/gone'
    stored.answers['observer/gone'] = { code: 'class Mine {}', identification: 'observer' }
    await db.put('examSessions', stored)
    mount(s.id)
    expect(await screen.findByRole('region', { name: 'Question 1' })).toBeInTheDocument()
    expect(screen.getByText('This question is no longer available.')).toBeInTheDocument()
    expect(screen.getByText('class Mine {}')).toBeInTheDocument()
  })

  it('shows an abandoned exam without a score or question sections', async () => {
    const s = await createSession(setupOf(), keys, new Date('2026-10-20T10:00:00Z'))
    await abandonSession(s.id, new Date('2026-10-20T10:05:00Z'))
    mount(s.id)
    expect(await screen.findByText('This exam was abandoned and has no score.')).toBeInTheDocument()
    expect(screen.queryByText('Passed')).toBeNull()
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
  })

  it('redirects an in-progress exam to the session', async () => {
    const s = await createSession(setupOf(), keys, new Date())
    mount(s.id)
    expect(await screen.findByTestId('path')).toHaveTextContent(`/exam/${s.id}`)
  })

  it('says so for an unknown id', async () => {
    mount('nope')
    expect(await screen.findByRole('heading', { name: "This exam doesn't exist" })).toBeInTheDocument()
  })
})
