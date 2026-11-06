import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_QUIZ_SETTINGS, loadQuizSettings, QUIZ_SETTINGS_KEY, requestedLength, saveQuizSettings } from './settings'

const topics = new Set(['testing', 'clr-memory'])
beforeEach(() => localStorage.clear())

describe('quiz settings', () => {
  it('defaults to 10 questions from all topics', () => {
    expect(loadQuizSettings(topics)).toEqual(DEFAULT_QUIZ_SETTINGS)
    expect(DEFAULT_QUIZ_SETTINGS).toEqual({ length: 10, custom: 15, topics: 'all' })
  })
  it('round-trips through localStorage', () => {
    saveQuizSettings({ length: 'custom', custom: 42, topics: ['testing'] })
    expect(loadQuizSettings(topics)).toEqual({ length: 'custom', custom: 42, topics: ['testing'] })
    expect(requestedLength(loadQuizSettings(topics))).toBe(42)
  })
  it('drops unknown topics and falls back to all when none are left', () => {
    saveQuizSettings({ length: 5, custom: 15, topics: ['gone'] })
    expect(loadQuizSettings(topics).topics).toBe('all')
  })
  it('ignores garbage and out-of-range values', () => {
    localStorage.setItem(QUIZ_SETTINGS_KEY, '{not json')
    expect(loadQuizSettings(topics)).toEqual(DEFAULT_QUIZ_SETTINGS)
    localStorage.setItem(QUIZ_SETTINGS_KEY, JSON.stringify({ length: 7, custom: 500, topics: 'all' }))
    expect(loadQuizSettings(topics)).toEqual(DEFAULT_QUIZ_SETTINGS)
  })
})
