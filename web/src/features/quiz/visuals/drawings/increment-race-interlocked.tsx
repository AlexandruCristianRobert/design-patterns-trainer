import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'private int _count;  // shared',
  '',
  '// each thread runs:',
  'for (var i = 0; i < n; i++)',
  '    _count++;',
]
const INC = 4
const ICODE = CODE.map((l, i) => (i === INC ? '    Interlocked.Increment(ref _count);' : l))
const VCODE = CODE.map((l, i) => (i === 0 ? 'private volatile int _count;' : l))
const JCODE = [
  'private int _count;',
  '',
  '[MethodImpl(MethodImplOptions.NoOptimization)]',
  'void Work(int n)',
  '{',
  '    for (var i = 0; i < n; i++)',
  '        _count++;',
  '}',
]
const J = { ATTR: 2, INC: 6 }

const A: SeqActor = { id: 'a', name: 'Thread A', tone: 'ui' }
const B: SeqActor = { id: 'b', name: 'Thread B', tone: 'pool' }
const COUNT: SeqActor = { id: 'count', name: '_count', sub: 'shared field', tone: 'io' }
const A1: SeqActor = { ...A, sub: 'on core 1' }
const B1: SeqActor = { ...B, sub: 'on core 2' }
const JIT: SeqActor = { id: 'jit', name: 'JIT compiler', sub: 'Release build', tone: 'muted' }

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const out = (count: string, runs: string, kind?: OutLine['kind']): OutLine[] => [
  { label: '_count', text: count, kind },
  { label: 'increments run', text: runs },
]
const spec = (actors: SeqActor[], code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors, code, outputName: 'Counter', steps })

// ---- The interleaving: both threads read 5, both write 6 ----
const readA = row('ra', 'count', 'read: 5', 'a')
const readB = row('rb', 'count', 'read: 5', 'b')
const addA = row('add-a', 'a', '5 + 1 = 6')
const addB = row('add-b', 'b', '5 + 1 = 6')
const writeA = row('wa', 'a', 'write 6', 'count')
const writeB = row('wb', 'b', 'write 6', 'count', 'bad')
const LOST = [readA, readB, addA, addB, writeA, writeB]

