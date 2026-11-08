import type { Box, Field, GraphSpec, GraphStep, Region } from '../BoxGraph'
import { BoxGraph } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const REGIONS: Region[] = [
  { id: 'callers', name: 'Callers', tone: 'ui' },
  { id: 'ifaces', name: 'Interfaces', tone: 'pool' },
  { id: 'classes', name: 'Classes', tone: 'io' },
]
/** Only the regions some step of the stage puts a box in (no empty "Classes" region in the Setup). */
const graph = (steps: Record<string, GraphStep>, code?: string[]): GraphSpec => ({
  regions: REGIONS.filter((r) => Object.values(steps).some((s) => s.boxes.some((b) => b.region === r.id))),
  code,
  steps,
})

const f = (name: string, value?: string, kind?: Field['kind'], ref?: string): Field => ({ name, value, kind, ref })

// ---- The fat interface ----
const fat = (over: { first?: string; others?: string; rename?: 'changed' | 'bad' } = {}): Box => ({
  id: 'fat',
  region: 'ifaces',
  title: 'IUserService',
  sub: '25 methods',
  fields: [
    f('GetActiveUsers', over.first),
    f('CreateUser', over.others),
    f('Rename', over.rename ? 'changed' : over.others, over.rename === 'bad' ? 'bad' : undefined),
    f('… 22 more', over.others),
  ],
})
const job = (ref: string, kind?: Box['kind'], sub?: string, refKind?: Field['kind']): Box => ({
  id: 'job',
  region: 'callers',
  title: 'ReportJob',
  sub: sub ?? 'nightly',
  kind,
  fields: [f('users', undefined, refKind, ref), f('calls', 'GetActiveUsers')],
})
/** change: what a signature change in an unrelated method means for the test double, when the step is about that. */
const tests = (ref: string, setup: string, kind?: Field['kind'], name = 'mock', change: [string, Field['kind']?] | null = null): Box => ({
  id: 'tests',
  region: 'callers',
  title: 'JobTests',
  fields: [f(name, undefined, undefined, ref), f('setup', setup, kind), ...(change ? [f('on change', change[0], change[1])] : [])],
})

// ---- Role interfaces ----
const query: Box = { id: 'query', region: 'ifaces', title: 'IActiveUserQuery', sub: '1 method', fields: [f('GetActiveUsers')] }
const admin = (rename?: Field['kind']): Box => ({
  id: 'admin',
  region: 'ifaces',
  title: 'IUserAdmin, …',
  sub: 'the other roles',
  fields: [f('CreateUser'), f('Rename', rename ? 'changed' : undefined, rename), f('… 22 more')],
})
const service: Box = { id: 'svc', region: 'classes', title: 'UserService', fields: [f('implements', undefined, undefined, 'query'), f('and', 'IUserAdmin, …')] }

const ROLE_CODE = [
  'interface IActiveUserQuery { Task<IReadOnlyList<User>> GetActiveUsers(); }',
  'interface IUserAdmin { Task CreateUser(…); Task Rename(…); /* … */ }',
  '',
  'class UserService : IActiveUserQuery, IUserAdmin /* , … */ { … }',
  '',
  'class ReportJob(IActiveUserQuery users) { … }',
  '',
  '// a fake for the test: one method',
  'class FakeActiveUsers : IActiveUserQuery { … }',
]

// ---- The concrete class and what it needs ----
const svcFull = (kind?: Box['kind']): Box => ({
  id: 'svc',
  region: 'classes',
  title: 'UserService',
  sub: '25 public methods',
  kind,
  fields: [f('db', 'AppDbContext'), f('mail', 'IEmailSender'), f('clock', 'TimeProvider')],
})

