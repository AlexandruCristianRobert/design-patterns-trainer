import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'try',
  '{',
  '    try { throw new InvalidOperationException(); }',
  '    finally { Console.WriteLine("finally"); }',
  '}',
  'catch (InvalidOperationException) when (Log("filter"))',
  '{',
  '    Console.WriteLine("catch");',
  '}',
  '',
  'static bool Log(string text)',
  '{',
  '    Console.WriteLine(text);',
  '    return true;',
  '}',
]
const L = { THROW: 2, FINALLY: 3, FILTER: 5, CATCH: 7, BLOCKS: [3, 7] as [number, number] }

const EXC: RowDef = { id: 'exc', name: 'Exception', sub: 'from the inner try', tone: 'bad' }
const SEARCH: RowDef = { id: 'search', name: 'Search pass', sub: 'find a handler', tone: 'pool' }
const UNWIND: RowDef = { id: 'unwind', name: 'Unwind pass', sub: 'leave frames', tone: 'ui' }
const CONSOLE: RowDef = { id: 'console', name: 'Console', sub: 'lines in order', tone: 'io' }

const exc = (label: string, kind: Chip['kind'] = 'bad'): Chip[] => [{ key: 'e', label, kind }]
const out = (...lines: string[]): Chip[] => lines.map((t, i) => ({ key: `c${i}`, label: t, kind: t === '?' ? 'wait' : 'item' }))
const chips = (...items: [string, string, Chip['kind']?][]): Chip[] => items.map(([key, label, kind]) => ({ key, label, kind: kind ?? 'run' }))

const INNER = chips(['inner', 'inner try: no catch', 'gone'])
const FOUND = chips(['inner', 'inner try: no catch', 'gone'], ['filter', 'catch when: true', 'ok'])
const FIN = chips(['fin', 'inner finally', 'run'])
const ENTER = chips(['fin', 'inner finally', 'run'], ['catch', 'enter catch', 'ok'])

/** The real two-pass run, step by step. */
const R = {
  throw: { rows: { exc: exc('thrown'), search: [], unwind: [], console: [] }, line: L.THROW },
  searchInner: { rows: { exc: exc('searching'), search: INNER, unwind: [], console: [] }, line: L.FINALLY },
  filter: { rows: { exc: exc('handler found'), search: FOUND, unwind: [], console: out('filter') }, line: L.FILTER },
  unwind: { rows: { exc: exc('unwinding'), search: FOUND, unwind: FIN, console: out('filter', 'finally') }, line: L.FINALLY },
  catch: { rows: { exc: exc('caught', 'ok'), search: FOUND, unwind: ENTER, console: out('filter', 'finally', 'catch') }, line: L.CATCH },
} satisfies Record<string, RowStep>

const REAL = [EXC, SEARCH, UNWIND, CONSOLE]
const CLAIM = [EXC, CONSOLE]
const spec = (rows: RowDef[], steps: Record<string, RowStep>): RowSpec => ({ rows, code: CODE, steps })
const claimStep = (state: string, lines: string[], line: RowStep['line'], kind: Chip['kind'] = 'bad'): RowStep => ({ rows: { exc: exc(state, kind), console: out(...lines) }, line })
const CLAIM_THROW = claimStep('thrown', [], L.THROW)

const SPECS: Record<string, RowSpec> = {
  setup: spec(CLAIM, {
    throw: { rows: { exc: exc('thrown'), console: [] }, line: L.THROW },
    blocks: { rows: { exc: exc('thrown'), console: [] }, line: L.BLOCKS },
    question: { rows: { exc: exc('thrown'), console: out('?', '?', '?') }, line: L.BLOCKS },
  }),
  'two-passes': spec(REAL, { throw: R.throw, 'search-inner': R.searchInner, filter: R.filter, unwind: R.unwind, catch: R.catch }),

  'unwind-first-claim': spec(CLAIM, {
    throw: CLAIM_THROW,
    finally: claimStep('leaving inner try', ['finally'], L.FINALLY),
    filter: claimStep('filter checked', ['finally', 'filter'], L.FILTER),
    catch: claimStep('caught', ['finally', 'filter', 'catch'], L.CATCH, 'ok'),
  }),
  'unwind-first-reality': spec(REAL, { throw: R.throw, finally: R.filter, filter: R.unwind, catch: R.catch }),

  'catch-before-finally-claim': spec(CLAIM, {
    throw: CLAIM_THROW,
    filter: claimStep('filter checked', ['filter'], L.FILTER),
    catch: claimStep('caught', ['filter', 'catch'], L.CATCH, 'ok'),
    finally: claimStep('caught', ['filter', 'catch', 'finally'], L.FINALLY, 'ok'),
  }),
  'catch-before-finally-reality': spec(REAL, { throw: R.throw, filter: R.filter, catch: R.unwind, finally: R.catch }),

  'filter-last-claim': spec(CLAIM, {
    throw: CLAIM_THROW,
    finally: claimStep('leaving inner try', ['finally'], L.FINALLY),
    catch: claimStep('caught', ['finally', 'catch'], L.CATCH, 'ok'),
    filter: claimStep('caught', ['finally', 'catch', 'filter'], L.FILTER, 'ok'),
  }),
  'filter-last-reality': spec(REAL, { throw: R.throw, finally: R.filter, catch: R.unwind, filter: R.catch }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
