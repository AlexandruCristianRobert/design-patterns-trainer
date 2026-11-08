import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const theory = (data: string, params: string) => ['[Theory]', `[InlineData(${data})]`, `public void AddsVat(${params}) { … }`]
const CODE = theory('19.99m, 0.077m', 'decimal net, decimal rate')
const DOUBLE = [...theory('19.99, 0.077', 'double net, double rate').slice(0, 2), 'public void AddsVat(double net, double rate)', '    => Assert.Equal(21.53, Vat(net, rate), precision: 2);']
const NEW = theory('new decimal(19.99), new decimal(0.077)', 'decimal net, decimal rate')
const NULLABLE = theory('19.99m, 0.077m', 'decimal? net, decimal? rate')
const FIX = [
  'public static TheoryData<decimal, decimal> VatCases => new()',
  '{',
  '    { 19.99m, 0.077m },',
  '    { 100m, 0.081m },',
  '};',
  '',
  '[Theory]',
  '[MemberData(nameof(VatCases))]',
  'public void AddsVat(decimal net, decimal rate) { … }',
]

const TYPES: TableDef = { id: 'types', name: 'Attribute arguments', sub: 'what C# allows', tone: 'muted', columns: ['type', 'allowed'] }
const r = (key: string, cells: string[], kind?: TRow['kind'], mark?: string, markKind?: TRow['markKind']): TRow => ({ key, cells, kind, mark, markKind })
const ALLOWED = [r('prim', ['int, double, bool…', 'yes']), r('str', ['string', 'yes']), r('type', ['Type, enums', 'yes']), r('arr', ['arrays of these', 'yes'])]
const DECIMAL = r('dec', ['decimal', 'no'], 'bad')
const OTHERS = r('obj', ['DateTime, Guid…', 'no'], 'bad')

const chip = (key: string, label: string, kind?: TChip['kind']): TChip => ({ key, label, kind })
const FAILS = chip('b', 'build fails', 'bad')
const BUILT = chip('b', 'build succeeds', 'ok')
const cs0182 = (kind: OutLine['kind'] = 'bad'): OutLine[] => [{ label: 'error', text: 'CS0182: An attribute argument must be a constant expression … of an attribute parameter type', kind }]

const spec = (steps: Record<string, TableStep>, code = CODE): TableSpec => ({ tables: [TYPES], code, outputName: 'Build', steps })

const SPECS: Record<string, TableSpec> = {
  // ---- Setup: the theory and the failed build; no error text, no line singled out ----
  setup: spec({
    theory: { tables: {}, line: [0, 2] },
    build: { tables: {}, chips: [FAILS], line: [0, 2] },
    ask: { tables: {}, chips: [FAILS], line: null },
  }),

  why: spec({
    rule: { tables: { types: [...ALLOWED, DECIMAL] }, line: 1 },
    error: { tables: { types: [...ALLOWED, DECIMAL, OTHERS] }, chips: [FAILS], line: 1, bad: true, output: cs0182() },
  }),
  fix: spec(
    {
      member: { tables: {}, chips: [BUILT], line: [6, 8] },
      typed: { tables: {}, chips: [BUILT, chip('t', 'rows type-checked', 'ok')], line: [0, 3] },
    },
    FIX,
  ),

  'double-claim': spec(
    {
      params: { tables: {}, chips: [chip('p', 'decimal parameters: not supported')], line: 2 },
      double: { tables: {}, chips: [chip('p', 'decimal parameters: not supported'), chip('d', 'double + tolerance')], line: [1, 3] },
    },
    DOUBLE,
  ),
  'double-reality': spec(
    {
      params: { tables: {}, chips: [chip('p', 'decimal parameters: fine with MemberData', 'ok')], line: 2 },
      double: { tables: {}, chips: [chip('p', 'decimal parameters: fine with MemberData', 'ok'), chip('d', 'double: rounding errors', 'bad')], line: 3, output: [{ label: 'run-time example', text: '0.1 + 0.2 == 0.30000000000000004', kind: 'bad' }] },
    },
    DOUBLE,
  ),

  'new-claim': spec(
    {
      suffix: { tables: {}, chips: [chip('m', 'm suffix: rejected')], line: 1 },
      new: { tables: {}, chips: [chip('m', 'm suffix: rejected'), chip('n', 'new decimal(…): constant'), chip('b', 'compiles')], line: 1 },
    },
    NEW,
  ),
  'new-reality': spec(
    {
      suffix: { tables: { types: [...ALLOWED, DECIMAL] }, chips: [chip('m', '19.99m: a decimal constant')], line: 1 },
      new: { tables: { types: [...ALLOWED, DECIMAL] }, chips: [chip('m', '19.99m: a decimal constant'), chip('n', 'new: never constant', 'bad'), FAILS], line: 1, bad: true, output: cs0182() },
    },
    NEW,
  ),

  'nullable-claim': spec(
    {
      nullable: { tables: {}, chips: [chip('n', 'parameters must be nullable')], line: 2 },
      compiles: { tables: {}, chips: [chip('n', 'parameters must be nullable'), chip('b', 'compiles')], line: 2 },
    },
    NULLABLE,
  ),
  'nullable-reality': spec(
    {
      where: { tables: {}, chips: [FAILS], line: 1, bad: true, output: cs0182() },
      same: { tables: { types: [...ALLOWED, DECIMAL] }, chips: [FAILS], line: 1, bad: true, output: cs0182() },
    },
    NULLABLE,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
