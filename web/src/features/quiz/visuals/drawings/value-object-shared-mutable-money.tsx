import { BoxGraph, type Box, type FieldKind, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TRow } from '../TableStage'

const SETUP_CODE = [
  'public class Money',
  '{',
  '    public Guid Id { get; set; }',
  '    public decimal Amount { get; set; }',
  '    public string Currency { get; set; }',
  '}',
  '',
  'line1.Price = price;   // 10 CHF',
  'line2.Price = price;',
  'line1.Price.Amount -= 1;   // discount on line 1',
]
const S = { SHARE: [7, 8] as [number, number], DISCOUNT: 9 }
const RECORD_CODE = [
  'public record Money(decimal Amount, string Currency)',
  '{',
  '    public Money Discount(decimal amount) => this with { Amount = Amount - amount };',
  '}',
  '',
  'line1.Price = price;   // new Money(10, "CHF")',
  'line2.Price = price;',
  'line1.Price = line1.Price.Discount(1);   // discount on line 1',
  'Console.WriteLine(new Money(10, "CHF") == line2.Price);',
]
const R = { SHARE: [5, 6] as [number, number], DISCOUNT: 7, EQUAL: 8 }
const CLONE_CLAIM_CODE = ['line1.Price = price.Clone();', 'line2.Price = price.Clone();', 'line1.Price.Amount -= 1;   // discount on line 1']
const CLONE_CODE = [
  'line1.Price = price.Clone();',
  'line2.Price = price.Clone();',
  '// later, a new feature copies line 1:',
  'line3.Price = line1.Price;   // Clone forgotten',
  'line1.Price.Amount -= 1;     // discount on line 1',
]
const C = { CLONE: [0, 1] as [number, number], CLAIM_DISCOUNT: 2, MISSED: 3, DISCOUNT: 4 }
const INTERNAL_CODE = [
  'public class Money   // in Shop.Domain',
  '{',
  '    public decimal Amount { get; internal set; }',
  '    public string Currency { get; internal set; }',
  '}',
  'public class OrderLine   // in Shop.Domain',
  '{',
  '    public void ApplyDiscount(decimal d) => Price.Amount -= d;',
  '}',
  '',
  '// in Shop.Api:',
  'line1.Price.Amount -= 1;   // error CS0272',
  'line1.ApplyDiscount(1);',
]
const I = { SETTERS: [2, 3] as [number, number], API: 11, DISCOUNT: { each: [12, 7] } }

const regions: Region[] = [
  { id: 'lines', name: 'Order lines', tone: 'ui' },
  { id: 'money', name: 'Money objects', sub: 'on the heap', tone: 'pool' },
]

const MONEY_NAME: Record<string, string> = { m1: 'Money #1', m2: 'Money #2' }
const line = (n: number, to: string, kind?: FieldKind): Box => ({
  id: `line${n}`,
  region: 'lines',
  title: `line${n}`,
  sub: 'OrderLine',
  fields: [{ name: 'Price', ref: to, value: MONEY_NAME[to], kind }],
})
/** A Money instance; amount '?' is drawn as unknown. withId: the class version, which has an identity. */
const money = (id: 'm1' | 'm2', amount: string, o: { sub?: string; kind?: Box['kind']; withId?: boolean; amountKind?: FieldKind } = {}): Box => ({
  id,
  region: 'money',
  title: MONEY_NAME[id],
  sub: o.sub,
  kind: o.kind,
  fields: [
    ...(o.withId ? [{ name: 'Id', value: 'Guid', kind: 'muted' as const }] : []),
    { name: 'Amount', value: amount, kind: amount === '?' ? 'muted' : o.amountKind },
    { name: 'Currency', value: '"CHF"' },
  ],
})
const price = (n: number, text: string, kind?: OutLine['kind']): OutLine => ({ label: `line${n}.Price`, text, kind: text === '?' ? 'muted' : kind })

const graph = (code: string[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, code, outputName: 'Prices', steps })

const classMoney = (amount: string, kind?: FieldKind) => money('m1', amount, { withId: true, amountKind: kind })
const SHARED = [line(1, 'm1'), line(2, 'm1')]

