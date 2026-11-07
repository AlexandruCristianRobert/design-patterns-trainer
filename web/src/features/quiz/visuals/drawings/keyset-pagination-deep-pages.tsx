import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow, type TRowKind } from '../TableStage'

const OFFSET = ['SELECT * FROM Feed', 'ORDER BY CreatedAt DESC, Id DESC', 'OFFSET @skip ROWS FETCH NEXT 50 ROWS ONLY;']
const KEYSET = [
  '-- index on (CreatedAt, Id)',
  'SELECT TOP (50) * FROM Feed',
  'WHERE CreatedAt < @c OR (CreatedAt = @c AND Id < @id)',
  'ORDER BY CreatedAt DESC, Id DESC;',
]
const INDEXED = ['CREATE INDEX IX_Feed_CreatedAt ON Feed (CreatedAt);', '', ...OFFSET]
const CACHED = ['var page = await redis.GetAsync($"feed:page:{n}")', '    ?? await LoadAndCache(n); // the OFFSET query', '', ...OFFSET]
const SERIAL = ['BEGIN TRAN; -- SERIALIZABLE, for the whole scroll', '', ...OFFSET, '', '-- ...the next pages, minutes later...', 'COMMIT;']

const FEED: TableDef = { id: 'feed', name: 'Feed', sub: 'newest first', tone: 'pool', columns: ['CreatedAt', 'Id'] }
const IDX: TableDef = { ...FEED, name: 'Index on CreatedAt', sub: 'key order, newest first' }
const REDIS: TableDef = { id: 'redis', name: 'Redis', sub: 'one entry per page number', tone: 'io', columns: ['key', 'items'] }

/** Feed items, newest first: [Id, CreatedAt]. NEW arrive at the top while the user scrolls. */
const NEW: [number, string][] = [
  [47, '10:09'],
  [46, '10:08'],
]
const OLD: [number, string][] = [
  [45, '10:07'],
  [44, '10:05'],
  [43, '10:02'],
  [42, '10:02'],
  [41, '09:58'],
  [40, '09:55'],
  [39, '09:51'],
  [38, '09:50'],
  [37, '09:44'],
]

type Look = [kind: TRowKind, mark?: string, markKind?: TRow['markKind']]
/** The feed's rows; `looks` styles items by Id, the rest get `rest`. `arrived` adds the two new items. */
const feed = (looks: Record<number, Look> = {}, arrived = false, rest: TRowKind = 'plain'): TRow[] =>
  [...(arrived ? NEW : []), ...OLD].map(([id, at]) => {
    const look = looks[id] ?? (arrived && id >= 46 ? (['new', 'new'] as Look) : undefined)
    return { key: String(id), cells: [at, String(id)], kind: look?.[0] ?? rest, mark: look?.[1], markKind: look?.[2] }
  })
const each = (ids: number[], look: Look): Record<number, Look> => Object.fromEntries(ids.map((id) => [id, look]))

const PAGES = { ...each([45, 44, 43], ['plain', 'page 1']), ...each([42, 41, 40], ['plain', 'page 2']), ...each([39, 38, 37], ['plain', 'page 3']) }
/** Page 3 with OFFSET 6: 6 rows read and thrown away, 3 returned. */
const PAGE3 = { ...each([45, 44, 43, 42, 41, 40], ['skip', 'read, thrown away', 'bad']), ...each([39, 38, 37], ['hit', 'page 3', 'ok']) }
const SEEN = each([45, 44, 43], ['hit', 'seen', 'ok'])
/** Page 2 with OFFSET 3 after two inserts: it starts at 44. */
const SHIFTED = {
  ...each([47, 46, 45], ['skip', 'skipped']),
  ...each([44, 43], ['bad', 'seen twice', 'bad']),
  42: ['hit', 'page 2', 'ok'] as Look,
}
const read = (n: number, of: number, kind?: TChip['kind']): TChip[] => [{ key: 'read', label: `reads ${n} rows, returns ${of}`, kind }]
const said = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'user sees', text, kind }]

const spec = (tables: TableDef[], code: string[], steps: Record<string, TableStep>): TableSpec => ({ tables, code, outputName: 'Feed page', steps })

