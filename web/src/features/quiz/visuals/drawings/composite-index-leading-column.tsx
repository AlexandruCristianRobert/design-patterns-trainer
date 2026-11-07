import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow, type TRowKind } from '../TableStage'

const INDEX_CODE = ['modelBuilder.Entity<Order>()', '    .HasIndex(o => new { o.CustomerId, o.CreatedAt });']
const query = (where: string): string[] => ['// id = 7, since = Mar 01', 'db.Orders', `    ${where}`]
const Q = {
  both: query('.Where(o => o.CustomerId == id && o.CreatedAt >= since)'),
  date: query('.Where(o => o.CreatedAt >= since)'),
  or: query('.Where(o => o.CreatedAt >= since || o.CustomerId == id)'),
  order: ['db.Orders', '    .OrderBy(o => o.CreatedAt)', '    .Take(10)'],
}

const TABLE: TableDef = { id: 'table', name: 'Orders table', sub: 'rows by Id', tone: 'muted', columns: ['Id', 'CustomerId', 'CreatedAt'] }
const INDEX: TableDef = { id: 'index', name: 'Index (CustomerId, CreatedAt)', sub: 'each entry points to its row by Id', tone: 'pool', columns: ['CustomerId', 'CreatedAt', 'Id'] }

/** The 9 orders, as index entries in key order: [CustomerId, CreatedAt, Id]. */
const ENTRIES: [string, string, string][] = [
  ['3', 'Jan 10', '2'],
  ['3', 'Mar 12', '6'],
  ['3', 'Apr 20', '9'],
  ['7', 'Feb 02', '3'],
  ['7', 'Mar 05', '5'],
  ['7', 'Apr 01', '7'],
  ['9', 'Jan 04', '1'],
  ['9', 'Mar 03', '4'],
  ['9', 'Apr 08', '8'],
]
const ROWS: TRow[] = [...ENTRIES]
  .sort((a, b) => Number(a[2]) - Number(b[2]))
  .map(([c, d, id]) => ({ key: id, cells: [id, c, d] }))

type Look = [kind: TRowKind, mark?: string, markKind?: TRow['markKind']]
/** Index entries keyed "customer date"; `looks` gives the ones the step is about a kind and a note; `rest` styles the others. */
const index = (looks: Record<string, Look> = {}, rest: TRowKind = 'plain'): TRow[] =>
  ENTRIES.map(([c, d, id]) => {
    const look = looks[`${c} ${d}`]
    return { key: id, cells: [c, d, id], kind: look?.[0] ?? rest, mark: look?.[1], markKind: look?.[2] }
  })
const FROM_MAR = ['3 Mar 12', '3 Apr 20', '7 Mar 05', '7 Apr 01', '9 Mar 03', '9 Apr 08']
const all = (keys: string[], look: Look): Record<string, Look> => Object.fromEntries(keys.map((k) => [k, look]))

const plan = (operator: string, read?: string, kind?: OutLine['kind']): OutLine[] => [
  { label: 'operator', text: operator, kind: operator === '?' ? 'muted' : kind },
  ...(read ? [{ label: 'read', text: read, kind }] : []),
]
const chips = (...labels: [string, TChip['kind']?][]): TChip[] => labels.map(([label, kind], i) => ({ key: String(i), label, kind }))

const spec = (tables: TableDef[], code: string[], steps: Record<string, TableStep>): TableSpec => ({ tables, code, outputName: 'Plan', steps })
const QUERY_LINE = 2

/** A claim: the query, then the claimed seek; the index entries stay neutral. */
const claim = (code: string[], line: number | [number, number]) =>
  spec([INDEX], code, {
    query: { tables: { index: index() }, line, output: plan('?') },
    seek: { tables: { index: index() }, line, output: plan('Index Seek') },
  })

