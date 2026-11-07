import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const lookupCode = (decl: string[]) => [
  ...decl,
  '',
  'var counts = new Dictionary<Key, int>();',
  '// … filled with many keys',
  'var key = new Key { Region = "EU", Id = 3 };',
  'counts.TryGetValue(key, out var count);',
]
const CODE = lookupCode(['struct Key', '{', '    public string Region;', '    public int Id;', '}'])
const FIX_CODE = lookupCode(['readonly record struct Key(string Region, int Id);']).map((l) => l.replace('new Key { Region = "EU", Id = 3 }', 'new Key("EU", 3)'))
const L = { DECL: [0, 4] as [number, number], LOOKUP: 9, FIX_DECL: 0, FIX_LOOKUP: 5 }

/** The dictionary's keys; the lookup key is EU, 3. */
const KEYS: [string, string][] = [
  ['EU', '1'],
  ['US', '1'],
  ['EU', '2'],
  ['CH', '4'],
  ['EU', '3'],
]
const k = ([r, id]: [string, string]) => `${r}, ${id}`
const TARGET = 'EU, 3'

const ENTRIES: TableDef = { id: 'entries', name: 'Dictionary<Key, int>', sub: 'its keys', tone: 'ui', columns: ['Key'] }
const HASHED: TableDef = { id: 'hashed', name: 'Dictionary<Key, int>', sub: 'keys and their hash codes', tone: 'ui', columns: ['Key', 'Hash code'] }
const STORED: TableDef = { id: 'stored', name: 'Dictionary<Key, int>', sub: 'how each key is stored', tone: 'ui', columns: ['Key', 'Stored as'] }

const plainKeys = (): TRow[] => KEYS.map((key) => ({ key: k(key), cells: [k(key)] }))

/** Hash codes by the default (Region only) or the record struct (both fields); `mark` decides each row's note. */
const hashedRows = (both: boolean, mark: (key: string, region: string) => Pick<TRow, 'kind' | 'mark' | 'markKind'> = () => ({})): TRow[] =>
  KEYS.map((key) => ({ key: k(key), cells: [k(key), both ? `h(${k(key)})` : `h(${key[0]})`], ...mark(k(key), key[0]) }))

const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })
const LOOKUP = chip('lookup', `look up ${TARGET}`, 'item')
const out = (cost: string, kind: OutLine['kind'] = 'plain'): OutLine[] => [{ label: 'Lookup cost', text: cost, kind: cost === '?' ? 'muted' : kind }]
const spec = (tables: TableDef[], steps: Record<string, TableStep>, code = CODE): TableSpec => ({ tables, code, outputName: 'Outcome', steps })

/** Rows of the real default run: EU keys collide with the lookup key; the others are beside the point. */
const sameHash = (key: string, region: string): Pick<TRow, 'kind' | 'mark' | 'markKind'> =>
  region === 'EU' ? { kind: key === TARGET ? 'hit' : 'read', mark: key === TARGET ? 'same hash · target' : 'same hash', markKind: 'bad' } : { kind: 'muted' }
const compared = (key: string, region: string): Pick<TRow, 'kind' | 'mark' | 'markKind'> =>
  region !== 'EU' ? { kind: 'muted' } : key === TARGET ? { kind: 'hit', mark: 'Equals: yes', markKind: 'ok' } : { kind: 'read', mark: 'Equals: no', markKind: 'bad' }

const BOX_HASH = chip('box', 'GetHashCode: boxes the key', 'bad')
const BOX_EQ = chip('eq', 'Equals: boxes both keys', 'bad')
const REFLECT = chip('refl', 'reflection over Region, Id', 'bad')
const SLOW = 'boxing + reflection per same-Region key'

const R = {
  hash: { tables: { hashed: hashedRows(false, () => ({ kind: 'muted' })).map((r) => ({ ...r, cells: [r.cells[0], '…'] })) }, chips: [LOOKUP, BOX_HASH], line: L.LOOKUP, output: out('…') },
  collide: { tables: { hashed: hashedRows(false, sameHash) }, chips: [LOOKUP, BOX_HASH], line: L.LOOKUP, output: out('…') },
  equals: { tables: { hashed: hashedRows(false, compared) }, chips: [LOOKUP, BOX_HASH, BOX_EQ, REFLECT], line: L.LOOKUP, output: out('…') },
  cost: { tables: { hashed: hashedRows(false, compared) }, chips: [LOOKUP, BOX_HASH, BOX_EQ, REFLECT], line: L.LOOKUP, output: out(SLOW, 'bad') },
} satisfies Record<string, TableStep>

