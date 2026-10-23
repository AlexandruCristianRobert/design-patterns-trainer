import { describe, expect, it } from 'vitest'
import { deadlineFor, isExpired, remainingMs } from './deadline'
import type { ExamSetup } from './types'

const setup = (timed: boolean): ExamSetup => ({ count: 3, scope: { kind: 'all' }, named: false, timed })
const start = '2026-10-23T10:00:00.000Z'

describe('deadline', () => {
  it('adds 15 minutes per question when timed', () => {
    expect(deadlineFor(start, setup(true), 3)).toBe('2026-10-23T10:45:00.000Z')
  })
  it('is null when untimed', () => {
    expect(deadlineFor(start, setup(false), 3)).toBeNull()
  })
  it('reports remaining time, clamped to 0', () => {
    const s = { deadline: '2026-10-23T10:45:00.000Z' }
    expect(remainingMs(s, Date.parse(start))).toBe(45 * 60_000)
    expect(remainingMs(s, Date.parse(start) + 99 * 60_000)).toBe(0)
    expect(remainingMs({ deadline: null }, 0)).toBeNull()
  })
  it('expires only in-progress timed sessions', () => {
    const after = Date.parse('2026-10-23T11:00:00.000Z')
    const deadline = '2026-10-23T10:45:00.000Z'
    expect(isExpired({ status: 'inProgress', deadline }, after)).toBe(true)
    expect(isExpired({ status: 'inProgress', deadline }, after - 30 * 60_000)).toBe(false)
    expect(isExpired({ status: 'submitted', deadline }, after)).toBe(false)
    expect(isExpired({ status: 'abandoned', deadline }, after)).toBe(false)
    expect(isExpired({ status: 'inProgress', deadline: null }, after)).toBe(false)
  })
})