const SPECS: Record<string, GraphSpec> = {
  setup: graph(SETUP_CODE, {
    shared: { boxes: [...SHARED, classMoney('10')], line: S.SHARE, output: [price(1, '10 CHF'), price(2, '10 CHF')] },
    discount: { boxes: [...SHARED, classMoney('9', 'bad')], line: S.DISCOUNT, output: [price(1, '9 CHF'), price(2, '9 CHF', 'bad')] },
    question: { boxes: [...SHARED, classMoney('9', 'bad')], line: null, output: [price(1, '9 CHF'), price(2, '9 CHF', 'bad')] },
  }),
  'value-object': graph(RECORD_CODE, {
    shared: { boxes: [...SHARED, money('m1', '10', { sub: 'immutable record' })], line: R.SHARE, output: [price(1, '10 CHF'), price(2, '10 CHF')] },
    discount: {
      boxes: [line(1, 'm2'), line(2, 'm1'), money('m1', '10', { sub: 'immutable record' }), money('m2', '9', { sub: 'new, from Discount', kind: 'ok' })],
      line: R.DISCOUNT,
      output: [price(1, '9 CHF'), price(2, '10 CHF', 'ok')],
    },
    equal: {
      boxes: [line(1, 'm2'), line(2, 'm1'), money('m1', '10', { sub: 'immutable record' }), money('m2', '9', { sub: 'new, from Discount', kind: 'ok' })],
      line: R.EQUAL,
      output: [price(1, '9 CHF'), price(2, '10 CHF', 'ok'), { label: 'Console', text: 'True', kind: 'ok' }],
    },
  }),

  'clone-claim': graph(CLONE_CLAIM_CODE, {
    clone: { boxes: [line(1, 'm1'), line(2, 'm2'), money('m1', '10', { withId: true, sub: 'clone for line1' }), money('m2', '10', { withId: true, sub: 'clone for line2' })], line: C.CLONE, output: [price(1, '10 CHF'), price(2, '10 CHF')] },
    discount: {
      boxes: [line(1, 'm1'), line(2, 'm2'), money('m1', '9', { withId: true, sub: 'clone for line1' }), money('m2', '10', { withId: true, sub: 'clone for line2' })],
      line: C.CLAIM_DISCOUNT,
      output: [price(1, '9 CHF'), price(2, '10 CHF'), { label: 'Every line', text: 'always its own copy', kind: 'bad' }],
    },
  }),
  'clone-reality': graph(CLONE_CODE, {
    clone: { boxes: [line(1, 'm1'), line(2, 'm2'), money('m1', '10', { withId: true, sub: 'clone for line1' }), money('m2', '10', { withId: true, sub: 'clone for line2' })], line: C.CLONE, output: [price(1, '10 CHF'), price(2, '10 CHF')] },
    missed: {
      boxes: [line(1, 'm1'), line(2, 'm2'), line(3, 'm1', 'bad'), money('m1', '10', { withId: true, sub: 'clone for line1' }), money('m2', '10', { withId: true, sub: 'clone for line2' })],
      line: C.MISSED,
      bad: true,
      output: [price(1, '10 CHF'), price(2, '10 CHF'), price(3, '10 CHF')],
    },
    discount: {
      boxes: [line(1, 'm1'), line(2, 'm2'), line(3, 'm1', 'bad'), money('m1', '9', { withId: true, sub: 'shared again', kind: 'bad', amountKind: 'bad' }), money('m2', '10', { withId: true, sub: 'clone for line2' })],
      line: C.DISCOUNT,
      output: [price(1, '9 CHF'), price(2, '10 CHF'), price(3, '9 CHF', 'bad')],
    },
  }),

  'internal-claim': graph(INTERNAL_CODE, {
    internal: { boxes: [...SHARED, money('m1', '10', { sub: 'internal setters' })], line: I.SETTERS, output: [price(1, '10 CHF'), price(2, '10 CHF')] },
    api: { boxes: [...SHARED, money('m1', '10', { sub: 'internal setters' })], line: I.API, output: [price(1, '10 CHF'), price(2, '10 CHF'), { label: 'Shop.Api', text: 'error CS0272', kind: 'ok' }] },
    discount: {
      boxes: [...SHARED, money('m1', '?', { sub: 'internal setters' })],
      line: I.DISCOUNT,
      output: [price(1, '9 CHF'), price(2, '10 CHF', 'bad'), { label: 'Shop.Api', text: 'error CS0272', kind: 'ok' }],
    },
  }),
  'internal-reality': graph(INTERNAL_CODE, {
    internal: { boxes: [...SHARED, money('m1', '10', { sub: 'internal setters' })], line: I.SETTERS, output: [price(1, '10 CHF'), price(2, '10 CHF')] },
    api: { boxes: [...SHARED, money('m1', '10', { sub: 'internal setters' })], line: I.API, output: [price(1, '10 CHF'), price(2, '10 CHF'), { label: 'Shop.Api', text: 'error CS0272', kind: 'ok' }] },
    discount: {
      boxes: [...SHARED, money('m1', '9', { sub: 'still shared', kind: 'bad', amountKind: 'bad' })],
      line: I.DISCOUNT,
      bad: true,
      output: [price(1, '9 CHF'), price(2, '9 CHF', 'bad'), { label: 'Shop.Api', text: 'error CS0272', kind: 'ok' }],
    },
  }),
}

