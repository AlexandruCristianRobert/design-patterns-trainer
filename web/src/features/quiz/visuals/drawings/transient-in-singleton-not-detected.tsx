import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'builder.Services.AddSingleton<ReportCache>();',
  'builder.Services.AddTransient<CsvFormatter>();',
  '',
  'class ReportCache(CsvFormatter formatter) { /* … */ }',
  'class CsvFormatter { StringBuilder buffer = new(); /* … */ }',
  '',
  'var app = builder.Build(); // scope validation on',
  'app.Run();',
]
const L = { REG: [0, 1] as [number, number], CTOR: 3, FMT: 4, BUILD: 6, RUN: [6, 7] as [number, number] }

// ---- Registrations ----
const REG_REGIONS: Region[] = [{ id: 'reg', name: 'Registrations', sub: 'the service collection', tone: 'muted', wrap: true }]
const regCache = (needs: boolean): Box => ({
  id: 'reg-cache',
  region: 'reg',
  title: 'ReportCache',
  fields: [{ name: 'lifetime', value: 'Singleton' }, ...(needs ? [{ name: 'needs', value: 'CsvFormatter', ref: 'reg-fmt' }] : [])],
})
const regFmt = (lifetime: Field[] = [{ name: 'lifetime', value: 'Transient' }], kind?: Box['kind']): Box => ({
  id: 'reg-fmt',
  region: 'reg',
  title: 'CsvFormatter',
  kind,
  fields: [...lifetime, { name: 'buffer', value: 'mutable' }],
})
const reg = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REG_REGIONS, code: CODE, outputName: 'Outcome', steps })
const REGS = [regCache(true), regFmt()]
const STARTS: OutLine = { label: 'Build()', text: 'starts: no error, no warning', kind: 'ok' }

// ---- Scopes at run time ----
const REGIONS: Region[] = [
  { id: 'r1', name: 'Request 1 scope', sub: 'lives for one request', tone: 'ui' },
  { id: 'root', name: 'Root scope', sub: 'lives as long as the app', tone: 'pool' },
  { id: 'r2', name: 'Request 2 scope', sub: 'lives for one request', tone: 'ui' },
]
const scopes = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Outcome', steps })

const cache = (fmtRef = 'fmt1', fmtLabel = 'CsvFormatter #1', kind?: Field['kind']): Box => ({
  id: 'cache',
  region: 'root',
  title: 'ReportCache',
  sub: 'singleton',
  fields: [{ name: 'formatter', value: fmtLabel, ref: fmtRef, kind }],
})
const fmt1 = (fields: Field[] = [{ name: 'buffer', value: 'one instance' }], kind?: Box['kind']): Box => ({ id: 'fmt1', region: 'root', title: 'CsvFormatter #1', sub: 'created for the singleton', kind, fields })
const handler = (r: 'r1' | 'r2', fields: Field[] = [{ name: 'uses', value: 'ReportCache', ref: 'cache' }]): Box => ({ id: `${r}-handler`, region: r, title: `Request ${r === 'r1' ? 1 : 2} handler`, fields })
const export1: Box = { id: 'r1-export', region: 'r1', title: 'CsvExport', sub: 'asks for CsvFormatter itself', fields: [{ name: 'formatter', value: 'CsvFormatter #2', ref: 'r1-fmt' }] }
const fmt2: Box = { id: 'r1-fmt', region: 'r1', title: 'CsvFormatter #2', sub: 'a new transient' }

const C = {
  build: [cache(), fmt1()],
  r1: [handler('r1'), export1, fmt2, cache(), fmt1()],
}
const C_R2 = [...C.r1, handler('r2')]
const R = {
  build: { boxes: C.build, line: L.CTOR },
  request1: { boxes: C.r1, line: L.CTOR },
  request2: { boxes: C_R2, line: L.CTOR },
  concurrent: {
    boxes: [...C_R2.filter((b) => b.id !== 'fmt1'), fmt1([{ name: 'buffer', value: 'written by 1 and 2 at once', kind: 'bad' }], 'bad')],
    line: L.FMT,
    output: [{ label: 'Effect', text: 'one shared buffer: a captive dependency nobody reports', kind: 'bad' }],
  },
} satisfies Record<string, GraphStep>

