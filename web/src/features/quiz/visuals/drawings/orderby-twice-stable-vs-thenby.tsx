import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'var people = new[] {',
  '    (Name: "Cy", Age: 30),',
  '    (Name: "Ann", Age: 40),',
  '    (Name: "Bo", Age: 30),',
  '    (Name: "Ann", Age: 25) };',
  '',
  'var sorted = people',
  '    .OrderBy(p => p.Age)',
  '    .OrderBy(p => p.Name);',
  '',
  'Console.WriteLine(string.Join(" ",',
  '    sorted.Select(p => $"{p.Name}{p.Age}")));',
]
const L = { ARRAY: [0, 4] as [number, number], SORTED: [6, 8] as [number, number], AGE: 7, NAME: 8, PRINT: [10, 11] as [number, number] }
const THEN_CODE = CODE.map((l, i) => (i === L.AGE ? '    .OrderBy(p => p.Name)' : i === L.NAME ? '    .ThenBy(p => p.Age);' : l))

const SRC: RowDef = { id: 'src', name: 'people', sub: 'array order', tone: 'muted' }
const AGE: RowDef = { id: 'age', name: 'OrderBy(Age)', sub: 'the first call', tone: 'ui' }
const NAME: RowDef = { id: 'name', name: 'OrderBy(Name)', sub: 'the second call', tone: 'pool' }
const THEN: RowDef = { id: 'name', name: 'OrderBy(Name) .ThenBy(Age)', tone: 'pool' }
const WOULD: RowDef = { id: 'age', name: 'OrderBy(Age) .ThenBy(Name)', sub: 'not this code', tone: 'muted' }
const OUT: RowDef = { id: 'out', name: 'Console', tone: 'io' }

const ARRAY = ['Cy30', 'Ann40', 'Bo30', 'Ann25']
const BY_AGE = ['Ann25', 'Cy30', 'Bo30', 'Ann40']
const BY_NAME = ['Ann25', 'Ann40', 'Bo30', 'Cy30']

/** People as chips; `mark` picks the ones the step is about. */
const people = (order: string[], kind: ChipKind = 'run', mark: string[] = [], markKind: ChipKind = 'ok'): Chip[] =>
  order.map((p) => ({ key: p, label: p, kind: mark.includes(p) ? markKind : kind }))
const ANNS = ['Ann25', 'Ann40']
const TIE = ['Cy30', 'Bo30']
const printed = (text: string, kind: ChipKind = 'item'): Chip[] => [{ key: 'out', label: text, kind }]
const UNKNOWN = printed('?', 'gone')
const WOULD_CHIPS = people(['Ann25', 'Bo30', 'Cy30', 'Ann40'], 'gone')

const spec = (rows: RowDef[], steps: Record<string, RowStep>, code = CODE): RowSpec => ({ rows, code, steps })

const source: RowStep = { rows: { src: people(ARRAY) }, line: L.ARRAY }
const byAge: RowStep = { rows: { src: people(ARRAY, 'gone'), age: people(BY_AGE, 'run', TIE) }, line: L.AGE }
const byName: RowStep = { rows: { src: people(ARRAY, 'gone'), age: people(BY_AGE), name: people(BY_NAME) }, line: L.NAME }
const stable: RowStep = { rows: { src: people(ARRAY, 'gone'), age: people(BY_AGE, 'run', ANNS), name: people(BY_NAME, 'run', ANNS) }, line: L.NAME }
const print: RowStep = { ...stable, rows: { ...stable.rows, out: printed(BY_NAME.join(' '), 'ok') }, line: L.PRINT }

const SPECS: Record<string, RowSpec> = {
  setup: spec([SRC, OUT], {
    source,
    sort: { rows: { src: people(ARRAY), out: UNKNOWN }, line: L.SORTED },
  }),
  'two-orderbys': spec([SRC, AGE, NAME, OUT], { source, 'by-age': byAge, 'by-name': byName, stable, print }),
  thenby: spec(
    [SRC, THEN, OUT],
    {
      source,
      sorted: { rows: { src: people(ARRAY, 'gone'), name: people(BY_NAME), out: printed(BY_NAME.join(' '), 'ok') }, line: [L.AGE, L.NAME] },
    },
    THEN_CODE,
  ),

  'array-order-claim': spec([SRC, OUT], {
    source: { rows: { src: people(ARRAY, 'run', ANNS) }, line: L.ARRAY },
    print: { rows: { src: people(ARRAY, 'run', ANNS), out: printed('Ann40 Ann25 Bo30 Cy30', 'bad') }, line: L.PRINT },
  }),
  'array-order-reality': spec([SRC, AGE, NAME, OUT], {
    'by-age': { rows: { src: people(ARRAY, 'gone'), age: people(BY_AGE, 'run', ANNS) }, line: L.AGE },
    'by-name': stable,
    print,
  }),

  'age-first-claim': spec([SRC, OUT], {
    source,
    print: { rows: { src: people(ARRAY), out: printed('Ann25 Bo30 Cy30 Ann40', 'bad') }, line: L.PRINT },
  }),
  'age-first-reality': spec([SRC, WOULD, NAME, OUT], {
    thenby: { rows: { src: people(ARRAY, 'gone'), age: WOULD_CHIPS }, line: null },
    'by-name': { rows: { src: people(ARRAY, 'gone'), age: WOULD_CHIPS, name: people(BY_NAME, 'run', ANNS) }, line: L.SORTED },
    print: { rows: { src: people(ARRAY, 'gone'), age: WOULD_CHIPS, name: people(BY_NAME, 'run', ANNS), out: printed(BY_NAME.join(' '), 'ok') }, line: L.PRINT },
  }),

  'first-only-claim': spec([SRC, AGE, NAME, OUT], {
    'by-age': byAge,
    ignored: {
      rows: { src: people(ARRAY, 'gone'), age: people(BY_AGE, 'run', TIE), name: [{ key: 'skip', label: 'ignored', kind: 'dead' }], out: printed(BY_AGE.join(' '), 'bad') },
      line: L.PRINT,
    },
  }),
  'first-only-reality': spec([SRC, AGE, NAME, OUT], {
    'by-age': byAge,
    'by-name': byName,
    tie: print,
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
