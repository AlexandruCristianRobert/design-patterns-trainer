import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'builder.Services.AddDbContext<AppDbContext>(…); // scoped',
  'builder.Services.AddSingleton<ReportService>();',
  '',
  'class ReportService(AppDbContext db) { /* … */ }',
  '',
  'var app = builder.Build(); // Development',
  'app.Run();',
]
const L = { REG: [0, 1] as [number, number], CTOR: 3, BUILD: 5, RUN: [5, 6] as [number, number] }

// ---- Registrations (the Setup and the validation stage) ----
const REG_REGIONS: Region[] = [{ id: 'reg', name: 'Registrations', sub: 'the service collection', tone: 'muted', wrap: true }]
const regDb: Box = { id: 'reg-db', region: 'reg', title: 'AppDbContext', fields: [{ name: 'lifetime', value: 'Scoped' }] }
const regSvc = (needs: Field['kind'] | false, kind?: Box['kind']): Box => ({
  id: 'reg-svc',
  region: 'reg',
  title: 'ReportService',
  kind,
  fields: [{ name: 'lifetime', value: 'Singleton' }, ...(needs === false ? [] : [{ name: 'needs', value: 'AppDbContext', ref: 'reg-db', kind: needs }])],
})
const reg = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REG_REGIONS, code: CODE, outputName: 'Outcome', steps })

const ERROR = "throws: Cannot consume scoped service 'AppDbContext' from singleton 'ReportService'."
const thrown: OutLine = { label: 'Build()', text: ERROR, kind: 'bad' }

// ---- Scopes at run time (the captive dependency and the claims) ----
const REGIONS: Region[] = [
  { id: 'r1', name: 'Request 1 scope', sub: 'lives for one request', tone: 'ui' },
  { id: 'root', name: 'Root scope', sub: 'lives as long as the app', tone: 'pool' },
  { id: 'r2', name: 'Request 2 scope', sub: 'lives for one request', tone: 'ui' },
]
const scopes = (steps: Record<string, GraphStep>): GraphSpec => ({ regions: REGIONS, code: CODE, outputName: 'Outcome', steps })

/** A request's handler, which uses ReportService. */
const handler = (r: 'r1' | 'r2', svc: string, svcLabel = 'ReportService'): Box => ({
  id: `${r}-handler`,
  region: r,
  title: `Request ${r === 'r1' ? 1 : 2} handler`,
  fields: [{ name: 'uses', value: svcLabel, ref: svc }],
})
/** The AppDbContext a request scope has of its own (what its other services get). */
const ownCtx = (r: 'r1' | 'r2', kind: Box['kind'] = 'plain', sub = 'this request\'s own'): Box => ({
  id: `${r}-ctx`,
  region: r,
  title: `AppDbContext #${r === 'r1' ? 2 : 3}`,
  sub,
  kind,
})
const singleton = (dbRef: string, dbLabel: string, kind?: Box['kind']): Box => ({
  id: 'svc',
  region: 'root',
  title: 'ReportService',
  sub: 'singleton',
  kind,
  fields: [{ name: 'db', value: dbLabel, ref: dbRef, kind: kind === 'bad' ? 'bad' : undefined }],
})
const rootCtx = (fields: Field[] = [], kind?: Box['kind']): Box => ({ id: 'root-ctx', region: 'root', title: 'AppDbContext #1', sub: 'resolved from the root scope', kind, fields })

const captive1 = [handler('r1', 'svc'), ownCtx('r1'), singleton('root-ctx', 'AppDbContext #1'), rootCtx()]
const captive2 = [...captive1, handler('r2', 'svc'), ownCtx('r2', 'muted', "this request's own, unused")]
const R = {
  /** Development: building the singleton fails before any request. */
  build: {
    boxes: [singleton('root-reg', 'AppDbContext', 'bad'), { id: 'root-reg', region: 'root', title: 'AppDbContext', sub: 'scoped registration', kind: 'bad' as const }],
    line: L.BUILD,
    bad: true,
    output: [thrown],
  },
  request1: { boxes: captive1, line: L.CTOR, output: [{ label: 'Without validation', text: 'one AppDbContext, captured by the singleton' }] },
  request2: { boxes: captive2, line: L.CTOR, output: [{ label: 'Without validation', text: 'one AppDbContext, captured by the singleton' }] },
  concurrent: {
    boxes: [
      ...captive2.filter((b) => b.id !== 'root-ctx'),
      rootCtx([{ name: 'used by', value: 'requests 1 and 2 at once', kind: 'bad' }, { name: 'tracked', value: 'keeps growing', kind: 'bad' }], 'bad'),
    ],
    line: L.CTOR,
    output: [{ label: 'Without validation', text: 'shared by parallel requests, not thread-safe: a captive dependency', kind: 'bad' }],
  },
} satisfies Record<string, GraphStep>

