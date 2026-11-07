import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CALL = ['_connections.GetOrAdd(host,', '    h => OpenExpensiveConnection(h));']
const PLAIN = [
  ...CALL,
  '',
  '// inside GetOrAdd, simplified',
  'if (TryGetValue(key, out var found))',
  '    return found;',
  'var v = factory(key); // no lock',
  '// atomic insert: first one stored',
  '// wins, a loser gets it back',
]
const P = { CALL: [0, 1] as [number, number], LOOKUP: [4, 5] as [number, number], FACTORY: 6, INSERT: [7, 8] as [number, number] }
const LAZY = [
  'var lazy = _connections.GetOrAdd(host,',
  '    h => new Lazy<Connection>(',
  '        () => OpenExpensiveConnection(h)));',
  'var conn = lazy.Value;',
]
const Z = { CALL: 0, FACTORY: 1, OPEN: 2, VALUE: 3 }
const SPLIT = [
  'if (!_connections.TryGetValue(host, out var c))',
  '{',
  '    c = OpenExpensiveConnection(host);',
  '    _connections.TryAdd(host, c);',
  '}',
]
const S = { ALL: [0, 4] as [number, number], CHECK: 0, OPEN: 2, ADD: 3 }

const A: SeqActor = { id: 'a', name: 'Request 1', tone: 'ui' }
const B: SeqActor = { id: 'b', name: 'Request 2', tone: 'ui' }
const DICT: SeqActor = { id: 'dict', name: 'Dictionary', sub: '_connections', tone: 'pool' }

const spec = (code: string[], steps: Record<string, SeqStep>): SeqSpec => ({ actors: [A, B, DICT], code, outputName: 'Result', steps })
const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })

const OPEN = 'OpenExpensiveConnection(db1)'
/** The log (one line per open) and the dictionary's db1 entries. */
const out = (opens: number, entries: string[] = [], kind: OutLine['kind'] = 'plain'): OutLine[] => [
  ...(opens ? Array.from({ length: opens }, (_, i): OutLine => ({ label: 'log', text: OPEN, kind: i > 0 ? kind : 'plain' })) : [{ label: 'log', text: 'nothing yet', kind: 'muted' as const }]),
  ...entries.map((text): OutLine => ({ label: 'db1 entry', text })),
]

// ---- Reality: two requests race on GetOrAdd ----
const aMiss = row('a-call', 'a', 'GetOrAdd(db1): miss', 'dict')
const bMiss = row('b-call', 'b', 'GetOrAdd(db1): miss', 'dict')
const aOpen = row('a-open', 'a', 'opens conn 1')
const bOpen = row('b-open', 'b', 'opens conn 2')
const noLock = row('no-lock', 'dict', 'no lock held', undefined, 'muted')
const aStore = row('a-ins', 'a', 'insert conn 1: stored', 'dict', 'ok')
const bLose = row('b-ins', 'b', 'insert conn 2: taken', 'dict')
const bGets = row('b-back', 'dict', 'conn 1', 'b')
const bWaste = row('b-waste', 'b', 'conn 2 discarded', undefined, 'bad')
const RACE = {
  miss: { rows: [aMiss, bMiss], line: P.LOOKUP, output: out(0) },
  factories: { rows: [aMiss, bMiss, noLock, aOpen, bOpen], line: P.FACTORY, output: out(2) },
  insert: { rows: [aMiss, bMiss, noLock, aOpen, bOpen, aStore, bLose, bGets], line: P.INSERT, output: out(2, ['conn 1']) },
  discarded: { rows: [aMiss, bMiss, noLock, aOpen, bOpen, aStore, bLose, bGets, bWaste], line: P.FACTORY, bad: true, output: out(2, ['conn 1'], 'bad') },
} satisfies Record<string, SeqStep>

const zaMiss = row('a-call', 'a', 'GetOrAdd(db1): miss', 'dict')
const zbMiss = row('b-call', 'b', 'GetOrAdd(db1): miss', 'dict')
const zaNew = row('a-new', 'a', 'new Lazy 1, unopened')
const zbNew = row('b-new', 'b', 'new Lazy 2, unopened')
const zaStore = row('a-ins', 'a', 'insert Lazy 1: stored', 'dict', 'ok')
const zbBack = row('b-back', 'dict', 'Lazy 1', 'b')
const zaValue = row('a-val', 'a', '.Value: opens conn 1', undefined, 'ok')
const zbValue = row('b-val', 'b', '.Value: waits, conn 1', undefined, 'ok')
const LAZY_STEPS = {
  miss: { rows: [zaMiss, zbMiss], line: Z.CALL, output: out(0) },
  factories: { rows: [zaMiss, zbMiss, zaNew, zbNew], line: Z.FACTORY, output: out(0) },
  insert: { rows: [zaMiss, zbMiss, zaNew, zbNew, zaStore, zbBack], line: Z.CALL, output: out(0, ['Lazy 1']) },
  value: { rows: [zaMiss, zbMiss, zaNew, zbNew, zaStore, zbBack, zaValue, zbValue], line: [Z.OPEN, Z.VALUE], output: out(1, ['Lazy 1, holding conn 1']) },
} satisfies Record<string, SeqStep>

// ---- Claim: hash collision ----
const cFirst = [row('a-call', 'a', 'GetOrAdd(db1): miss', 'dict'), row('a-open', 'a', 'opens conn 1'), row('a-ins', 'a', 'insert conn 1: stored', 'dict')]
const FIRST: SeqStep = { rows: cFirst, line: P.CALL, output: out(1, ['conn 1']) }
const cB = row('b-call', 'b', 'GetOrAdd(db1)', 'dict')

