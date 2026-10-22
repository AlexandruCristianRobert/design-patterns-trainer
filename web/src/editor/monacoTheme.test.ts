import { describe, expect, it } from 'vitest'
import { buildMonacoTheme } from './monacoTheme'

const vars: Record<string, string> = {
  '--bg': '#111113',
  '--text': '#ececef',
  '--muted': '#a1a1aa',
  '--accent': '#2dd4bf',
  '--code-bg': '#141416',
  '--line-highlight': '#3a2f12',
  '--border': '#2c2c31',
}

describe('buildMonacoTheme', () => {
  it('maps CSS variables to editor colors', () => {
    const theme = buildMonacoTheme((n) => ` ${vars[n]} `, 'vs-dark')
    expect(theme.base).toBe('vs-dark')
    expect(theme.inherit).toBe(true)
    expect(theme.colors['editor.background']).toBe('#141416')
    expect(theme.colors['editor.foreground']).toBe('#ececef')
    expect(theme.colors['editor.rangeHighlightBackground']).toBe('#3a2f12')
    expect(theme.colors['editor.lineHighlightBorder']).toBe('#2c2c31')
    expect(theme.colors['editorWidget.background']).toBe('#111113')
    expect(theme.colors['editorCursor.foreground']).toBe('#2dd4bf')
    expect(theme.colors['editorLineNumber.foreground']).toBe('#a1a1aa')
  })
})
