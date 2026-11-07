import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CLASSIFY = ['static string Classify(int age)', '{', '    if (age >= 18) return "adult";', '    return "minor";', '}']
const MUTANT = CLASSIFY.map((l, i) => (i === 2 ? '    if (age > 18) return "adult";  // mutant' : l))
const TESTS = [
  ...CLASSIFY,
  '',
  '[Fact] void Adult() => Assert.Equal("adult", Classify(30));',
  '[Fact] void Minor() => Assert.Equal("minor", Classify(10));',
]
const KILL = [...TESTS, '[Fact] void Boundary() => Assert.Equal("adult", Classify(18));']
const L = { IF: 2, ADULT: 6, MINOR: 7, TESTS: [6, 7] as [number, number], BOUNDARY: 8 }

const RUNS: TableDef = { id: 'runs', name: 'Mutation run', sub: 'the same test suite each time', tone: 'pool', columns: ['version', 'condition', 'tests'] }
const AGES: TableDef = { id: 'ages', name: 'Classify(age)', sub: 'original and mutant, side by side', tone: 'ui', columns: ['age', '>= 18', '> 18', 'test'] }
const LINE: TableDef = { id: 'line', name: 'Coverage', tone: 'muted', columns: ['line', 'run by'] }

const original: TRow = { key: 'orig', cells: ['original', 'age >= 18', 'all pass'] }
const survived: TRow = { key: 'mut', cells: ['mutant', 'age > 18', 'all pass'], mark: 'survived' }

/** An age row: the original's answer, the mutant's answer ('?' while not run) and the test that uses the age. */
const age = (a: number, mutant: boolean, test: string, extra: Partial<TRow> = {}): TRow => {
  const want = (b: boolean) => (b ? 'adult' : 'minor')
  return { key: String(a), cells: [String(a), want(a >= 18), mutant ? want(a > 18) : '?', test], ...extra }
}
const tested = (mutant: boolean, kind?: TRow['kind']): TRow[] => [
  age(10, mutant, 'Minor(): pass', { kind }),
  age(30, mutant, 'Adult(): pass', { kind }),
]
const chip = (label: string, kind?: TChip['kind']): TChip[] => [{ key: 'verdict', label, kind }]

const spec = (tables: TableDef[], code: string[], steps: Record<string, TableStep>): TableSpec => ({ tables, code, steps })

const SPECS: Record<string, TableSpec> = {
  setup: spec([RUNS], CLASSIFY, {
    original: { tables: { runs: [{ ...original, kind: 'read' }] }, line: L.IF },
    mutant: { tables: { runs: [{ ...original, kind: 'read' }, { ...survived, kind: 'read' }] }, line: L.IF, code: MUTANT },
  }),

  boundary: spec([AGES], TESTS, {
    tests: { tables: { ages: tested(false, 'read') }, line: L.TESTS },
    same: { tables: { ages: tested(true, 'read') }, chips: chip('mutant survived', 'bad'), line: L.IF, code: MUTANT },
    gap: {
      tables: { ages: [...tested(true), age(18, true, 'none', { kind: 'bad', mark: 'the only age where they differ', markKind: 'bad' })] },
      chips: chip('mutant survived', 'bad'),
      line: L.TESTS,
    },
    kill: {
      tables: { ages: [...tested(true), age(18, true, 'Boundary(): fails on mutant', { kind: 'hit', mark: 'mutant killed', markKind: 'ok' })] },
      chips: chip('mutant killed', 'ok'),
      line: L.BOUNDARY,
      code: KILL,
    },
  }),

  'bug-claim': spec([RUNS], CLASSIFY, {
    verdict: { tables: { runs: [{ ...original, mark: 'bug' }, survived] }, chips: chip('a real bug'), line: L.IF },
    fix: { tables: { runs: [{ ...original, mark: 'bug' }, { ...survived, mark: 'correct for the age rule' }] }, chips: chip('a real bug'), line: L.IF, code: MUTANT },
  }),
  'bug-reality': spec([AGES], TESTS, {
    same: { tables: { ages: tested(true, 'read') }, chips: chip('the tests cannot tell them apart', 'bad'), line: L.TESTS },
    rule: {
      tables: { ages: [...tested(true), age(18, true, 'none', { kind: 'bad', mark: 'the age rule decides', markKind: 'bad' })] },
      chips: chip('the tests cannot tell them apart', 'bad'),
      line: L.IF,
    },
  }),

  'coverage-claim': spec([LINE], CLASSIFY, {
    none: { tables: { line: [{ key: 'if', cells: ['the if line', 'no test'], kind: 'read' }] }, line: L.IF },
    always: { tables: { line: [{ key: 'if', cells: ['the if line', 'no test'], kind: 'read' }] }, chips: chip('a covered line: mutant always killed'), line: L.IF },
  }),
  'coverage-reality': spec([LINE, AGES], TESTS, {
    covered: { tables: { line: [{ key: 'if', cells: ['the if line', 'Adult(), Minor()'], kind: 'hit', mark: 'covered', markKind: 'ok' }] }, line: L.TESTS },
    survives: {
      tables: { line: [{ key: 'if', cells: ['the if line', 'Adult(), Minor()'], kind: 'hit', mark: 'covered', markKind: 'ok' }], ages: tested(true, 'read') },
      chips: chip('covered, and the mutant survived', 'bad'),
      line: L.IF,
      code: [...MUTANT, '', TESTS[6], TESTS[7]],
    },
  }),

  'equivalent-claim': spec([AGES], TESTS, {
    same: { tables: { ages: [age(17, true, '-'), age(19, true, '-')] }, chips: chip('the same for every int'), line: L.IF },
    ignore: { tables: { ages: [age(17, true, '-'), age(19, true, '-')] }, chips: chip('the same for every int'), line: L.IF, output: [{ label: 'report', text: 'false positive: ignore' }] },
  }),
  'equivalent-reality': spec([AGES], TESTS, {
    differ: {
      tables: { ages: [age(17, true, '-'), age(18, true, '-', { kind: 'bad', mark: 'adult vs minor', markKind: 'bad' }), age(19, true, '-')] },
      chips: chip('not equivalent', 'bad'),
      line: L.IF,
    },
    real: {
      tables: { ages: [age(17, true, '-'), age(18, true, 'none', { kind: 'bad', mark: 'no test uses 18', markKind: 'bad' }), age(19, true, '-')] },
      chips: chip('not equivalent', 'bad'),
      line: L.TESTS,
      output: [{ label: 'report', text: 'real: the boundary is untested', kind: 'bad' }],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
