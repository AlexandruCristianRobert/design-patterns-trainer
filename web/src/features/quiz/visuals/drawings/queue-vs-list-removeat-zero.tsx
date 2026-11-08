import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const LIST_CODE = ['// producer', 'jobs.Add(newJob);', '', '// worker loop', 'var next = jobs[0];', 'jobs.RemoveAt(0);', 'Process(next);']
const L = { ADD: 1, READ: 4, REMOVE: 5 }
const QUEUE_CODE = ['// producer', 'jobs.Enqueue(newJob);', '', '// worker loop', 'var next = jobs.Dequeue();', 'Process(next);']
const Q = { ENQ: 1, DEQ: 4 }

const SLOTS = 5
const ENDS: [string, string] = ['[0]', '[4]']
const LIST: RowDef = { id: 'list', name: 'List<Job>', sub: 'first 5 slots', tone: 'pool', slots: SLOTS, ends: ENDS }
const WORKER: RowDef = { id: 'worker', name: 'Worker', sub: 'next job', tone: 'ui' }
const INCOMING: RowDef = { id: 'new', name: 'New job', tone: 'ui' }

/**
 * Slot chips: chip i sits in slot i (holes are empty slots). List chips are keyed by slot, so a job that moves
 * to another slot is marked as changed; queue chips are keyed by job, since queue jobs never move.
 */
const slots = (labels: (string | null)[], kind?: ChipKind, keyBy: 'slot' | 'label' = 'slot'): Chip[] => {
  const out: Chip[] = []
  labels.forEach((label, i) => {
    if (label) out[i] = { key: keyBy === 'slot' ? `s${i}` : label, label, kind }
  })
  return out
}
const jobs = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `J${from + i}`)
const chip = (key: string, label: string, kind?: ChipKind): Chip => ({ key, label, kind })

const J1_4 = slots(jobs(1, 4))
/** J2…J4 copied one slot down, the last slot freed. */
const shifted = (kind: ChipKind) => slots(jobs(2, 4), kind)
const withFirst = (kind: ChipKind) => [chip('s0', 'J1', kind), ...J1_4.slice(1)]

const listSpec = (rows: RowDef[], steps: Record<string, RowStep>, code: string[] | null = LIST_CODE): RowSpec => ({ rows, code: code ?? undefined, steps })

// Queue: the same circular array, plus a row that marks the head and tail slots.
const QUEUE: RowDef = { id: 'queue', name: 'Queue<Job>', sub: 'circular array, 5 slots', tone: 'pool', slots: SLOTS, ends: ENDS }
const INDEX: RowDef = { id: 'index', name: 'Indexes', sub: 'H head, T tail', tone: 'muted', slots: SLOTS }
const ptrs = (head: number, tail: number): Chip[] => {
  const out: Chip[] = []
  out[head] = chip('head', 'H', 'ok')
  out[tail] = chip('tail', 'T', 'wait')
  return out
}
const q = (labels: (string | null)[], kind?: ChipKind) => slots(labels, kind, 'label')

// Rows used by the claims and their realities.
const WALK: RowDef = { id: 'walk', name: 'Walk', tone: 'muted' }
const LINKED: RowDef = { id: 'linked', name: 'LinkedList<Job>', tone: 'io' }
const SORTED: RowDef = { id: 'sorted', name: 'SortedList', sub: 'keys by arrival', tone: 'io', slots: SLOTS, ends: ENDS }
const COST: RowDef = { id: 'cost', name: 'Copies', tone: 'bad' }
const SHRUNK: RowDef = { id: 'list', name: 'List<Job>', sub: 'new, smaller array', tone: 'pool', slots: 4, ends: ['[0]', '[3]'] }
const CAPACITY: RowDef = { id: 'cap', name: 'Capacity', tone: 'muted' }