const SPECS: Record<string, GraphSpec> = {
  setup: reg({
    register: { boxes: [regDb, regSvc(false)], line: L.REG },
    ctor: { boxes: [regDb, regSvc(undefined)], line: L.CTOR },
    run: { boxes: [regDb, regSvc(undefined)], line: L.RUN, output: [{ label: 'Build and run', text: '?', kind: 'muted' }] },
  }),
  'validation-on': reg({
    check: { boxes: [regDb, regSvc('bad', 'bad')], line: L.BUILD },
    throws: { boxes: [regDb, regSvc('bad', 'bad')], line: L.BUILD, bad: true, output: [thrown] },
  }),
  'validation-off': scopes({ 'request-1': R.request1, 'request-2': R.request2, concurrent: R.concurrent }),

  'proxy-claim': scopes({
    build: { boxes: [singleton('proxy', 'proxy'), { id: 'proxy', region: 'root', title: 'proxy', sub: 'claimed: made by the container' }], line: L.BUILD },
    'request-1': {
      boxes: [
        handler('r1', 'svc'),
        ownCtx('r1', 'plain', "request 1's"),
        singleton('proxy', 'proxy'),
        { id: 'proxy', region: 'root', title: 'proxy', sub: 'claimed: made by the container', fields: [{ name: 'calls go to', value: 'AppDbContext #2', ref: 'r1-ctx' }] },
      ],
      line: L.CTOR,
    },
    'request-2': {
      boxes: [
        handler('r2', 'svc'),
        ownCtx('r2', 'plain', "request 2's"),
        singleton('proxy', 'proxy'),
        { id: 'proxy', region: 'root', title: 'proxy', sub: 'claimed: made by the container', fields: [{ name: 'calls go to', value: 'AppDbContext #3', ref: 'r2-ctx' }] },
      ],
      line: L.CTOR,
    },
  }),
  'proxy-reality': scopes({ build: R.build, 'request-1': R.request1, 'request-2': R.request2 }),

  'app-lifetime-claim': scopes({
    build: { boxes: [singleton('root-ctx', 'AppDbContext #1'), rootCtx([{ name: 'lives', value: 'as long as the app' }])], line: L.BUILD },
    'request-1': { boxes: [handler('r1', 'svc'), singleton('root-ctx', 'AppDbContext #1'), rootCtx([{ name: 'lives', value: 'as long as the app' }])], line: L.CTOR },
    concurrent: {
      boxes: [
        handler('r1', 'svc'),
        handler('r2', 'svc'),
        singleton('root-ctx', 'AppDbContext #1'),
        rootCtx([{ name: 'lives', value: 'as long as the app' }, { name: 'used by', value: 'requests 1 and 2 at once', kind: 'ok' }, { name: 'claimed', value: 'thread-safe', kind: 'ok' }], 'ok'),
      ],
      line: L.CTOR,
    },
  }),
  'app-lifetime-reality': scopes({ build: R.build, 'request-1': R.request1, concurrent: R.concurrent }),

  'lifetime-changed-claim': scopes({
    build: { boxes: [{ id: 'reg', region: 'root', title: 'ReportService', sub: 'registration', fields: [{ name: 'was', value: 'Singleton', kind: 'muted' }, { name: 'now', value: 'Scoped', kind: 'bad' }] }], line: L.BUILD },
    'request-1': {
      boxes: [
        handler('r1', 'r1-svc', 'ReportService #1'),
        { id: 'r1-svc', region: 'r1', title: 'ReportService #1', sub: 'claimed: scoped', fields: [{ name: 'db', value: 'AppDbContext #2', ref: 'r1-ctx' }] },
        ownCtx('r1', 'plain', "request 1's"),
        { id: 'reg', region: 'root', title: 'ReportService', sub: 'registration', fields: [{ name: 'lifetime', value: 'Scoped' }] },
      ],
      line: L.CTOR,
    },
    'request-2': {
      boxes: [
        handler('r1', 'r1-svc', 'ReportService #1'),
        { id: 'r1-svc', region: 'r1', title: 'ReportService #1', sub: 'claimed: scoped', fields: [{ name: 'db', value: 'AppDbContext #2', ref: 'r1-ctx' }] },
        ownCtx('r1', 'plain', "request 1's"),
        { id: 'reg', region: 'root', title: 'ReportService', sub: 'registration', fields: [{ name: 'lifetime', value: 'Scoped' }] },
        handler('r2', 'r2-svc', 'ReportService #2'),
        { id: 'r2-svc', region: 'r2', title: 'ReportService #2', sub: 'claimed: scoped', fields: [{ name: 'db', value: 'AppDbContext #3', ref: 'r2-ctx' }] },
        ownCtx('r2', 'plain', "request 2's"),
      ],
      line: L.CTOR,
    },
  }),
  'lifetime-changed-reality': scopes({ build: R.build, 'request-1': R.request1, 'request-2': R.request2 }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={spec} {...p} />]),
)
export default drawing
