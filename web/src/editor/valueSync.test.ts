import { describe, expect, it } from 'vitest'
import { createValueSync } from './valueSync'

describe('createValueSync', () => {
  it('ignores a prop that already matches the editor', () => {
    expect(createValueSync().shouldApply('a', 'a')).toBe(false)
  })

  it('ignores a late render carrying a value the editor emitted earlier (keystrokes must not be undone)', () => {
    const sync = createValueSync()
    sync.emitted('Console')
    sync.emitted('Console.')
    // The render for "Console" commits after "." was typed.
    expect(sync.shouldApply('Console', 'Console.')).toBe(false)
  })

  it('applies an external value (reset, loaded draft) that the editor never emitted', () => {
    const sync = createValueSync()
    sync.emitted('x')
    expect(sync.shouldApply('starter', 'x')).toBe(true)
  })

  it('forgets emitted values once the prop has caught up, so a later reset to one of them still applies', () => {
    const sync = createValueSync()
    sync.emitted('a')
    sync.emitted('ab')
    expect(sync.shouldApply('ab', 'ab')).toBe(false)
    expect(sync.shouldApply('a', 'ab')).toBe(true)
  })

  it('forgets emitted values after applying an external value', () => {
    const sync = createValueSync()
    sync.emitted('a')
    expect(sync.shouldApply('reset', 'a')).toBe(true)
    expect(sync.shouldApply('a', 'reset')).toBe(true)
  })
})
