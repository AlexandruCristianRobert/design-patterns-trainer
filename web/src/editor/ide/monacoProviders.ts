import type * as Monaco from 'monaco-editor/editor/editor.api'
import type { IdeCompletionKind, IdeRange } from '../../compiler/protocol'
import type { IdeClient } from './IdeClient'

const LANGUAGE = 'csharp'

/** Marks a completion request the client answered with nothing (superseded), as opposed to an error or cancellation. */
const NO_ITEMS = Symbol('no-items')

export type MonacoApi = Pick<typeof Monaco, 'languages'>

const toRange = (r: IdeRange): Monaco.IRange => ({
  startLineNumber: r.startLine,
  startColumn: r.startColumn,
  endLineNumber: r.endLine,
  endColumn: r.endColumn,
})

function kindOf(monaco: MonacoApi, kind: IdeCompletionKind): Monaco.languages.CompletionItemKind {
  const k = monaco.languages.CompletionItemKind
  const map: Record<IdeCompletionKind, Monaco.languages.CompletionItemKind> = {
    class: k.Class,
    interface: k.Interface,
    struct: k.Struct,
    enum: k.Enum,
    method: k.Method,
    property: k.Property,
    field: k.Field,
    event: k.Event,
    local: k.Variable,
    parameter: k.Variable,
    namespace: k.Module,
    keyword: k.Keyword,
  }
  return map[kind] ?? k.Text
}

/** Aborts when Monaco cancels the request. */
function toSignal(token: Monaco.CancellationToken): AbortSignal {
  const controller = new AbortController()
  if (token.isCancellationRequested) controller.abort()
  else token.onCancellationRequested(() => controller.abort())
  return controller.signal
}

/**
 * Registers completion, hover, go-to-definition and document formatting for C#. Every provider answers nothing until
 * the client is ready, drops results for a model that changed since the request, and never throws.
 */
export function registerIdeProviders(monaco: MonacoApi, client: IdeClient): Monaco.IDisposable {
  /** Runs the request; null when not ready, on error, or if the model changed while it was in flight (unless discardStale is false). */
  async function guarded<T>(
    model: Monaco.editor.ITextModel,
    token: Monaco.CancellationToken,
    request: (signal: AbortSignal) => Promise<T | null>,
    discardStale = true,
  ): Promise<T | null> {
    if (client.status !== 'ready') return null
    const version = model.getVersionId()
    try {
      const result = await request(toSignal(token))
      return model.isDisposed() || (discardStale && model.getVersionId() !== version) || token.isCancellationRequested ? null : result
    } catch (err) {
      console.debug('[ide]', err)
      return null
    }
  }

  const disposables = [
    monaco.languages.registerCompletionItemProvider(LANGUAGE, {
      triggerCharacters: ['.'],
      async provideCompletionItems(model, position, _ctx, token) {
        const result = await guarded(model, token, (signal) =>
          client.complete(model.getValue(), position.lineNumber, position.column, signal).then((r) => r ?? NO_ITEMS),
          // Not version-guarded: the items come from the identifier start, so Monaco re-filters them against the live word.
          false,
        )
        if (!result) return null
        // Superseded at the client with a live token: keep the session open so Monaco asks again.
        if (result === NO_ITEMS) return { suggestions: [], incomplete: true }
        const range = toRange(result.range)
        return {
          suggestions: result.items.map((item) => ({
            label: item.label,
            kind: kindOf(monaco, item.kind),
            detail: item.detail,
            insertText: item.insertText,
            range,
          })),
        }
      },
    }),
    monaco.languages.registerHoverProvider(LANGUAGE, {
      async provideHover(model, position, token) {
        const result = await guarded(model, token, (signal) =>
          client.hover(model.getValue(), position.lineNumber, position.column, signal),
        )
        return result ? { contents: [{ value: result.markdown }], range: toRange(result.range) } : null
      },
    }),
    monaco.languages.registerDefinitionProvider(LANGUAGE, {
      async provideDefinition(model, position, token) {
        const result = await guarded(model, token, (signal) =>
          client.definition(model.getValue(), position.lineNumber, position.column, signal),
        )
        return result ? { uri: model.uri, range: toRange(result.range) } : null
      },
    }),
    monaco.languages.registerDocumentFormattingEditProvider(LANGUAGE, {
      async provideDocumentFormattingEdits(model, _options, token) {
        const text = await guarded(model, token, () => client.format(model.getValue()))
        return text === null ? null : [{ range: model.getFullModelRange(), text }]
      },
    }),
  ]
  return { dispose: () => disposables.forEach((d) => d.dispose()) }
}
