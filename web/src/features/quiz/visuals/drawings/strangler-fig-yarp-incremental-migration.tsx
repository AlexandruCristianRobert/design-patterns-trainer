import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const ROUTES = ['/catalog', '/orders', '/account'] as const
type Route = (typeof ROUTES)[number]

// ---- Setup and reality: a front door and the applications behind it ----
const APP_REGIONS: Region[] = [
  { id: 'front', name: 'Front door', sub: 'all user requests', tone: 'muted' },
  { id: 'apps', name: 'Applications', tone: 'io' },
]
const legacy = (moved: readonly Route[] = [], kind?: Box['kind']): Box => ({
  id: 'legacy',
  region: 'apps',
  title: 'MVC 5 app',
  sub: '.NET Framework 4.8',
  kind,
  fields: ROUTES.map((r): Field => (moved.includes(r) ? { name: r, value: 'moved', kind: 'muted' } : { name: r, value: 'serves' })),
})
const core = (moved: readonly Route[]): Box => ({
  id: 'core',
  region: 'apps',
  title: 'ASP.NET Core app',
  sub: '.NET 8',
  fields: moved.length ? moved.map((r): Field => ({ name: r, value: 'serves', kind: 'ok' })) : [{ name: 'routes', value: 'none yet', kind: 'muted' }],
})
const proxy = (moved: readonly Route[]): Box => ({
  id: 'proxy',
  region: 'front',
  title: 'YARP',
  sub: 'reverse proxy',
  fields: ROUTES.map((r): Field => (moved.includes(r) ? { name: r, value: 'new app', ref: 'core', kind: 'ok' } : { name: r, value: 'old app', ref: 'legacy' })),
})
const prod = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Production', text, kind }]
const migrate = (moved: Route[], text: string): GraphStep => ({ boxes: [proxy(moved), legacy(moved), core(moved)], output: prod(text, 'ok') })

const SETUP_USERS: Box = { id: 'users', region: 'front', title: 'Users', fields: [{ name: 'every route', value: 'old app', ref: 'legacy' }] }

// ---- Multi-targeting ----
const MT_CODE = [
  '<!-- Web.csproj, the MVC 5 project -->',
  '<TargetFrameworks>net48;net8.0</TargetFrameworks>',
  '',
  '// OrdersController.cs',
  'using System.Web.Mvc;',
  'public class OrdersController : Controller { … }',
]
const MT_REGIONS: Region[] = [
  { id: 'src', name: 'Solution', tone: 'ui' },
  { id: 'builds', name: 'Builds', tone: 'pool' },
]
const web: Box = { id: 'web', region: 'src', title: 'Web project', sub: 'MVC 5', fields: [{ name: 'targets', value: 'net48; net8.0' }] }
const lib: Box = { id: 'lib', region: 'src', title: 'Shared library', sub: 'no System.Web', fields: [{ name: 'targets', value: 'net48; net8.0', kind: 'ok' }] }
const build = (id: string, title: string, fields: Field[], kind?: Box['kind']): Box => ({ id, region: 'builds', title, fields, kind })

// ---- The long-lived branch ----
const BR_REGIONS: Region[] = [
  { id: 'prod', name: 'Production', sub: 'what users get', tone: 'io' },
  { id: 'branch', name: 'Rewrite branch', tone: 'ui' },
]
const oldApp = (fields: Field[], kind?: Box['kind']): Box => ({ id: 'old', region: 'prod', title: 'MVC 5 app', sub: '.NET Framework 4.8', fields, kind })
const newApp = (region: string, fields: Field[], kind?: Box['kind']): Box => ({ id: 'new', region, title: 'ASP.NET Core app', sub: '.NET 8', fields, kind })
const reach = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Reaches users', text, kind }]

// ---- The Upgrade Assistant in one pass ----
const UA_REGIONS: Region[] = [
  { id: 'sln', name: 'Solution', sub: 'after the Upgrade Assistant', tone: 'ui' },
  { id: 'prod', name: 'Production', tone: 'io' },
]
const sln = (files: Field['kind'], code: [string, Field['kind']]): Box => ({
  id: 'web',
  region: 'sln',
  title: 'Web project',
  sub: 'MVC 5, every route',
  fields: [
    { name: 'project file', value: 'converted', kind: files },
    { name: 'packages', value: 'updated', kind: files },
    { name: 'System.Web code', value: code[0], kind: code[1] },
  ],
})
const live = (text: string, kind: Box['kind']): Box => ({ id: 'live', region: 'prod', title: 'Deployed', fields: [{ name: 'what', value: text, kind: kind === 'bad' ? 'bad' : undefined }], kind })

