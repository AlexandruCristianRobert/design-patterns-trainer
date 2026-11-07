import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'var numbers = new List<int> { 1, 2, 3 };',
  'var evens = numbers.Where(n => n % 2 == 0);',
  'numbers.Add(4);',
  'Console.WriteLine(evens.Count());',
  '',
  'var snapshot = numbers.Where(n => n > 2).ToList();',
  'numbers.Add(5);',
  'Console.WriteLine(snapshot.Count);',
]
const L = { NEW: 0, WHERE: 1, ADD4: 2, COUNT: 3, TOLIST: 5, ADD5: 6, PRINT: 7 }

const ROW: Record<string, RowDef> = {
  numbers: { id: 'numbers', name: 'numbers', sub: 'List<int>', tone: 'pool' },
  evens: { id: 'evens', name: 'evens', sub: 'from Where(…)', tone: 'ui' },
  read: { id: 'read', name: 'Read through the filter', sub: 'green: passes', tone: 'io' },
  snapshot: { id: 'snapshot', name: 'snapshot', sub: 'from ToList()', tone: 'ui' },
  console: { id: 'console', name: 'Console', sub: 'what is printed', tone: 'muted' },
}
const rows = (...ids: string[]) => ids.map((id) => ROW[id])
const ALL = rows('numbers', 'evens', 'read', 'snapshot', 'console')

const n = (v: number | string, kind: ChipKind = 'item', key = String(v)): Chip => ({ key, label: String(v), kind })
const list = (...vs: number[]) => vs.map((v) => n(v))
const unknown = (key: string) => n('?', 'gone', key)
/** Each item the filter reads: the ones that pass are green, the rest are dashed. */
const read = (items: number[], pass: (v: number) => boolean, tag: string) => items.map((v) => n(v, pass(v) ? 'ok' : 'gone', `${tag}${v}`))
const even = (v: number) => v % 2 === 0
const big = (v: number) => v > 2
const query: Chip = { key: 'query', label: 'query, not run yet', kind: 'wait' }
const live: Chip = { key: 'live', label: 'follows numbers', kind: 'run' }
const out = (...vs: (number | string)[]) => vs.map((v, i) => n(v, v === '?' ? 'gone' : 'item', `out${i}${v}`))

const spec = (steps: Record<string, RowStep>): RowSpec => ({ rows: ALL, code: CODE, steps })

// The real story, step by step; each stage below takes the steps it needs.
const R = {
  where: { rows: { numbers: list(1, 2, 3), evens: [query] }, line: L.WHERE },
  add4: { rows: { numbers: list(1, 2, 3, 4), evens: [query] }, line: L.ADD4 },
  count: { rows: { numbers: list(1, 2, 3, 4), evens: [query], read: read([1, 2, 3, 4], even, 'e') }, line: L.COUNT },
  first: { rows: { numbers: list(1, 2, 3, 4), evens: [query], read: read([1, 2, 3, 4], even, 'e'), console: out(2) }, line: L.COUNT },
  toList: { rows: { numbers: list(1, 2, 3, 4), read: read([1, 2, 3, 4], big, 'b'), snapshot: list(3, 4), console: out(2) }, line: L.TOLIST },
  add5: { rows: { numbers: list(1, 2, 3, 4, 5), snapshot: list(3, 4), console: out(2) }, line: L.ADD5 },
  print: { rows: { numbers: list(1, 2, 3, 4, 5), snapshot: list(3, 4), console: out(2, 2) }, line: L.PRINT },
} satisfies Record<string, RowStep>

/** The claim that Where filters when called: evens holds the result from the start. */
const eager = {
  where: { rows: { numbers: list(1, 2, 3), read: read([1, 2, 3], even, 'e'), evens: list(2) }, line: L.WHERE },
  add4: { rows: { numbers: list(1, 2, 3, 4), evens: list(2) }, line: L.ADD4 },
  count: { rows: { numbers: list(1, 2, 3, 4), evens: list(2), console: out(1) }, line: L.COUNT },
} satisfies Record<string, RowStep>