const SPECS: Record<string, GraphSpec> = {
  setup: reg({
    register: { boxes: [regCache(false), regFmt()], line: { each: [L.REG, L.FMT] } },
    ctor: { boxes: REGS, line: L.CTOR },
    run: { boxes: REGS, line: L.RUN, output: [{ label: 'Build and run', text: '?', kind: 'muted' }] },
  }),

  startup: reg({
    check: { boxes: [regCache(true), regFmt(undefined, 'ok')], line: L.BUILD, output: [{ label: 'Validation', text: 'no scoped service found' }] },
    starts: { boxes: [regCache(true), regFmt(undefined, 'ok')], line: L.RUN, output: [{ label: 'Validation', text: 'no scoped service found' }, STARTS] },
  }),
  captured: scopes({ build: R.build, 'request-1': R.request1, 'request-2': R.request2, concurrent: R.concurrent }),

  'throws-claim': reg({
    check: { boxes: [regCache(true), regFmt([{ name: 'lifetime', value: 'Transient', kind: 'bad' }])], line: L.BUILD },
    throws: {
      boxes: [regCache(true), regFmt([{ name: 'lifetime', value: 'Transient', kind: 'bad' }])],
      line: L.BUILD,
      bad: true,
      output: [{ label: 'Build()', text: 'throws: singleton depends on a transient', kind: 'bad' }],
    },
  }),
  'throws-reality': reg({
    check: { boxes: [regCache(true), regFmt(undefined, 'ok')], line: L.BUILD, output: [{ label: 'Validation', text: 'checks scoped services only' }] },
    throws: {
      boxes: [regCache(true), regFmt(undefined, 'ok')],
      line: L.RUN,
      output: [{ label: 'Validation', text: 'checks scoped services only' }, STARTS, { label: 'Then', text: 'ReportCache keeps one CsvFormatter', kind: 'bad' }],
    },
  }),

  'per-use-claim': scopes({
    'first-use': { boxes: [handler('r1'), cache('fmt1', 'new per use'), { ...fmt1([]), sub: 'claimed: made for this use' }], line: L.CTOR },
    'second-use': {
      boxes: [handler('r1'), cache('fmt-next', 'new per use', 'bad'), { ...fmt1([]), kind: 'gone', sub: 'used once' }, { id: 'fmt-next', region: 'root', title: 'CsvFormatter #2', sub: 'claimed: made for this use', kind: 'bad' }],
      line: L.CTOR,
      bad: true,
    },
  }),
  'per-use-reality': scopes({
    'first-use': { boxes: [handler('r1'), cache(), fmt1()], line: L.CTOR },
    'second-use': { boxes: [handler('r1'), handler('r2'), cache('fmt1', 'CsvFormatter #1', 'ok'), fmt1([{ name: 'buffer', value: 'same instance', kind: 'ok' }])], line: L.CTOR },
  }),

  'upgrade-claim': reg({
    build: { boxes: [regCache(true), regFmt([{ name: 'was', value: 'Transient', kind: 'muted' }, { name: 'now', value: 'Singleton', kind: 'bad' }], 'bad')], line: L.BUILD, bad: true },
    warn: {
      boxes: [regCache(true), regFmt([{ name: 'was', value: 'Transient', kind: 'muted' }, { name: 'now', value: 'Singleton', kind: 'bad' }], 'bad')],
      line: L.BUILD,
      bad: true,
      output: [{ label: 'Log', text: 'warn: lifetime mismatch', kind: 'bad' }],
    },
  }),
  'upgrade-reality': scopes({
    build: {
      boxes: [{ id: 'reg', region: 'root', title: 'CsvFormatter', sub: 'registration', fields: [{ name: 'lifetime', value: 'Transient', kind: 'ok' }] }],
      line: L.BUILD,
      output: [{ label: 'Log', text: 'nothing', kind: 'muted' }],
    },
    warn: {
      boxes: [handler('r1', [{ name: 'formatter', value: 'CsvFormatter #2', ref: 'r1-fmt' }]), fmt2, cache(), fmt1(), { id: 'reg', region: 'root', title: 'CsvFormatter', sub: 'registration', fields: [{ name: 'lifetime', value: 'Transient', kind: 'ok' }] }],
      line: L.CTOR,
      output: [{ label: 'Log', text: 'nothing', kind: 'muted' }],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={spec} {...p} />]),
)
export default drawing