const SPECS: Record<string, GraphSpec> = {
  setup: {
    regions: APP_REGIONS,
    steps: {
      legacy: { boxes: [SETUP_USERS, legacy()], output: prod('MVC 5 app, every route') },
      target: {
        boxes: [
          SETUP_USERS,
          legacy(),
          { id: 'core', region: 'apps', title: 'ASP.NET Core app', sub: '.NET 8', fields: [{ name: 'how', value: '?', kind: 'muted' }] },
          { id: 'rewrite', region: 'apps', title: 'Big-bang rewrite', sub: 'abandoned after a year', kind: 'gone' },
        ],
        output: prod('MVC 5 app, every route'),
      },
    },
  },
  'route-by-route': {
    regions: APP_REGIONS,
    outputName: 'Each release',
    steps: {
      proxy: { boxes: [proxy([]), legacy([]), core([])], output: prod('release 1: proxy only, no visible change') },
      catalog: migrate(['/catalog'], 'release 2: /catalog on .NET 8'),
      orders: migrate(['/catalog', '/orders'], 'release 3: /orders on .NET 8'),
      account: migrate([...ROUTES], 'release 4: /account on .NET 8, sign-in bridged'),
      retire: {
        boxes: [proxy([...ROUTES]), { ...legacy([...ROUTES], 'gone'), sub: 'switched off' }, core([...ROUTES])],
        output: prod('old app switched off', 'ok'),
      },
    },
  },

  'multi-target-claim': {
    regions: MT_REGIONS,
    code: MT_CODE,
    steps: {
      target: { boxes: [web, build('b48', 'net48 build', [{ name: 'web app', value: '…' }]), build('b8', 'net8.0 build', [{ name: 'web app', value: '…' }])], line: 1 },
      run: {
        boxes: [web, build('b48', 'net48 build', [{ name: 'web app', value: 'compiles, runs' }]), build('b8', 'net8.0 build', [{ name: 'web app', value: 'compiles, runs', kind: 'bad' }], 'bad')],
        line: 1,
        bad: true,
      },
    },
  },
  'multi-target-reality': {
    regions: MT_REGIONS,
    code: MT_CODE,
    steps: {
      target: { boxes: [web, build('b48', 'net48 build', [{ name: 'web app', value: '…' }]), build('b8', 'net8.0 build', [{ name: 'web app', value: '…' }])], line: 1 },
      run: {
        boxes: [web, build('b48', 'net48 build', [{ name: 'web app', value: 'compiles' }]), build('b8', 'net8.0 build', [{ name: 'web app', value: 'fails', kind: 'bad' }, { name: 'System.Web', value: 'not on .NET 8', kind: 'bad' }], 'bad')],
        line: 4,
        bad: true,
      },
      libs: {
        boxes: [
          web,
          lib,
          build('b48', 'net48 build', [{ name: 'web app', value: 'compiles' }, { name: 'library', value: 'compiles', kind: 'ok' }]),
          build('b8', 'net8.0 build', [{ name: 'web app', value: 'fails', kind: 'bad' }, { name: 'library', value: 'compiles', kind: 'ok' }], 'bad'),
        ],
        line: 1,
      },
    },
  },

  'branch-claim': {
    regions: BR_REGIONS,
    steps: {
      branch: { boxes: [oldApp([{ name: 'changes', value: 'feature freeze' }]), newApp('branch', [{ name: 'rewrite', value: 'in progress' }])], output: reach('the old app') },
      switch: { boxes: [oldApp([{ name: 'changes', value: 'feature freeze' }], 'gone'), newApp('prod', [{ name: 'rewrite', value: 'complete' }])], output: reach('the new app, once complete') },
    },
  },
  'branch-reality': {
    regions: BR_REGIONS,
    steps: {
      branch: { boxes: [oldApp([{ name: 'changes', value: 'feature freeze' }]), newApp('branch', [{ name: 'months', value: '1, 2, … 12, …' }])], output: reach('nothing of the rewrite yet', 'bad') },
      frozen: {
        boxes: [oldApp([{ name: 'changes', value: 'feature freeze' }, { name: 'needed changes', value: 'waiting', kind: 'bad' }], 'bad'), newApp('branch', [{ name: 'months', value: '1, 2, … 12, …' }])],
        output: reach('nothing of the rewrite yet', 'bad'),
      },
      switch: {
        boxes: [oldApp([{ name: 'changes', value: 'feature freeze' }], 'gone'), newApp('prod', [{ name: 'cut-over', value: 'every route at once', kind: 'bad' }], 'bad')],
        output: reach('everything on one day, with all the risk', 'bad'),
      },
    },
  },

  'upgrade-assistant-claim': {
    regions: UA_REGIONS,
    steps: {
      convert: { boxes: [sln('ok', ['converted', 'bad'])], output: prod('MVC 5 app') },
      deploy: { boxes: [sln('ok', ['converted', 'bad']), live('whole app, once it compiles', 'plain')], output: prod('whole new version') },
    },
  },
  'upgrade-assistant-reality': {
    regions: UA_REGIONS,
    steps: {
      convert: { boxes: [sln('ok', ['?', 'muted'])], output: prod('MVC 5 app') },
      manual: { boxes: [sln('ok', ['rewrite by hand', 'bad'])], output: prod('MVC 5 app') },
      deploy: { boxes: [sln('ok', ['rewrite by hand', 'bad']), live('whole app at once', 'bad')], output: prod('one big-bang cut-over', 'bad') },
    },
  },
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
