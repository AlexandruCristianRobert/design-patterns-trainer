import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var p = db.Products.Single(x => x.Id == 7);',
  'p.Name = "Cup";',
  '',
  '// meanwhile another process sets Price = 12',
  '',
  'var again = db.Products.Single(x => x.Id == 7);',
]
const L = { LOAD: 0, EDIT: 1, OTHER: 3, AGAIN: 5 }
const RELOAD_CODE = [...CODE, '', 'var fresh = db.Products.AsNoTracking().Single(x => x.Id == 7);', 'db.Entry(p).Reload();']
const FRESH: Box = { id: 'fresh', region: 'app', title: 'fresh', sub: 'not tracked', fields: [{ name: 'Name', value: '"Mug"', kind: 'ok' }, { name: 'Price', value: '12', kind: 'ok' }] }

const REGIONS: Region[] = [
  { id: 'app', name: 'Variables', tone: 'ui' },
  { id: 'ctx', name: 'Context', sub: 'change tracker', tone: 'pool' },
  { id: 'db', name: 'Database', tone: 'io' },
]
type K = Field['kind']
const P: Box = { id: 'p', region: 'app', title: 'p', fields: [{ name: 'ref', ref: 'ent' }] }
const again = (fields: Field[], kind?: Box['kind']): Box => ({ id: 'again', region: 'app', title: 'again', fields, kind })
const AGAIN_SAME = again([{ name: 'ref', ref: 'ent', kind: 'ok' }])
const ent = (name: string, price: string, nk?: K, pk?: K, extra: Field[] = []): Box => ({
  id: 'ent',
  region: 'ctx',
  title: 'Product 7',
  sub: 'tracked',
  fields: [{ name: 'Name', value: name, kind: nk }, { name: 'Price', value: price, kind: pk }, ...extra],
})
const ENT = ent('"Cup" unsaved', '10')
const row = (price: string, kind?: K, extra: Field[] = []): Box => ({
  id: 'row',
  region: 'db',
  title: 'Products row 7',
  fields: [{ name: 'Name', value: '"Mug"' }, { name: 'Price', value: price, kind }, ...extra],
})
/** The values the SQL read back. */
const read = (kind?: Box['kind'], note?: Field): Box => ({
  id: 'read',
  region: 'ctx',
  title: 'Row read',
  sub: 'from the SQL',
  fields: [{ name: 'Name', value: '"Mug"' }, { name: 'Price', value: '12' }, ...(note ? [note] : [])],
  kind,
})
const SQL: OutLine[] = [{ label: 'SQL', text: 'SELECT … WHERE Id = 7', kind: 'ok' }]
const graph = (steps: Record<string, GraphStep>, code = CODE): GraphSpec => ({ regions: REGIONS, code, outputName: 'Sent to the database', steps })

const SPECS: Record<string, GraphSpec> = {
  // ---- Setup: the tracked edit, the outside update, the query; no SQL and no result shown ----
  setup: graph({
    tracked: { boxes: [P, ENT, row('10')], line: [L.LOAD, L.EDIT] },
    other: { boxes: [{ ...P, still: true }, { ...ENT, still: true }, row('12')], line: L.OTHER },
    query: { boxes: [{ ...P, still: true }, { ...ENT, still: true }, { ...row('12'), still: true }, again([{ name: 'value', value: '?', kind: 'muted' }])], line: L.AGAIN },
  }),

  query: graph({
    sql: { boxes: [P, ENT, row('12'), read()], line: L.AGAIN, output: SQL },
    match: { boxes: [P, ent('"Cup" unsaved', '10', 'ok', 'ok', [{ name: 'key', value: '7: tracked', kind: 'ok' }]), row('12'), read('muted', { name: 'applied', value: 'no', kind: 'muted' })], line: L.AGAIN, output: SQL },
    result: {
      boxes: [P, ent('"Cup" unsaved', '10 (old)', 'ok', 'bad'), row('12'), read('muted', { name: 'applied', value: 'no', kind: 'muted' }), AGAIN_SAME],
      line: L.AGAIN,
      output: SQL,
    },
  }),
  fresh: graph(
    {
      notrack: { boxes: [P, ENT, row('12'), FRESH], line: 7 },
      reload: { boxes: [P, ent('"Mug"', '12', 'bad', 'ok', [{ name: 'edit', value: 'discarded', kind: 'bad' }]), row('12'), FRESH], line: 8 },
    },
    RELOAD_CODE,
  ),

  'refresh-claim': graph({
    refresh: { boxes: [P, ent('"Mug"', '12'), row('12')], line: L.AGAIN },
    lost: { boxes: [P, ent('"Mug"', '12', undefined, undefined, [{ name: 'edit', value: 'lost' }]), row('12'), again([{ name: 'ref', ref: 'ent' }])], line: L.AGAIN },
  }),
  'refresh-reality': graph({
    kept: { boxes: [P, ent('"Cup" unsaved', '10', 'ok', 'ok'), row('12'), read('muted', { name: 'applied', value: 'no', kind: 'muted' })], line: L.AGAIN, output: SQL },
    explicit: { boxes: [P, ent('"Cup" unsaved', '10', 'ok', 'ok'), row('12'), read('muted', { name: 'applied', value: 'no', kind: 'muted' }), AGAIN_SAME], line: L.AGAIN, output: SQL },
  }),

  'second-claim': graph({
    second: { boxes: [P, ENT, row('12'), { id: 'two', region: 'ctx', title: 'Product 7', sub: 'second instance', fields: [{ name: 'Name', value: '"Mug"' }, { name: 'Price', value: '12' }] }], line: L.AGAIN },
    beside: {
      boxes: [P, ENT, row('12'), { id: 'two', region: 'ctx', title: 'Product 7', sub: 'second instance', fields: [{ name: 'Name', value: '"Mug"' }, { name: 'Price', value: '12' }] }, again([{ name: 'ref', ref: 'two' }])],
      line: L.AGAIN,
    },
  }),
  'second-reality': graph({
    one: { boxes: [P, ent('"Cup" unsaved', '10', undefined, undefined, [{ name: 'instances', value: '1 per key', kind: 'ok' }]), row('12'), read('muted', { name: 'applied', value: 'no', kind: 'muted' })], line: L.AGAIN, output: SQL },
    same: {
      boxes: [P, ent('"Cup" unsaved', '10', undefined, undefined, [{ name: 'instances', value: '1 per key', kind: 'ok' }]), row('12'), read('muted', { name: 'applied', value: 'no', kind: 'muted' }), AGAIN_SAME],
      line: L.AGAIN,
      output: SQL,
    },
  }),

  'memory-claim': graph({
    nosql: { boxes: [P, ENT, row('12')], line: L.AGAIN, output: [{ label: 'SQL', text: 'none' }] },
    memory: { boxes: [P, ENT, row('12'), again([{ name: 'ref', ref: 'ent' }])], line: L.AGAIN, output: [{ label: 'SQL', text: 'none' }] },
  }),
  'memory-reality': graph({
    sql: { boxes: [P, ENT, row('12', undefined, [{ name: 'read by', value: 'the query', kind: 'ok' }]), read()], line: L.AGAIN, output: SQL },
    find: { boxes: [P, ENT, row('12', undefined, [{ name: 'read by', value: 'the query', kind: 'ok' }]), read('muted', { name: 'applied', value: 'no', kind: 'muted' }), AGAIN_SAME], line: L.AGAIN, output: SQL },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
