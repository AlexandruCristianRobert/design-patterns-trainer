import type { CSSProperties } from 'react'
import { OutputStrip, type OutLine } from '../BoxGraph'
import { CodePanel, type LineAt } from '../CodePanel'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

type Kind = 'plain' | 'ok' | 'warn' | 'bad' | 'muted'
/** A time span on the axis (token lifetime, tolerance…); `open` runs it past the end of the axis. */
interface Band { key: string; from: number; to: number; label: string; kind: Kind; open?: boolean }
/** A moment on the axis: a request and its answer, or `exp`. Line 0 sits right above the bands, line 1 above it. */
interface Pin { key: string; at: number; label: string; kind: Kind; line?: 0 | 1 }
interface TimeStep { bands: Band[]; pins: Pin[]; line?: LineAt; bad?: boolean; output?: OutLine[]; code?: string[] }
interface TimeSpec { code: string[]; steps: Record<string, TimeStep> }

const SPAN = 8
const TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const pct = (v: number) => `${((Math.min(v, SPAN) / SPAN) * 100).toFixed(3)}%`
/** Labels near the ends lean inwards so they stay inside the chart. */
const lean = (at: number) => {
  const f = at / SPAN
  return f < 0.12 ? (f / 0.12) * 50 : f > 0.88 ? 50 + ((f - 0.88) / 0.12) * 50 : 50
}
const sameBand = (a: Band, b: Band) => a.from === b.from && a.to === b.to && a.label === b.label && a.kind === b.kind
const samePin = (a: Pin, b: Pin) => a.at === b.at && a.label === b.label && a.kind === b.kind