const SPECS: Record<string, SeqSpec> = {
  setup: spec([A, COUNT, B], CODE, {
    run: { rows: [row('a', 'a', '_count++'), row('b', 'b', '_count++')], line: INC, output: out('?', '1,000,000 in total') },
    result: { rows: [row('a', 'a', '_count++'), row('b', 'b', '_count++')], line: INC, output: out('often lower than 1,000,000', '1,000,000 in total', 'bad') },
  }),
  'lost-update': spec([A, COUNT, B], CODE, {
    'read-a': { rows: [readA], line: INC, output: out('5', '0 of 2') },
    'read-b': { rows: [readA, readB], line: INC, output: out('5', '0 of 2') },
    add: { rows: [readA, readB, addA, addB], line: INC, output: out('5', '0 of 2') },
    write: { rows: LOST, line: INC, bad: true, output: out('6', '2 of 2', 'bad') },
    many: { rows: [...LOST, row('again', 'count', 'and again, many times', undefined, 'bad')], line: INC, bad: true, output: out('lower than 1,000,000', '1,000,000', 'bad') },
  }),
  interlocked: spec([A, COUNT, B], ICODE, {
    'a-inc': { rows: [row('ia', 'a', 'atomic: 5 + 1 = 6', 'count', 'ok')], line: INC, output: out('6', '1 of 2') },
    'b-inc': { rows: [row('ia', 'a', 'atomic: 5 + 1 = 6', 'count', 'ok'), row('ib', 'b', 'atomic: 6 + 1 = 7', 'count', 'ok')], line: INC, output: out('7', '2 of 2', 'ok') },
    result: {
      rows: [row('ia', 'a', 'atomic: 5 + 1 = 6', 'count', 'ok'), row('ib', 'b', 'atomic: 6 + 1 = 7', 'count', 'ok'), row('all', 'count', 'every increment counts', undefined, 'ok')],
      line: INC,
      output: out('1,000,000', '1,000,000', 'ok'),
    },
  }),

  'torn-claim': spec([A, COUNT, B], CODE, {
    write: { rows: [row('w', 'a', 'write 6', 'count'), row('half', 'count', 'half written', undefined, 'bad')], line: INC, output: out('half 5, half 6', '1', 'bad') },
    read: {
      rows: [row('w', 'a', 'write 6', 'count'), row('half', 'count', 'half written', undefined, 'bad'), row('r', 'count', 'read: half-written value', 'b', 'bad')],
      line: INC,
      output: out('half 5, half 6', '1', 'bad'),
    },
    fix: {
      rows: [row('w', 'a', 'write 6', 'count'), row('half', 'count', 'half written', undefined, 'bad'), row('r', 'count', 'read: half-written value', 'b', 'bad')],
      line: 0,
      output: [...out('1,000,000', '1,000,000'), { label: 'fix', text: 'private long _count;' }],
    },
  }),
  'torn-reality': spec([A, COUNT, B], CODE, {
    write: { rows: [row('w', 'a', 'write 6', 'count'), row('whole', 'count', '5 or 6, never a mix', undefined, 'ok')], line: INC, output: out('5, then 6', '1') },
    gap: { rows: LOST, line: INC, bad: true, output: out('6', '2', 'bad') },
    long: {
      rows: LOST,
      line: 0,
      output: [...out('6', '2', 'bad'), { label: 'fix', text: 'long: same gap, and not atomic on 32-bit', kind: 'bad' }],
    },
  }),

  'volatile-claim': spec([A1, COUNT, B1], CODE, {
    copies: { rows: [row('ca', 'a', 'own copy of _count'), row('cb', 'b', 'own copy of _count')], line: INC, output: out('?', '0') },
    count: {
      rows: [row('ca', 'a', 'own copy of _count'), row('cb', 'b', 'own copy of _count'), row('na', 'a', 'counts only its own', undefined, 'bad'), row('nb', 'b', 'counts only its own', undefined, 'bad')],
      line: INC,
      output: out('misses the other core', '1,000,000', 'bad'),
    },
    fix: {
      rows: [row('ca', 'a', 'own copy of _count'), row('cb', 'b', 'own copy of _count'), row('one', 'count', 'volatile: one shared copy')],
      line: 0,
      output: [...out('1,000,000', '1,000,000'), { label: 'fix', text: 'private volatile int _count;' }],
    },
  }),
  'volatile-reality': spec([A1, COUNT, B1], VCODE, {
    fresh: { rows: [row('ra', 'count', 'fresh read: 5', 'a')], line: INC, output: out('5', '0 of 2') },
    gap: { rows: [row('ra', 'count', 'fresh read: 5', 'a'), row('rb', 'count', 'fresh read: 5', 'b')], line: INC, output: out('5', '0 of 2') },
    lost: {
      rows: [row('ra', 'count', 'fresh read: 5', 'a'), row('rb', 'count', 'fresh read: 5', 'b'), writeA, writeB],
      line: INC,
      bad: true,
      output: out('6', '2 of 2', 'bad'),
    },
  }),

  'jit-claim': spec([JIT, A, COUNT], CODE, {
    drop: {
      rows: [row('d', 'jit', 'drops "redundant" _count++', undefined, 'bad'), row('i1', 'a', '_count++', 'count'), row('i2', 'a', '_count++ (removed)', 'count', 'skip')],
      line: INC,
      output: out('lower than 1,000,000', '1,000,000', 'bad'),
    },
    fix: {
      rows: [row('d', 'jit', 'NoOptimization: drops nothing'), row('i1', 'a', '_count++', 'count'), row('i2', 'a', '_count++', 'count')],
      line: INC,
      output: [...out('1,000,000', '1,000,000'), { label: 'fix', text: '[MethodImpl(MethodImplOptions.NoOptimization)]' }],
    },
  }),
  'jit-reality': spec([A, COUNT, B], JCODE, {
    kept: { rows: [row('a', 'a', '_count++', 'count'), row('b', 'b', '_count++', 'count')], line: J.INC, output: out('lower than 1,000,000', '1,000,000, none dropped', 'bad') },
    noopt: { rows: [readA, readB], line: J.ATTR, output: out('5', '0 of 2') },
    lost: { rows: LOST, line: J.INC, bad: true, output: out('6', '2 of 2', 'bad') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
