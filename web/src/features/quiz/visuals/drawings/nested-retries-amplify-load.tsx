import { OutputStrip, type OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import type { ChipKind, Tone } from '../RowStage'

type Kind = 'plain' | 'ok' | 'bad' | 'muted'
interface FanRow { id: string; name: string; sub?: string; tone: Tone }
interface Cell {
  /** Attempts drawn as small squares, in groups of four (one group per call from the layer above). */
  dots?: number
  dotKind?: Kind
  chips?: { label: string; kind?: ChipKind }[]
  note?: string
  noteKind?: Kind
}
interface FanStep { rows: Partial<Record<string, Cell>>; output?: OutLine[] }
interface FanSpec { rows: FanRow[]; steps: Record<string, FanStep> }

const same = (a?: Cell, b?: Cell) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})

/** Calls per hop: each row counts the attempts one hop makes for a single user call. */
const fanStage = (spec: FanSpec, { stepIds, stepIndex, reduced }: StageDrawingProps) => {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const known = new Set(spec.rows.map((r) => r.id))
  for (const [id, s] of Object.entries(spec.steps)) for (const r of Object.keys(s.rows)) if (!known.has(r)) throw new Error(`step "${id}" uses unknown row "${r}"`)
  const step = spec.steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? spec.steps[stepIds[stepIndex - 1]] : undefined
  return (
    <div className={`qv-fan-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-rows">
        {spec.rows.map((row) => {
          const cell = step.rows[row.id]
          const now = !!prev && !same(cell, prev.rows[row.id])
          const groups = cell?.dots ? Array.from({ length: Math.ceil(cell.dots / 4) }, (_, g) => Math.min(4, cell.dots! - g * 4)) : []
          return (
            <div key={row.id} className={`qv-row tone-${row.tone}`}>
              <div className="qv-row-name">
                {row.name}
                {row.sub && <small>{row.sub}</small>}
              </div>
              <div className="qv-row-track">
                {groups.length > 0 && (
                  <span className={`qv-dots${now ? ' is-now' : ''}`} aria-label={`${cell!.dots} attempts`}>
                    {groups.map((n, g) => (
                      <span key={g} className="qv-dot-group">
                        {Array.from({ length: n }, (_, i) => (
                          <span key={i} className={`qv-dot is-${cell!.dotKind ?? 'plain'}`} />
                        ))}
                      </span>
                    ))}
                  </span>
                )}
                {cell?.chips?.map((c, i) => (
                  <span key={i} className={`qv-chip is-${c.kind ?? 'run'}${now ? ' is-now' : ''}`}>{c.label}</span>
                ))}
                {cell?.note && <span className={`qv-fan-note is-${cell.noteKind ?? 'plain'}`}>{cell.note}</span>}
              </div>
            </div>
          )
        })}
      </div>
      {step.output && <OutputStrip name="Database" lines={step.output} prev={prev?.output} first={!prev} />}
    </div>
  )
}

const USER: FanRow = { id: 'user', name: 'User', sub: 'one call', tone: 'muted' }
const GW: FanRow = { id: 'gw', name: 'Gateway → A', tone: 'ui' }
const A: FanRow = { id: 'a', name: 'A → B', tone: 'pool' }
const B: FanRow = { id: 'b', name: 'B → database', tone: 'io' }
const POOL: FanRow = { id: 'pool', name: 'Connection pool', sub: 'in B', tone: 'muted' }
const QUEUE: FanRow = { id: 'queue', name: 'Waiting in callers', tone: 'muted' }
const HOPS = [USER, GW, A, B]

const one: Cell = { dots: 1 }
const user = { user: one }
const RETRIES: Cell = { chips: [{ label: 'retries a failure 3 times' }] }
const fan = (dotKind: Kind = 'bad'): FanStep['rows'] => ({
  ...user,
  gw: { dots: 4, dotKind, note: '4' },
  a: { dots: 16, dotKind, note: '4 × 4 = 16' },
  b: { dots: 64, dotKind, note: '4 × 4 × 4 = 64', noteKind: 'bad' },
})
const db = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Load', text, kind }]
const UP_TO_64 = db('up to 64 attempts per user call', 'bad')

const spec = (rows: FanRow[], steps: Record<string, FanStep>): FanSpec => ({ rows, steps })

const SPECS: Record<string, FanSpec> = {
  setup: spec(HOPS, {
    chain: { rows: { ...user, gw: one, a: one, b: one } },
    retries: { rows: { ...user, gw: { ...one, ...RETRIES }, a: { ...one, ...RETRIES }, b: { ...one, ...RETRIES } } },
    slow: {
      rows: { ...user, gw: RETRIES, a: RETRIES, b: { ...RETRIES, note: '?', noteKind: 'muted' } },
      output: db('slow, and far above normal traffic', 'bad'),
    },
  }),
  multiply: spec(HOPS, {
    gateway: { rows: { ...user, gw: fan().gw } },
    a: { rows: { ...user, gw: fan().gw, a: fan().a } },
    b: { rows: fan() },
    load: { rows: fan(), output: UP_TO_64 },
  }),
  'one-layer': spec(HOPS, {
    'b-only': { rows: { ...user, gw: { dots: 1, note: '1, no retry' }, a: { dots: 1, note: '1, no retry' }, b: { dots: 4, dotKind: 'ok', note: '4' } } },
    budget: {
      rows: { ...user, gw: { dots: 1, note: '1, no retry' }, a: { dots: 1, note: '1, no retry' }, b: { dots: 4, dotKind: 'ok', note: '4' } },
      output: db('at most 4 attempts per user call', 'ok'),
    },
  }),

  'connections-claim': spec([B, POOL], {
    retry: { rows: { b: { dots: 4, note: '1 + 3 retries' }, pool: { chips: [1, 2, 3, 4].map(() => ({ label: 'new', kind: 'bad' as const })) } } },
    logins: {
      rows: { b: { dots: 4, note: '1 + 3 retries' }, pool: { chips: [{ label: 'empty', kind: 'bad' }] } },
      output: db('busy with logins', 'bad'),
    },
  }),
  'connections-reality': spec([...HOPS, POOL], {
    retry: { rows: { b: { dots: 4, note: '1 + 3 retries' }, pool: { chips: [{ label: 'reused', kind: 'ok' }] } } },
    attempts: { rows: { ...fan(), pool: { chips: [{ label: 'reused', kind: 'ok' }] } }, output: UP_TO_64 },
  }),

  'timeouts-claim': spec([GW, A, B, QUEUE], {
    wait: { rows: { gw: { chips: [{ label: 'full timeout, then retry', kind: 'wait' }] }, a: { chips: [{ label: 'full timeout, then retry', kind: 'wait' }] }, b: { chips: [{ label: 'full timeout, then retry', kind: 'wait' }] } } },
    pile: {
      rows: {
        gw: { chips: [{ label: 'full timeout, then retry', kind: 'wait' }] },
        a: { chips: [{ label: 'full timeout, then retry', kind: 'wait' }] },
        b: { chips: [{ label: 'full timeout, then retry', kind: 'wait' }] },
        queue: { chips: [1, 2, 3, 4, 5, 6].map(() => ({ label: 'request', kind: 'bad' as const })) },
      },
      output: db('caused by the queued requests', 'bad'),
    },
  }),
  'timeouts-reality': spec([...HOPS, QUEUE], {
    wait: { rows: { queue: { chips: [1, 2, 3, 4, 5, 6].map(() => ({ label: 'request', kind: 'wait' as const })), note: 'slower, but no query' } } },
    attempts: { rows: { ...fan(), queue: { chips: [1, 2, 3, 4, 5, 6].map(() => ({ label: 'request', kind: 'wait' as const })), note: 'slower, but no query' } }, output: UP_TO_64 },
  }),

  'deadlocks-claim': spec([A, B], {
    race: { rows: { a: { chips: [{ label: 'retry, row 42', kind: 'bad' }] }, b: { chips: [{ label: 'retry, row 42', kind: 'bad' }], note: 'at the same time', noteKind: 'bad' } } },
    deadlock: {
      rows: { a: { chips: [{ label: 'retry, row 42', kind: 'bad' }] }, b: { chips: [{ label: 'retry, row 42', kind: 'bad' }], note: 'at the same time', noteKind: 'bad' } },
      output: db('deadlocks', 'bad'),
    },
  }),
  'deadlocks-reality': spec(HOPS, {
    race: {
      rows: {
        a: { chips: ['1st', '2nd', '3rd', '4th'].map((label) => ({ label, kind: 'item' as const })), note: 'one after another' },
        b: { chips: ['1st', '2nd', '3rd', '4th'].map((label) => ({ label, kind: 'item' as const })), note: 'one after another' },
      },
    },
    attempts: { rows: fan(), output: UP_TO_64 },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => fanStage(s, p)]),
)
export default drawing