/** A time axis in minutes: bands for spans, pins for requests, with the config code and the API's answers underneath. */
const timeline = (spec: TimeSpec, { stepIds, stepIndex, reduced }: StageDrawingProps) => {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const step = spec.steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? spec.steps[stepIds[stepIndex - 1]] : undefined
  const bandNow = (b: Band) => !!prev && !prev.bands.some((p) => p.key === b.key && sameBand(p, b))
  const pinNow = (p: Pin) => !!prev && !prev.pins.some((q) => q.key === p.key && samePin(q, p))
  const lines = step.pins.some((p) => p.line === 1) ? 2 : 1
  return (
    <div className={`qv-tl-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-tl">
        <div className="qv-tl-pins" style={{ '--qv-tl-lines': lines } as CSSProperties}>
          {step.pins.map((p) => (
            <span
              key={p.key}
              className={`qv-tl-pin is-${p.kind}${pinNow(p) ? ' is-now' : ''}`}
              style={{ left: pct(p.at), bottom: `calc(${p.line ?? 0} * 26px)`, transform: `translateX(-${lean(p.at).toFixed(1)}%)` }}
            >
              {p.label}
            </span>
          ))}
        </div>
        <div className="qv-tl-track">
          {step.bands.map((b) => (
            <span
              key={b.key}
              className={`qv-tl-band is-${b.kind}${b.open ? ' is-open' : ''}${bandNow(b) ? ' is-now' : ''}`}
              style={{ left: pct(b.from), width: `calc(${pct(b.to)} - ${pct(b.from)})` }}
              aria-hidden
            />
          ))}
          {step.pins.map((p) => (
            <span key={p.key} className={`qv-tl-stem is-${p.kind}`} style={{ left: pct(p.at) }} aria-hidden />
          ))}
        </div>
        <div className="qv-tl-ticks" aria-hidden>
          {TICKS.map((t) => (
            <span key={t} style={{ left: pct(t) }}>
              {t}
            </span>
          ))}
        </div>
        <div className="qv-tl-axis">minutes after the token was issued</div>
        {step.bands.length > 0 && (
          <div className="qv-tl-legend">
            {step.bands.map((b) => (
              <span key={b.key} className={`qv-tl-key is-${b.kind}${bandNow(b) ? ' is-now' : ''}`}>
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {step.output && <OutputStrip name="API" lines={step.output} prev={prev?.output} first={!prev} />}
      <CodePanel code={step.code ?? spec.code} line={step.line ?? null} bad={step.bad} />
    </div>
  )
}

const config = (...params: string[]) => [
  '// access tokens live 1 minute',
  'services.AddAuthentication()',
  '  .AddJwtBearer(o =>',
  '    o.TokenValidationParameters = new()',
  '    {',
  '      ValidIssuer = "api",',
  '      ValidAudience = "api",',
  '      IssuerSigningKey = signingKey,',
  ...params.map((p) => `      ${p}`),
  '    });',
]
const CODE = config()
const DEFAULT_CODE = config('// ClockSkew: 5 minutes by default')
const FIXED_CODE = config('ClockSkew = TimeSpan.FromSeconds(30),')
const LIFETIME_OFF_CODE = config('// ValidateLifetime: off by default')
const LIFETIME_ON_CODE = config('ValidateLifetime = true,')
const L = { TOKEN: 0, CONFIG: [1, 8] as [number, number], PARAM: 8 }

const LIFETIME: Band = { key: 'life', from: 0, to: 1, label: 'lifetime: 1 min', kind: 'ok' }
const SKEW: Band = { key: 'skew', from: 1, to: 6, label: 'ClockSkew: 5 min after exp', kind: 'warn' }
const SKEW_30: Band = { key: 'skew', from: 1, to: 1.5, label: 'ClockSkew: 30 s', kind: 'warn' }
const EXP: Pin = { key: 'exp', at: 1, label: 'exp', kind: 'muted', line: 1 }
const req = (at: number, label: string, kind: Kind): Pin => ({ key: `r${at}`, at, label, kind })
const ACCEPTED_4 = req(4, '200 OK', 'bad')
const REJECTED_7 = req(7, '401', 'ok')
const api = (...lines: [string, string, OutLine['kind']?][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind }))
const AT_4_OK = api(['minute 4', '200 OK, token accepted', 'bad'])

const spec = (code: string[], steps: Record<string, TimeStep>): TimeSpec => ({ code, steps })

const SPECS: Record<string, TimeSpec> = {
  setup: spec(CODE, {
    token: { bands: [LIFETIME], pins: [EXP], line: L.TOKEN },
    config: { bands: [LIFETIME], pins: [EXP], line: L.CONFIG },
    test: { bands: [LIFETIME], pins: [EXP, req(4, '200 OK', 'plain')], line: L.CONFIG, output: api(['minute 4', '200 OK, token accepted']) },
  }),
  skew: spec(DEFAULT_CODE, {
    exp: { bands: [LIFETIME], pins: [EXP], line: L.CONFIG },
    skew: { bands: [LIFETIME, SKEW], pins: [EXP], line: L.PARAM },
    accepted: { bands: [LIFETIME, SKEW], pins: [EXP, ACCEPTED_4], line: L.PARAM, output: AT_4_OK },
    rejected: { bands: [LIFETIME, SKEW], pins: [EXP, ACCEPTED_4, REJECTED_7], line: L.PARAM, output: [...AT_4_OK, ...api(['minute 7', '401, token expired', 'ok'])] },
  }),
  fixed: spec(FIXED_CODE, {
    set: { bands: [LIFETIME, SKEW_30], pins: [EXP], line: L.PARAM },
    rejected: { bands: [LIFETIME, SKEW_30], pins: [EXP, req(4, '401', 'ok')], line: L.PARAM, output: api(['minute 4', '401, token expired', 'ok']) },
  }),

  'cache-claim': spec(CODE, {
    first: { bands: [LIFETIME], pins: [EXP, req(0.5, 'validated', 'plain')], line: L.CONFIG, output: api(['cache', 'token: valid', 'bad']) },
    later: {
      bands: [LIFETIME, { key: 'cache', from: 0.5, to: SPAN, label: 'cached result: until evicted', kind: 'bad', open: true }],
      pins: [EXP, req(0.5, 'validated', 'plain'), req(4, '200 from cache', 'bad')],
      line: L.CONFIG,
      output: api(['cache', 'token: valid', 'bad'], ['minute 4', '200 OK, from the cache', 'bad']),
    },
  }),
  'cache-reality': spec(DEFAULT_CODE, {
    first: { bands: [LIFETIME], pins: [EXP, req(0.5, 'validated', 'plain'), req(4, 'validated', 'plain')], line: L.CONFIG, output: api(['cache', 'none', 'ok']) },
    later: { bands: [LIFETIME, SKEW], pins: [EXP, req(0.5, 'validated', 'plain'), ACCEPTED_4], line: L.PARAM, output: api(['cache', 'none', 'ok'], ['minute 4', '200 OK, inside exp + ClockSkew', 'bad']) },
  }),

  'lifetime-claim': spec(LIFETIME_OFF_CODE, {
    default: {
      bands: [{ ...LIFETIME, kind: 'muted', label: 'lifetime: 1 min, not checked' }],
      pins: [EXP, req(4, '200 OK', 'bad'), req(7, '200 OK', 'bad')],
      line: L.PARAM,
      bad: true,
      output: api(['minute 7', '200 OK, exp never checked', 'bad']),
    },
    explicit: {
      bands: [LIFETIME],
      pins: [EXP, req(4, '401', 'bad')],
      code: LIFETIME_ON_CODE,
      line: L.PARAM,
      output: api(['minute 4', '401, token expired', 'bad']),
    },
  }),
  'lifetime-reality': spec(DEFAULT_CODE, {
    default: { bands: [LIFETIME, SKEW], pins: [EXP, ACCEPTED_4, REJECTED_7], line: L.PARAM, output: api(['ValidateLifetime', 'true by default', 'ok'], ['minute 7', '401, token expired', 'ok']) },
    explicit: { bands: [LIFETIME, SKEW], pins: [EXP, ACCEPTED_4], code: LIFETIME_ON_CODE, line: L.PARAM, output: AT_4_OK },
  }),

  'timezone-claim': spec(CODE, {
    read: { bands: [LIFETIME], pins: [EXP], line: L.CONFIG, output: api(['exp read as', 'local time (+1 h)', 'bad']) },
    extended: {
      bands: [LIFETIME, { key: 'tz', from: 1, to: SPAN, label: '+1 h time zone offset, to minute 61', kind: 'bad', open: true }],
      pins: [EXP, ACCEPTED_4],
      line: L.CONFIG,
      output: api(['exp read as', 'local time (+1 h)', 'bad'], ['minute 4', '200 OK', 'bad']),
    },
  }),
  'timezone-reality': spec(DEFAULT_CODE, {
    read: { bands: [LIFETIME], pins: [EXP], line: L.CONFIG, output: api(['exp', '1767225660: seconds since 1970, UTC', 'ok']) },
    extended: { bands: [LIFETIME, SKEW], pins: [EXP, ACCEPTED_4, REJECTED_7], line: L.PARAM, output: api(['exp', '1767225660: seconds since 1970, UTC', 'ok'], ['extra time', '5 minutes, the ClockSkew']) },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => timeline(s, p)]),
)
export default drawing
