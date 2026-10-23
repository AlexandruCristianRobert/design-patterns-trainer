import { describe, expect, it, vi } from 'vitest'
import type { IdeClient } from './IdeClient'
import { registerIdeProviders, type MonacoApi } from './monacoProviders'

const Kind = { Class: 1, Interface: 2, Struct: 3, Enum: 4, Method: 5, Property: 6, Field: 7, Event: 8, Variable: 9, Module: 10, Keyword: 11, Text: 12 }

function setup(overrides: Partial<IdeClient> = {}) {
  const p: Record<string, any> = {}
  const monaco = {
    languages: {
      CompletionItemKind: Kind,
      registerCompletionItemProvider: (_l: string, v: unknown) => ((p.completion = v), { dispose: vi.fn() }),
      registerHoverProvider: (_l: string, v: unknown) => ((p.hover = v), { dispose: vi.fn() }),
      registerDefinitionProvider: (_l: string, v: unknown) => ((p.definition = v), { dispose: vi.fn() }),
      registerDocumentFormattingEditProvider: (_l: string, v: unknown) => ((p.format = v), { dispose: vi.fn() }),
    },
  } as unknown as MonacoApi
  const range = { startLine: 2, startColumn: 3, endLine: 2, endColumn: 6 }
  const client = {
    status: 'ready',
    complete: vi.fn(async () => ({ items: [{ label: 'Foo', kind: 'method', detail: 'void Foo()', insertText: 'Foo' }], range })),
    hover: vi.fn(async () => ({ markdown: 'doc', range })),
    definition: vi.fn(async () => ({ range })),
    format: vi.fn(async () => 'formatted'),
    ...overrides,
  } as unknown as IdeClient
  registerIdeProviders(monaco, client)
  let version = 1
  const model = {
    getValue: () => 'src',
    getVersionId: () => version,
    isDisposed: () => false,
    uri: { path: '/m' },
    getFullModelRange: () => ({ startLineNumber: 1, startColumn: 1, endLineNumber: 9, endColumn: 2 }),
  }
  const token = { isCancellationRequested: false, onCancellationRequested: vi.fn() }
  return { p, client, model, token, bump: () => version++ }
}
const pos = { lineNumber: 2, column: 4 }

describe('registerIdeProviders', () => {
  it('opens member completion on a dot', () => {
    expect(setup().p.completion.triggerCharacters).toEqual(['.'])
  })

  it.each([
    ['class', Kind.Class], ['interface', Kind.Interface], ['struct', Kind.Struct], ['enum', Kind.Enum],
    ['method', Kind.Method], ['property', Kind.Property], ['field', Kind.Field], ['event', Kind.Event],
    ['local', Kind.Variable], ['parameter', Kind.Variable], ['namespace', Kind.Module], ['keyword', Kind.Keyword],
  ])('maps completion kind %s', async (kind, expected) => {
    const { p, model, token, client } = setup()
    ;(client.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [{ label: 'x', kind, insertText: 'x' }],
      range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
    })
    expect((await p.completion.provideCompletionItems(model, pos, {}, token)).suggestions[0].kind).toBe(expected)
  })

  it('keeps completion items when the model changed mid-request, marked incomplete', async () => {
    const { p, model, token, bump, client } = setup()
    ;(client.complete as ReturnType<typeof vi.fn>).mockImplementation(async () => (bump(), {
      items: [{ label: 'x', kind: 'method', insertText: 'x' }],
      range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
    }))
    const r = await p.completion.provideCompletionItems(model, pos, {}, token)
    expect(r.suggestions).toHaveLength(1)
    expect(r.incomplete).toBe(true)
  })

  it('keeps the session open when the client superseded a completion and the token is live', async () => {
    const { p, model, token } = setup({ complete: vi.fn().mockResolvedValue(null) })
    expect(await p.completion.provideCompletionItems(model, pos, {}, token)).toEqual({ suggestions: [], incomplete: true })
  })

  it('returns null for completion when Monaco cancelled the token', async () => {
    const { p, model, token } = setup()
    token.isCancellationRequested = true
    expect(await p.completion.provideCompletionItems(model, pos, {}, token)).toBeNull()
  })

  it('maps completion items with kind and the worker range', async () => {
    const { p, model, token } = setup()
    const r = await p.completion.provideCompletionItems(model, pos, {}, token)
    expect(r.suggestions).toEqual([
      { label: 'Foo', kind: Kind.Method, detail: 'void Foo()', insertText: 'Foo',
        range: { startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 6 } },
    ])
  })

  it('maps hover and definition', async () => {
    const { p, model, token } = setup()
    expect((await p.hover.provideHover(model, pos, token)).contents).toEqual([{ value: 'doc' }])
    const d = await p.definition.provideDefinition(model, pos, token)
    expect(d.uri).toBe(model.uri)
    expect(d.range.startLineNumber).toBe(2)
  })

  it('returns one full-range edit when formatting', async () => {
    const { p, model, token } = setup()
    expect(await p.format.provideDocumentFormattingEdits(model, {}, token)).toEqual([
      { range: model.getFullModelRange(), text: 'formatted' },
    ])
  })

  it('ignores a result for an older model version', async () => {
    const { p, model, token, bump, client } = setup()
    ;(client.hover as ReturnType<typeof vi.fn>).mockImplementation(async () => (bump(), { markdown: 'x', range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } }))
    expect(await p.hover.provideHover(model, pos, token)).toBeNull()
  })

  it('returns nothing until ready, and null (not a throw) on errors or cancellation', async () => {
    const off = setup({ status: 'off' })
    expect(await off.p.completion.provideCompletionItems(off.model, pos, {}, off.token)).toBeNull()
    expect(off.client.complete).not.toHaveBeenCalled()

    const bad = setup({ complete: vi.fn().mockRejectedValue(new Error('boom')), format: vi.fn().mockRejectedValue(new Error('x')) })
    expect(await bad.p.completion.provideCompletionItems(bad.model, pos, {}, bad.token)).toBeNull()
    expect(await bad.p.format.provideDocumentFormattingEdits(bad.model, {}, bad.token)).toBeNull()

    const cancelled = setup()
    cancelled.token.isCancellationRequested = true
    expect(await cancelled.p.hover.provideHover(cancelled.model, pos, cancelled.token)).toBeNull()
  })
})