/** A step from the second half, with evens still shown as it was left by the first half. */
const keep = (step: RowStep, evens: Chip[]): RowStep => ({ ...step, rows: { ...step.rows, evens } })

const SPECS: Record<string, RowSpec> = {
  setup: { ...spec({
    create: { rows: { numbers: list(1, 2, 3) }, line: L.NEW },
    where: { rows: { numbers: list(1, 2, 3), evens: [unknown('evens')] }, line: L.WHERE },
    'add-4': { rows: { numbers: list(1, 2, 3, 4), evens: [unknown('evens')] }, line: L.ADD4 },
    count: { rows: { numbers: list(1, 2, 3, 4), evens: [unknown('evens')], console: out('?') }, line: L.COUNT },
    'to-list': { rows: { numbers: list(1, 2, 3, 4, 5), evens: [unknown('evens')], snapshot: [unknown('snap')], console: out('?') }, line: [L.TOLIST, L.ADD5] },
    print: { rows: { numbers: list(1, 2, 3, 4, 5), evens: [unknown('evens')], snapshot: [unknown('snap')], console: out('?', '?') }, line: L.PRINT },
  }), rows: rows('numbers', 'evens', 'snapshot', 'console') },
  deferred: { ...spec({ where: R.where, 'add-4': R.add4, count: R.count, print: R.first }), rows: rows('numbers', 'evens', 'read', 'console') },
  materialized: { ...spec({ 'to-list': R.toList, 'add-5': R.add5, print: R.print }), rows: rows('numbers', 'read', 'snapshot', 'console') },

  'eager-where-claim': spec({
    where: eager.where,
    'add-4': eager.add4,
    count: eager.count,
    second: { rows: { numbers: list(1, 2, 3, 4, 5), evens: list(2), snapshot: list(3, 4), console: out(1, 2) }, line: L.PRINT },
  }),
  'eager-where-reality': spec({ where: R.where, 'add-4': R.add4, count: R.first, second: keep(R.print, [query]) }),

  'live-tolist-claim': spec({
    first: R.first,
    'to-list': keep({ rows: { numbers: list(1, 2, 3, 4), read: read([1, 2, 3, 4], big, 'b'), snapshot: [...list(3, 4), live], console: out(2) }, line: L.TOLIST }, [query]),
    'add-5': keep({ rows: { numbers: list(1, 2, 3, 4, 5), snapshot: [...list(3, 4, 5), live], console: out(2) }, line: L.ADD5 }, [query]),
    print: keep({ rows: { numbers: list(1, 2, 3, 4, 5), snapshot: [...list(3, 4, 5), live], console: out(2, 3) }, line: L.PRINT }, [query]),
  }),
  'live-tolist-reality': spec({ first: R.first, 'to-list': keep(R.toList, [query]), 'add-5': keep(R.add5, [query]), print: keep(R.print, [query]) }),

  'reversed-claim': spec({
    where: eager.where,
    count: { ...eager.count, line: [L.ADD4, L.COUNT] },
    'to-list': keep({ rows: { numbers: list(1, 2, 3, 4), read: read([1, 2, 3, 4], big, 'b'), snapshot: [...list(3, 4), live], console: out(1) }, line: L.TOLIST }, list(2)),
    print: keep({ rows: { numbers: list(1, 2, 3, 4, 5), snapshot: [...list(3, 4, 5), live], console: out(1, 3) }, line: [L.ADD5, L.PRINT] }, list(2)),
  }),
  'reversed-reality': spec({
    where: R.where,
    count: { ...R.first, line: [L.ADD4, L.COUNT] },
    'to-list': keep(R.toList, [query]),
    print: keep({ ...R.print, line: [L.ADD5, L.PRINT] }, [query]),
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <RowStage spec={spec} {...p} />]),
)
export default drawing