// ---- Money in its own table ----
const TABLE_CODE = ['UPDATE Money SET Amount = Amount - 1', 'WHERE Id = @line1MoneyId;   -- discount on line 1']
const LINES: TableDef = { id: 'lines', name: 'OrderLines', sub: 'database', tone: 'ui', columns: ['Line', 'MoneyId'] }
const MONEY: TableDef = { id: 'money', name: 'Money', sub: 'database', tone: 'io', columns: ['Id', 'Amount', 'Currency'] }
const lineRow = (n: number, fk: string, o: Pick<TRow, 'kind' | 'mark' | 'markKind'> = {}): TRow => ({ key: `${n}`, cells: [`${n}`, fk], ...o })
const moneyRow = (id: string, amount: string, o: Pick<TRow, 'kind' | 'mark' | 'markKind'> = {}): TRow => ({ key: 'm', cells: [id, amount, 'CHF'], ...o })
const FK_LINES = [lineRow(1, 'FK'), lineRow(2, 'FK')]
const SAME_ROW = [lineRow(1, '5', { kind: 'read' }), lineRow(2, '5', { kind: 'read', mark: 'same row', markKind: 'bad' })]
const tspec = (steps: Record<string, TableStep>): TableSpec => ({ tables: [LINES, MONEY], code: TABLE_CODE, outputName: 'Prices', steps })
const ALL: [number, number] = [0, 1]

const TABLES: Record<string, TableSpec> = {
  'table-claim': tspec({
    table: { tables: { lines: FK_LINES, money: [moneyRow('…', '10')] }, line: null, output: [price(1, '10 CHF'), price(2, '10 CHF')] },
    update: { tables: { lines: FK_LINES, money: [moneyRow('…', '9', { kind: 'hit', mark: 'via the database' })] }, line: ALL, output: [price(1, '9 CHF'), price(2, '10 CHF')] },
    fixed: { tables: { lines: FK_LINES, money: [moneyRow('…', '9')] }, line: ALL, output: [price(1, '9 CHF'), price(2, '10 CHF', 'bad')] },
  }),
  'table-reality': tspec({
    table: { tables: { lines: SAME_ROW, money: [moneyRow('5', '10')] }, line: null, output: [price(1, '10 CHF'), price(2, '10 CHF')] },
    update: { tables: { lines: SAME_ROW, money: [moneyRow('5', '9', { kind: 'hit', mark: 'row 5 updated' })] }, line: ALL, output: [price(1, '9 CHF'), price(2, '10 CHF')] },
    fixed: {
      tables: { lines: [lineRow(1, '5'), lineRow(2, '5', { kind: 'bad', mark: 'reads row 5', markKind: 'bad' })], money: [moneyRow('5', '9', { kind: 'bad' })] },
      line: ALL,
      output: [price(1, '9 CHF'), price(2, '9 CHF', 'bad')],
    },
  }),
}

const drawing: QuestionDrawing = {
  ...Object.fromEntries(Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />])),
  ...Object.fromEntries(Object.entries(TABLES).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />])),
}
export default drawing