const SPECS: Record<string, GraphSpec> = {
  setup: graph({
    fat: { boxes: [job('fat'), fat()] },
    mock: { boxes: [job('fat'), tests('fat', 'whole interface'), fat()] },
    'fake-edit': { boxes: [job('fat'), tests('fat', 'whole interface', undefined, 'mock', ['edit the fake']), fat({ rename: 'changed' })] },
  }),

  roles: graph(
    {
      extract: { boxes: [query, admin()], line: [0, 1] },
      implements: { boxes: [query, admin(), service], line: 3 },
      depends: { boxes: [job('query', 'ok', undefined, 'ok'), query, admin(), service], line: 5 },
      test: { boxes: [job('query', 'ok', undefined, 'ok'), tests('query', '1 method', 'ok', 'fake'), query, admin(), service], line: [7, 8] },
      change: { boxes: [job('query', 'ok', undefined, 'ok'), tests('query', '1 method', 'ok', 'fake', ['no edit', 'ok']), query, admin('bad'), service], line: 1 },
    },
    ROLE_CODE,
  ),

  'loose-claim': graph({
    mock: { boxes: [job('fat'), tests('fat', 'GetActiveUsers only', undefined, 'loose mock'), fat({ first: 'configured' })] },
    defaults: { boxes: [job('fat'), tests('fat', 'GetActiveUsers only', undefined, 'loose mock'), fat({ first: 'configured', others: 'default' })] },
  }),
  'loose-reality': graph({
    mock: { boxes: [job('fat'), tests('fat', 'GetActiveUsers only', 'ok', 'loose mock'), fat({ first: 'configured' })] },
    depends: { boxes: [job('fat', 'bad', 'needs all 25', 'bad'), tests('fat', 'GetActiveUsers only', 'ok', 'loose mock'), fat({ first: 'configured' })] },
    fakes: {
      boxes: [job('fat', 'bad', 'needs all 25', 'bad'), tests('fat', 'GetActiveUsers only', 'ok', 'loose mock', ['fakes break', 'bad']), fat({ first: 'configured', rename: 'bad' })],
    },
  }),

  'default-claim': graph({
    defaults: { boxes: [job('fat'), fat({ others: 'default body' })] },
    double: { boxes: [job('fat'), tests('fat', 'GetActiveUsers only', undefined, 'double'), fat({ others: 'default body' })] },
  }),
  'default-reality': graph({
    double: { boxes: [job('fat'), tests('fat', 'GetActiveUsers only', 'ok', 'double'), fat({ others: 'default body' })] },
    forget: {
      boxes: [
        job('fat'),
        tests('fat', 'GetActiveUsers only', 'ok', 'double'),
        fat({ others: 'default body' }),
        { id: 'svc', region: 'classes', title: 'UserService', kind: 'bad', fields: [f('implements', undefined, undefined, 'fat'), f('Rename', 'missing: default runs', 'bad')] },
      ],
    },
    depends: {
      boxes: [
        job('fat', 'bad', 'needs all 25', 'bad'),
        tests('fat', 'GetActiveUsers only', 'ok', 'double'),
        fat({ others: 'default body' }),
        { id: 'svc', region: 'classes', title: 'UserService', kind: 'bad', fields: [f('implements', undefined, undefined, 'fat'), f('Rename', 'missing: default runs', 'bad')] },
      ],
    },
  }),

  'concrete-claim': graph({
    inject: { boxes: [job('svc'), { id: 'svc', region: 'classes', title: 'UserService', sub: 'class' }] },
    test: { boxes: [job('svc'), tests('svc', 'in-memory database', undefined, 'new'), { id: 'svc', region: 'classes', title: 'UserService', sub: 'class' }] },
  }),
  'concrete-reality': graph({
    deps: { boxes: [job('svc', 'bad', undefined, 'bad'), svcFull('bad')] },
    test: { boxes: [job('svc', 'bad', undefined, 'bad'), tests('svc', 'db + mail + clock', 'bad', 'new'), svcFull('bad')] },
    wide: { boxes: [job('svc', 'bad', 'uses 1 of 25', 'bad'), tests('svc', 'db + mail + clock', 'bad', 'new'), svcFull('bad')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