const SPECS: Record<string, TableSpec> = {
  setup: spec([TABLE], INDEX_CODE, {
    table: { tables: { table: ROWS }, chips: chips(['9 of the orders']), line: null },
    index: { tables: { table: ROWS }, chips: chips(['9 of the orders']), line: 1, output: [{ label: 'seek for', text: 'which query? ?', kind: 'muted' }] },
  }),

  seek: spec([INDEX], Q.both, {
    sorted: { tables: { index: index() }, chips: chips(['sorted by CustomerId, then CreatedAt']), line: 1, code: INDEX_CODE },
    land: {
      tables: { index: index({ '7 Mar 05': ['hit', 'seek lands here', 'ok'] }) },
      chips: chips(['sorted by CustomerId, then CreatedAt'], ['seek to (7, Mar 01)', 'ok']),
      line: QUERY_LINE,
    },
    range: {
      tables: { index: index({ '7 Mar 05': ['hit', 'read', 'ok'], '7 Apr 01': ['hit', 'read', 'ok'], '9 Jan 04': ['plain', 'past customer 7: range ends', 'muted'] }) },
      chips: chips(['sorted by CustomerId, then CreatedAt'], ['seek to (7, Mar 01)', 'ok']),
      line: QUERY_LINE,
      output: plan('Index Seek', '2 entries, 2 rows', 'ok'),
    },
  }),

  'date-only-claim': claim(Q.date, QUERY_LINE),
  'date-only-reality': spec([INDEX], Q.date, {
    spread: { tables: { index: index(all(FROM_MAR, ['hit', 'from Mar 01', 'ok'])) }, line: QUERY_LINE },
    scan: {
      tables: { index: index(all(FROM_MAR, ['hit', 'match', 'ok']), 'read') },
      chips: chips(['no single range: scan', 'bad']),
      line: QUERY_LINE,
      bad: true,
      output: plan('Scan', 'all 9 entries for 6 rows', 'bad'),
    },
  }),

  'or-claim': claim(Q.or, QUERY_LINE),
  'or-reality': spec([INDEX], Q.or, {
    match: {
      tables: {
        index: index({
          ...all(['7 Feb 02', '7 Mar 05', '7 Apr 01'], ['hit', 'CustomerId = 7', 'ok']),
          ...all(['3 Mar 12', '3 Apr 20', '9 Mar 03', '9 Apr 08'], ['hit', 'from Mar 01', 'ok']),
        }),
      },
      line: QUERY_LINE,
    },
    scan: {
      tables: {
        index: index(
          {
            ...all(['7 Feb 02', '7 Mar 05', '7 Apr 01'], ['hit', 'CustomerId = 7', 'ok']),
            ...all(['3 Mar 12', '3 Apr 20', '9 Mar 03', '9 Apr 08'], ['hit', 'from Mar 01', 'ok']),
          },
          'read',
        ),
      },
      chips: chips(['CreatedAt side: no seek', 'bad']),
      line: QUERY_LINE,
      bad: true,
      output: plan('Scan', 'all 9 entries for 7 rows', 'bad'),
    },
  }),

  'order-claim': claim(Q.order, [1, 2]),
  'order-reality': spec([INDEX], Q.order, {
    order: {
      tables: { index: index({ '9 Jan 04': ['hit', '1st by date', 'ok'], '3 Jan 10': ['hit', '2nd by date', 'ok'], '7 Feb 02': ['hit', '3rd by date', 'ok'] }) },
      chips: chips(['index order is not date order', 'bad']),
      line: 1,
    },
    sort: {
      tables: { index: index({ '9 Jan 04': ['hit', '1st by date', 'ok'], '3 Jan 10': ['hit', '2nd by date', 'ok'], '7 Feb 02': ['hit', '3rd by date', 'ok'] }, 'read') },
      chips: chips(['index order is not date order', 'bad'], ['read all, then sort', 'bad']),
      line: [1, 2],
      bad: true,
      output: plan('Scan + Sort', 'every entry, to return 10', 'bad'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