const SPECS: Record<string, RowSpec> = {
  setup: listSpec([LIST, INCOMING, WORKER], {
    list: { rows: { list: J1_4 }, line: null },
    add: { rows: { list: J1_4, new: [chip('j5', 'J5')] }, line: L.ADD },
    take: { rows: { list: J1_4, new: [chip('j5', 'J5')], worker: [chip('next', '?', 'wait')] }, line: [L.READ, L.REMOVE] },
  }),

  list: listSpec([LIST, WORKER, COST], {
    read: { rows: { list: withFirst('ok'), worker: [chip('next', 'J1', 'ok')] }, line: L.READ },
    shift: { rows: { list: shifted('bad'), worker: [chip('next', 'J1')], cost: [chip('one', '3 copies here', 'bad')] }, line: L.REMOVE, bad: true },
    cost: { rows: { list: shifted('bad'), worker: [chip('next', 'J1')], cost: [chip('one', '99,999 for the first job', 'bad'), chip('all', '~5 billion to drain all', 'bad')] }, line: L.REMOVE, bad: true },
  }),
  queue: {
    rows: [QUEUE, INDEX, WORKER],
    code: QUEUE_CODE,
    steps: {
      enqueue: { rows: { queue: q([...jobs(1, 4), null]), index: ptrs(0, 4) }, line: Q.ENQ },
      dequeue: { rows: { queue: q([null, ...jobs(2, 4), null]), index: ptrs(1, 4), worker: [chip('next', 'J1', 'ok')] }, line: Q.DEQ },
      wrap: { rows: { queue: q([null, ...jobs(2, 5)]), index: ptrs(1, 0), worker: [chip('next', 'J1')] }, line: Q.ENQ },
    },
  },

  'walk-claim': listSpec([LIST, WALK, LINKED], {
    walk: { rows: { list: J1_4, walk: ['[3]', '[2]', '[1]', '[0]'].map((l) => chip(l, l)) }, line: L.READ },
    linked: { rows: { list: J1_4, linked: [chip('first', 'first: J1'), chip('rest', '→ J2 → J3 → J4')] }, line: L.READ },
  }),
  'walk-reality': listSpec([LIST, WALK, WORKER], {
    read: { rows: { list: withFirst('ok'), walk: [chip('one', '1 array read', 'ok')], worker: [chip('next', 'J1', 'ok')] }, line: L.READ },
    shift: { rows: { list: shifted('bad'), walk: [chip('one', '1 array read')], worker: [chip('next', 'J1')] }, line: L.REMOVE, bad: true },
  }),

  'sort-claim': listSpec([INCOMING, LIST, SORTED], {
    add: { rows: { new: [chip('j5', 'J5')], list: slots(jobs(1, 5), 'run') }, line: L.ADD },
    sorted: { rows: { new: [chip('j5', 'J5')], list: slots(jobs(1, 5), 'run'), sorted: slots(['t1', 't2', 't3', 't4', 't5']) }, line: L.ADD },
  }),
  'sort-reality': listSpec([INCOMING, LIST, SORTED], {
    append: { rows: { new: [chip('j5', 'J5')], list: [...J1_4, chip('s4', 'J5', 'ok')] }, line: L.ADD },
    sorted: { rows: { new: [], list: [...J1_4, chip('s4', 'J5')], sorted: slots(['t2', 't3', 't4', 't5'], 'bad') }, line: null },
  }),

  'cap-claim': listSpec([SHRUNK, CAPACITY], {
    shrink: { rows: { list: shifted('item'), cap: [chip('cap', 'capacity shrinks'), chip('alloc', 'array reallocated')] }, line: L.REMOVE },
    ensure: { rows: { list: shifted('item'), cap: [chip('cap', 'EnsureCapacity(n)'), chip('alloc', 'no more reallocations')] }, line: L.REMOVE },
  }),
  'cap-reality': listSpec([LIST, CAPACITY], {
    keeps: { rows: { list: shifted('item'), cap: [chip('cap', 'capacity unchanged', 'ok')] }, line: L.REMOVE },
    shift: { rows: { list: shifted('bad'), cap: [chip('cap', 'capacity unchanged'), chip('copies', 'every job copied down', 'bad')] }, line: L.REMOVE, bad: true },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