const SPECS: Record<string, TableSpec> = {
  setup: spec([ENTRIES], {
    key: { tables: { entries: plainKeys() }, line: L.DECL },
    lookup: {
      tables: { entries: plainKeys() },
      chips: [LOOKUP],
      line: L.LOOKUP,
      output: [
        { label: 'Lookups', text: 'much slower than expected', kind: 'bad' },
        { label: 'Why', text: '?', kind: 'muted' },
      ],
    },
  }),
  default: spec([HASHED], R),
  fix: spec(
    [HASHED],
    {
      hash: {
        tables: { hashed: hashedRows(true, (key) => (key === TARGET ? { kind: 'hit', mark: 'its own hash', markKind: 'ok' } : { kind: 'muted' })) },
        chips: [LOOKUP, chip('h', 'GetHashCode(): no box', 'ok')],
        line: L.FIX_DECL,
        output: out('…'),
      },
      equals: {
        tables: { hashed: hashedRows(true, (key) => (key === TARGET ? { kind: 'hit', mark: 'Equals(Key): yes', markKind: 'ok' } : { kind: 'muted' })) },
        chips: [LOOKUP, chip('h', 'GetHashCode(): no box', 'ok'), chip('eq', 'Equals(Key): direct', 'ok')],
        line: L.FIX_LOOKUP,
        output: out('one hash, one direct compare', 'ok'),
      },
    },
    FIX_CODE,
  ),

  'wrapper-claim': spec([STORED], {
    insert: { tables: { stored: KEYS.map((key) => ({ key: k(key), cells: [k(key), 'wrapper object'], kind: 'bad' })) }, line: L.LOOKUP, bad: true },
    lookup: {
      tables: { stored: KEYS.map((key) => ({ key: k(key), cells: [k(key), 'wrapper object'], kind: 'bad' })) },
      chips: [LOOKUP, chip('wrap', 'new wrapper per lookup', 'bad')],
      line: L.LOOKUP,
      bad: true,
      output: out('a wrapper allocation', 'bad'),
    },
  }),
  'wrapper-reality': spec([STORED], {
    insert: { tables: { stored: KEYS.map((key) => ({ key: k(key), cells: [k(key), 'inline, in entries'], kind: 'hit' })) }, line: L.LOOKUP },
    lookup: {
      tables: { stored: KEYS.map((key) => ({ key: k(key), cells: [k(key), 'inline, in entries'] })) },
      chips: [LOOKUP, BOX_HASH, BOX_EQ],
      line: L.LOOKUP,
      output: out('boxes from GetHashCode and Equals', 'bad'),
    },
  }),

  'identity-claim': spec([HASHED], {
    kind: { tables: { hashed: KEYS.map((key) => ({ key: k(key), cells: [k(key), '…'] })) }, chips: [chip('kind', 'Key: a reference type', 'bad')], line: L.DECL, bad: true },
    hash: {
      tables: { hashed: KEYS.map((key, i) => ({ key: k(key), cells: [k(key), `identity #${i + 1}`], kind: 'bad' })) },
      chips: [chip('kind', 'Key: a reference type', 'bad')],
      line: L.LOOKUP,
      bad: true,
    },
  }),
  'identity-reality': spec([HASHED], {
    kind: { tables: { hashed: KEYS.map((key) => ({ key: k(key), cells: [k(key), '…'] })) }, chips: [chip('kind', 'Key: a value type', 'ok')], line: L.DECL },
    hash: { tables: { hashed: hashedRows(false, sameHash) }, chips: [chip('kind', 'Key: a value type', 'ok'), BOX_HASH], line: L.LOOKUP, output: out(SLOW, 'bad') },
  }),

  'lock-claim': spec([ENTRIES], {
    lock: { tables: { entries: plainKeys() }, chips: [LOOKUP, chip('lock', 'lock the key', 'bad'), chip('hash', 'hash'), chip('unlock', 'unlock', 'bad')], line: L.LOOKUP, bad: true },
    lookup: {
      tables: { entries: plainKeys() },
      chips: [LOOKUP, chip('lock', 'lock the key', 'bad'), chip('hash', 'hash'), chip('unlock', 'unlock', 'bad')],
      line: L.LOOKUP,
      bad: true,
      output: out('waiting on locks', 'bad'),
    },
  }),
  'lock-reality': spec([HASHED], {
    lock: { tables: { hashed: KEYS.map((key) => ({ key: k(key), cells: [k(key), '…'] })) }, chips: [LOOKUP, chip('lock', 'no lock taken', 'ok')], line: L.LOOKUP },
    lookup: { tables: { hashed: hashedRows(false, compared) }, chips: [LOOKUP, chip('lock', 'no lock taken', 'ok'), BOX_HASH, BOX_EQ, REFLECT], line: L.LOOKUP, output: out(SLOW, 'bad') },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