const SPECS: Record<string, TableSpec> = {
  setup: spec([FEED], OFFSET, {
    feed: { tables: { feed: feed(PAGES) }, chips: [{ key: 'size', label: '3 rows per page in the picture' }], line: 2 },
    problems: {
      tables: { feed: feed(PAGES) },
      chips: [{ key: 'size', label: '3 rows per page in the picture' }],
      line: 2,
      output: [
        { label: 'deep pages', text: 'slow', kind: 'bad' },
        { label: 'while scrolling', text: 'some items twice', kind: 'bad' },
      ],
    },
  }),

  offset: spec([FEED], OFFSET, {
    deep: { tables: { feed: feed(PAGE3) }, chips: read(9, 3, 'bad'), line: 2, bad: true, output: said('39 38 37') },
    page1: { tables: { feed: feed(SEEN) }, line: 2, output: said('45 44 43') },
    insert: { tables: { feed: feed(SEEN, true) }, output: said('45 44 43') },
    page2: { tables: { feed: feed(SHIFTED, true) }, line: 2, bad: true, output: said('45 44 43 · 44 43 42', 'bad') },
  }),
  keyset: spec([FEED], KEYSET, {
    page1: { tables: { feed: feed({ 45: ['hit', 'seen', 'ok'], 44: ['hit', 'seen', 'ok'], 43: ['hit', 'last seen: (10:02, 43)', 'ok'] }) }, line: [1, 3], output: said('45 44 43') },
    insert: {
      tables: { feed: feed({ 45: ['hit', 'seen', 'ok'], 44: ['hit', 'seen', 'ok'], 43: ['hit', 'last seen: (10:02, 43)', 'ok'] }, true) },
      output: said('45 44 43'),
    },
    next: {
      tables: {
        feed: feed(
          { ...each([45, 44], ['muted', 'seen']), 43: ['muted', 'last seen: (10:02, 43)'], 42: ['hit', 'same time, lower Id', 'ok'], ...each([41, 40], ['hit', 'page 2', 'ok']) },
          true,
        ),
      },
      line: 2,
      output: said('45 44 43 · 42 41 40', 'ok'),
    },
    deep: {
      tables: {
        feed: feed(
          { ...each([45, 44], ['muted', 'seen']), 43: ['muted', 'seek starts after this'], ...each([42, 41, 40], ['hit', 'page 2', 'ok']) },
          true,
        ),
      },
      chips: read(3, 3, 'ok'),
      line: 0,
      output: said('45 44 43 · 42 41 40', 'ok'),
    },
  }),

  'cache-claim': spec([REDIS], CACHED, {
    cache: {
      tables: {
        redis: [
          { key: '1', cells: ['feed:page:1', '45 44 43'] },
          { key: '2', cells: ['feed:page:2', '42 41 40'] },
          { key: '3', cells: ['feed:page:3', '39 38 37'] },
        ],
      },
      line: [0, 1],
    },
    served: {
      tables: {
        redis: [
          { key: '1', cells: ['feed:page:1', '45 44 43'] },
          { key: '2', cells: ['feed:page:2', '42 41 40'] },
          { key: '3', cells: ['feed:page:3', '39 38 37'], kind: 'hit', mark: 'served from the cache', markKind: 'ok' },
        ],
      },
      line: 0,
    },
  }),
  'cache-reality': spec([REDIS, FEED], CACHED, {
    miss: {
      tables: {
        redis: [
          { key: '1', cells: ['feed:page:1', '45 44 43'] },
          { key: '3', cells: ['feed:page:3', '(not cached yet)'], kind: 'bad', mark: 'miss', markKind: 'bad' },
        ],
        feed: feed(PAGE3),
      },
      chips: read(9, 3, 'bad'),
      line: 1,
      bad: true,
    },
    stale: {
      tables: {
        redis: [
          { key: '1', cells: ['feed:page:1', '45 44 43'], kind: 'bad', mark: 'stale: no 47, 46', markKind: 'bad' },
          { key: '2', cells: ['feed:page:2', '44 43 42'], kind: 'bad', mark: '44, 43 again', markKind: 'bad' },
        ],
        feed: feed(SHIFTED, true, 'muted'),
      },
      line: 1,
      output: said('45 44 43 · 44 43 42', 'bad'),
    },
  }),

  'index-claim': spec([IDX], INDEXED, {
    index: { tables: { feed: feed() }, line: 0 },
    jump: { tables: { feed: feed({ 39: ['hit', 'jump to position 7', 'ok'] }) }, line: 4 },
  }),
  'index-reality': spec([IDX], INDEXED, {
    walk: { tables: { feed: feed(PAGE3) }, chips: read(9, 3, 'bad'), line: 4, bad: true, output: said('39 38 37') },
    shift: { tables: { feed: feed(SHIFTED, true, 'muted') }, line: 4, bad: true, output: said('45 44 43 · 44 43 42', 'bad') },
  }),

  'tx-claim': spec([FEED], SERIAL, {
    tx: { tables: { feed: feed(PAGES) }, chips: [{ key: 'tx', label: 'one serializable transaction' }], line: 0 },
    stable: { tables: { feed: feed(PAGES) }, chips: [{ key: 'tx', label: 'one serializable transaction' }, { key: 'shift', label: 'inserts do not shift the pages' }], line: [0, 7] },
  }),
  'tx-reality': spec([FEED], SERIAL, {
    requests: {
      tables: {
        feed: [
          { key: '46', cells: ['10:08', '46'], kind: 'bad', mark: 'insert waits for the lock', markKind: 'bad' },
          ...feed(SEEN),
        ],
      },
      chips: [
        { key: 'r1', label: 'page 1: request 1' },
        { key: 'r2', label: 'page 2: a request minutes later', kind: 'bad' },
      ],
      line: { each: [0, 6] },
      bad: true,
      output: [{ label: 'writers', text: 'blocked for minutes', kind: 'bad' }],
    },
    cost: { tables: { feed: feed(PAGE3) }, chips: read(9, 3, 'bad'), line: 4, bad: true },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
