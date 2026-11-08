import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = [
  'var computedHmac = HMACSHA256.HashData(key, body);',
  'if (computedHmac.SequenceEqual(receivedHmac))',
  '// the review asks for:',
  'if (CryptographicOperations.FixedTimeEquals(',
  '        computedHmac, receivedHmac))',
]
const L = { SEQ: 1, FIXED: [3, 4] as [number, number] }

const EXPECTED = ['3F', 'A1', '07', '9C', '52']
const N = EXPECTED.length

const ROW = {
  expected: { id: 'expected', name: 'Computed', sub: 'first 5 of 32 bytes', tone: 'pool', slots: N },
  received: { id: 'received', name: 'Received', sub: 'the guess', tone: 'ui', slots: N },
  compared: { id: 'compared', name: 'Compared', sub: 'simplified, per byte', tone: 'io', slots: N },
  result: { id: 'result', name: 'Returns', tone: 'muted' },
  learned: { id: 'learned', name: 'Attacker knows', tone: 'bad' },
  goal: { id: 'goal', name: 'Goal', tone: 'ok' },
  seq: { id: 'seq', name: 'Sequence\u00ADEqual', tone: 'io', slots: N },
  fixed: { id: 'fixed', name: 'FixedTime\u00ADEquals', tone: 'io', slots: N },
  seqTrack: { id: 'seq', name: 'Sequence\u00ADEqual', tone: 'io' },
  fixedTrack: { id: 'fixed', name: 'FixedTime\u00ADEquals', tone: 'io' },
} satisfies Record<string, RowDef>

const bytes = (row: string, values: string[]): Chip[] => values.map((v, i) => ({ key: `${row}${i}`, label: v }))
const expected = bytes('e', EXPECTED)
/** A guess: the given leading bytes, then zeros up to the full length (or only the leading bytes when `short`). */
const guess = (lead: string[], short = false) => bytes('r', short ? lead : [...lead, ...Array(N - lead.length).fill('00')])
/** The byte comparisons done on `g` against the expected bytes: all of them, or up to and including the first difference. */
const compare = (g: string[], all: boolean): Chip[] => {
  const out: Chip[] = []
  for (let i = 0; i < N; i++) {
    const same = g[i] === EXPECTED[i]
    out.push({ key: `c${i}`, label: same ? '=' : '≠', kind: same ? 'ok' : 'bad' })
    if (!same && !all) break
  }
  return out
}
const chip = (key: string, label: string, kind?: Chip['kind']): Chip[] => [{ key, label, kind }]
const zeros = (lead: string[]) => [...lead, ...Array(N - lead.length).fill('00')]

const spec = (rows: RowDef[], steps: Record<string, RowStep>): RowSpec => ({ rows, code: CODE, steps })

const W = zeros([])
const R1 = zeros(['3F'])
const R2 = zeros(['3F', 'A1'])

const SPECS: Record<string, RowSpec> = {
  setup: spec([ROW.expected, { ...ROW.received, sub: undefined }], {
    today: { rows: { expected, received: bytes('r', ['5B', '0C', '91', '3F', '22']) }, line: L.SEQ },
    review: { rows: { expected, received: bytes('r', ['5B', '0C', '91', '3F', '22']) }, line: L.FIXED },
  }),
  'early-exit': spec([ROW.expected, ROW.received, ROW.compared, ROW.result, ROW.learned], {
    'wrong-first': { rows: { expected, received: guess([]), compared: compare(W, false), result: chip('res', 'false, after 1 byte') }, line: L.SEQ },
    'right-first': { rows: { expected, received: guess(['3F']), compared: compare(R1, false), result: chip('res', 'false, after 2 bytes') }, line: L.SEQ },
    measure: {
      rows: { expected, received: guess(['3F']), compared: compare(R1, false), result: chip('res', 'false, after 2 bytes'), learned: chip('k0', 'byte 1 = 3F', 'bad') },
      line: L.SEQ,
      bad: true,
    },
    next: {
      rows: {
        expected,
        received: guess(['3F', 'A1']),
        compared: compare(R2, false),
        result: chip('res', 'false, after 3 bytes'),
        learned: [...chip('k0', 'byte 1 = 3F', 'bad'), ...chip('k1', 'byte 2 = A1', 'bad')],
      },
      line: L.SEQ,
      bad: true,
    },
  }),
  'fixed-time': spec([ROW.expected, ROW.received, ROW.compared, ROW.result, ROW.learned], {
    'wrong-first': { rows: { expected, received: guess([]), compared: compare(W, true), result: chip('res', 'false, after all bytes') }, line: L.FIXED },
    'right-first': { rows: { expected, received: guess(['3F']), compared: compare(R1, true), result: chip('res', 'false, after all bytes') }, line: L.FIXED },
    measure: {
      rows: { expected, received: guess(['3F']), compared: compare(R1, true), result: chip('res', 'false, after all bytes'), learned: chip('k0', 'nothing', 'ok') },
      line: L.FIXED,
    },
  }),

  'reference-claim': spec([ROW.expected, ROW.received, ROW.result], {
    same: { rows: { expected, received: bytes('r', EXPECTED) }, line: L.SEQ },
    compare: { rows: { expected, received: bytes('r', EXPECTED), result: chip('res', 'false: other array', 'bad') }, line: L.SEQ, bad: true },
  }),
  'reference-reality': spec([ROW.expected, ROW.received, ROW.compared, ROW.result], {
    same: { rows: { expected, received: bytes('r', EXPECTED) }, line: L.SEQ },
    compare: { rows: { expected, received: bytes('r', EXPECTED), compared: compare(EXPECTED, false), result: chip('res', 'true', 'ok') }, line: L.SEQ },
  }),

  'faster-claim': spec([ROW.expected, ROW.received, ROW.seqTrack, ROW.fixedTrack], {
    guess: { rows: { expected, received: guess([]) }, line: { each: [L.SEQ, L.FIXED] } },
    faster: {
      rows: { expected, received: guess([]), fixed: chip('f', 'faster: 8 bytes per step', 'bad') },
      line: L.FIXED,
      bad: true,
    },
  }),
  'faster-reality': spec([ROW.expected, ROW.received, ROW.seq, ROW.fixed, ROW.goal], {
    guess: { rows: { expected, received: guess([]) }, line: { each: [L.SEQ, L.FIXED] } },
    faster: { rows: { expected, received: guess([]), seq: compare(W, false), fixed: compare(W, true) }, line: { each: [L.SEQ, L.FIXED] } },
    goal: {
      rows: { expected, received: guess([]), seq: compare(W, false), fixed: compare(W, true), goal: chip('goal', 'same time for any input', 'ok') },
      line: L.FIXED,
    },
  }),

  'length-claim': spec([ROW.expected, ROW.received, ROW.result], {
    short: { rows: { expected, received: guess(['5B', '0C', '91'], true) }, line: L.SEQ },
    compare: { rows: { expected, received: guess(['5B', '0C', '91'], true), result: chip('res', 'throws: endpoint down', 'bad') }, line: L.SEQ, bad: true },
  }),
  'length-reality': spec([ROW.expected, ROW.received, ROW.result], {
    short: { rows: { expected, received: guess(['5B', '0C', '91'], true) }, line: L.SEQ },
    compare: { rows: { expected, received: guess(['5B', '0C', '91'], true), result: chip('res', 'false', 'ok') }, line: L.SEQ },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