// ---- Claim: whole-dictionary lock ----
const lLock = row('lock', 'dict', 'whole dictionary locked', undefined, 'bad')
const lA = row('a-call', 'a', 'GetOrAdd(db1): miss', 'dict')
const lAOpen = row('a-open', 'a', 'opens conn 1')
const lAIns = row('a-ins', 'a', 'insert conn 1: stored', 'dict')
const lBWait = row('b-call', 'b', 'GetOrAdd(db1): waits', 'dict', 'bad')

// ---- Claim: TryGetValue + TryAdd ----
const sA = row('a-check', 'a', 'TryGetValue: miss', 'dict')
const sB = row('b-check', 'b', 'TryGetValue: miss', 'dict')
const sAOpen = row('a-open', 'a', 'opens conn 1')
const sBOpen = row('b-open', 'b', 'opens conn 2')
const sAAdd = row('a-add', 'a', 'TryAdd: true', 'dict', 'ok')
const sBAdd = row('b-add', 'b', 'TryAdd: false', 'dict', 'bad')

const SPECS: Record<string, SeqSpec> = {
  setup: spec(CALL, {
    cache: { rows: [row('empty', 'dict', 'no db1 entry yet', undefined, 'muted')], line: P.CALL, output: out(0) },
    load: { rows: [row('empty', 'dict', 'no db1 entry yet', undefined, 'muted'), row('a-call', 'a', 'GetOrAdd(db1)', 'dict'), row('b-call', 'b', 'GetOrAdd(db1)', 'dict')], line: P.CALL, output: out(0) },
    logs: {
      rows: [row('empty', 'dict', 'no db1 entry yet', undefined, 'muted'), row('a-call', 'a', 'GetOrAdd(db1)', 'dict'), row('b-call', 'b', 'GetOrAdd(db1)', 'dict')],
      line: P.CALL,
      output: out(2),
    },
  }),
  'plain-values': spec(PLAIN, RACE),
  'lazy-values': spec(LAZY, LAZY_STEPS),

  'collision-claim': spec(CALL, {
    first: FIRST,
    second: {
      rows: [...cFirst, cB, row('b-new', 'dict', 'collision: new key', undefined, 'bad'), row('b-open', 'b', 'opens conn 2'), row('b-ins', 'b', 'insert conn 2: 2nd entry', 'dict', 'bad')],
      line: P.CALL,
      bad: true,
      output: out(2, ['conn 1', 'conn 2'], 'bad'),
    },
  }),
  'collision-reality': spec(CALL, {
    first: FIRST,
    second: { rows: [...cFirst, cB, row('b-eq', 'dict', 'Equals: same key', undefined, 'ok'), row('b-back', 'dict', 'conn 1', 'b', 'ok')], line: P.CALL, output: out(1, ['conn 1']) },
    race: {
      rows: [...cFirst, cB, row('b-eq', 'dict', 'Equals: same key', undefined, 'ok'), row('b-back', 'dict', 'conn 1', 'b', 'ok'), row('one', 'dict', 'one db1 entry, always', undefined, 'ok')],
      line: P.CALL,
      output: out(1, ['conn 1']),
    },
  }),

  'lock-claim': spec(CALL, {
    lock: { rows: [lA, lLock], line: P.CALL, bad: true, output: out(0) },
    wait: { rows: [lA, lLock, lBWait, lAOpen, lAIns], line: P.CALL, bad: true, output: out(1, ['conn 1']) },
    elsewhere: {
      rows: [lA, lLock, lBWait, lAOpen, lAIns, row('b-back', 'dict', 'conn 1', 'b'), row('other', 'b', '2nd open: other code?', undefined, 'bad')],
      line: P.CALL,
      bad: true,
      output: [{ label: 'log', text: OPEN }, { label: 'log', text: `${OPEN}, from elsewhere`, kind: 'bad' }, { label: 'db1 entry', text: 'conn 1' }],
    },
  }),
  'lock-reality': spec(CALL, {
    lock: { rows: [lA, row('no-lock', 'dict', 'no lock held', undefined, 'ok')], line: P.CALL, output: out(0) },
    wait: { rows: [lA, row('no-lock', 'dict', 'no lock held', undefined, 'ok'), row('b-call', 'b', 'GetOrAdd(db1): miss', 'dict'), aOpen, bOpen], line: P.CALL, output: out(2) },
    elsewhere: {
      rows: [lA, row('no-lock', 'dict', 'no lock held', undefined, 'ok'), row('b-call', 'b', 'GetOrAdd(db1): miss', 'dict'), aOpen, bOpen, aStore, bLose, bGets],
      line: P.CALL,
      output: out(2, ['conn 1']),
    },
  }),

  'split-claim': spec(SPLIT, {
    rewrite: { rows: [], line: S.ALL, output: out(0) },
    once: { rows: [sA, sAOpen, sAAdd, row('b-check', 'b', 'TryGetValue: hit', 'dict', 'ok')], line: S.ALL, output: out(1, ['conn 1']) },
  }),
  'split-reality': spec(SPLIT, {
    rewrite: { rows: [], line: { each: [S.CHECK, S.ADD] }, output: out(0) },
    'both-miss': { rows: [sA, sB], line: S.CHECK, output: out(0) },
    twice: { rows: [sA, sB, sAOpen, sBOpen, sAAdd, sBAdd], line: [S.OPEN, S.ADD], bad: true, output: out(2, ['conn 1'], 'bad') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
