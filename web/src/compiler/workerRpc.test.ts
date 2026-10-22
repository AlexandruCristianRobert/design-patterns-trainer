import { describe, expect, it } from 'vitest'
import { errorText, isRuntimeExit } from './workerRpc'

describe('errorText', () => {
  it('reads the message of Errors and of the runtime ExitStatus object', () => {
    expect(errorText(new Error('boom'))).toBe('boom')
    expect(errorText({ name: 'ExitStatus', message: 'Program terminated with exit(1)', status: 1 })).toBe(
      'Program terminated with exit(1)',
    )
    expect(errorText('plain')).toBe('plain')
  })
})

describe('isRuntimeExit', () => {
  it('recognises a terminated runtime but not learner exceptions', () => {
    expect(isRuntimeExit('Program terminated with exit(1)')).toBe(true)
    expect(isRuntimeExit('System.InvalidOperationException: boom')).toBe(false)
  })
})
