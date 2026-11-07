import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'var channel = Channel.CreateBounded<int>(new BoundedChannelOptions(3)',
  '{',
  '    FullMode = BoundedChannelFullMode.DropOldest',
  '});',
  '',
  'for (var i = 1; i <= 5; i++)',
  '    channel.Writer.TryWrite(i);',
  '',
  'var items = new List<int>();',
  'while (channel.Reader.TryRead(out var item))',
  '    items.Add(item);',
  '',
  'Console.WriteLine(string.Join(" ", items));',
]
const L = { CREATE: [0, 3] as [number, number], WRITE: 6, PRINT: 12 }

const WRITER: RowDef = { id: 'writer', name: 'Writer', sub: 'TryWrite in the loop', tone: 'ui' }
const CHANNEL: RowDef = { id: 'channel', name: 'Channel', sub: 'capacity 3', tone: 'pool', slots: 3, ends: ['read next', 'newest'] }
const DROPPED: RowDef = { id: 'dropped', name: 'Dropped', sub: 'never read', tone: 'bad' }
const PRINTED: RowDef = { id: 'printed', name: 'Console', sub: 'what is printed', tone: 'io' }

const item = (n: number | string, kind: ChipKind = 'item'): Chip => ({ key: String(n), label: String(n), kind })
const write = (...ns: number[]): Chip[] => ns.map((n) => ({ key: `w${n}`, label: `TryWrite(${n})`, kind: 'run' }))

/** One play of five writes: the channel contents after each write, what was dropped, and what is printed. */
function play(after4: number[], after5: number[], drop4: number[], drop5: number[]): Record<string, RowStep> {
  const slots = (ns: number[]) => ns.map((n) => item(n))
  const dropped = (ns: number[]) => ns.map((n) => item(n, 'dead'))
  return {
    fill: { rows: { writer: write(1, 2, 3), channel: slots([1, 2, 3]) }, line: L.WRITE },
    'write-4': { rows: { writer: write(4), channel: slots(after4), dropped: dropped(drop4) }, line: L.WRITE },
    'write-5': { rows: { writer: write(5), channel: slots(after5), dropped: dropped(drop5) }, line: L.WRITE },
    drain: { rows: { dropped: dropped(drop5), printed: [{ key: 'out', label: after5.join(' '), kind: 'item' }] }, line: L.PRINT },
  }
}

const rows = [WRITER, CHANNEL, DROPPED, PRINTED]
const REAL = play([2, 3, 4], [3, 4, 5], [1], [1, 2])
const real: RowSpec = { rows, code: CODE, steps: REAL }
const unknown = [item('?', 'gone'), { ...item('?', 'gone'), key: '?2' }, { ...item('?', 'gone'), key: '?3' }]

const SPECS: Record<string, RowSpec> = {
  setup: {
    rows: [WRITER, CHANNEL, PRINTED],
    code: CODE,
    steps: {
      created: { rows: {}, line: L.CREATE },
      fill: { rows: { writer: write(1, 2, 3), channel: [item(1), item(2), item(3)] }, line: L.WRITE },
      'more-writes': { rows: { writer: write(4, 5), channel: unknown }, line: L.WRITE },
      drain: { rows: { printed: [item('?', 'gone')] }, line: [9, 12] },
    },
  },
  'drop-oldest': real,
  'drop-write-claim': { rows, code: CODE, steps: play([1, 2, 3], [1, 2, 3], [4], [4, 5]) },
  'drop-write-reality': real,
  'drop-newest-claim': { rows, code: CODE, steps: play([1, 2, 4], [1, 2, 5], [3], [3, 4]) },
  'drop-newest-reality': real,
  'grows-claim': { rows, code: CODE, steps: play([1, 2, 3, 4], [1, 2, 3, 4, 5], [], []) },
  'grows-reality': real,
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <RowStage spec={spec} {...p} />]),
)
export default drawing
