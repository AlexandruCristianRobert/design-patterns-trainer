import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CONSUMER_CODE = [
  'pact.UponReceiving("a request for customer 42")',
  '    .WithRequest(HttpMethod.Get, "/customers/42")',
  '    .WillRespond()',
  '    .WithStatus(HttpStatusCode.OK)',
  '    .WithJsonBody(new { id = 42, name = "Ada" });',
  '',
  'await pact.VerifyAsync(async ctx =>',
  '{',
  '    var client = new CustomersClient(ctx.MockServerUri);',
  '    var customer = await client.GetAsync(42);',
  '    Assert.Equal("Ada", customer.Name);',
  '});',
]
const PROVIDER_CODE = [
  '// in the Customers build, against the real service',
  'using var verifier = new PactVerifier("Customers", config);',
  'verifier.WithHttpEndpoint(serviceUri)',
  '        .WithPactBrokerSource(brokerUri)',
  '        .Verify();',
]

const ORDERS: SeqActor = { id: 'orders', name: 'Orders', sub: 'consumer', tone: 'ui' }
const CUSTOMERS: SeqActor = { id: 'customers', name: 'Customers', sub: 'provider', tone: 'io' }

const seq = (actors: SeqActor[], steps: Record<string, SeqStep>, code?: string[]): SeqSpec => ({ actors, code, outputName: 'Build', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind'], both = false): SeqRow => ({ key, from, to, label, kind, both })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })

// ---- Setup ----
const CALL = msg('call', 'orders', 'customers', 'GET /customers/42', undefined, true)
const NEXT = note('next', 'customers', 'next version')

// ---- Reality: the consumer side ----
const C_ACTORS: SeqActor[] = [
  { id: 'orders', name: 'Orders', sub: 'tests', tone: 'ui' },
  { id: 'mock', name: 'Mock', sub: 'from Pact', tone: 'pool' },
  { id: 'pact', name: 'Contract', sub: 'pact file', tone: 'io' },
]
const EXPECT = note('expect', 'orders', 'relies on: 200, id, name')
const MOCK = [msg('req', 'orders', 'mock', 'GET /customers/42'), msg('res', 'mock', 'orders', '200 {id, name}', 'ok')]
const WRITE = [msg('write', 'mock', 'pact', 'interaction'), note('file', 'pact', 'saved', 'ok')]

// ---- Reality: the provider side ----
const P_ACTORS: SeqActor[] = [
  { id: 'pact', name: 'Contract', sub: 'from Orders', tone: 'io' },
  { id: 'verifier', name: 'Verifier', sub: 'Customers build', tone: 'pool' },
  { id: 'api', name: 'Customers', sub: 'real API', tone: 'io' },
]
const REPLAY = [msg('load', 'pact', 'verifier', 'replay contract'), msg('req', 'verifier', 'api', 'GET /customers/42')]

// ---- Claim: a shared library ----
const LIB_ACTORS: SeqActor[] = [ORDERS, { id: 'lib', name: 'Shared lib', sub: 'C# interfaces', tone: 'pool' }, CUSTOMERS]
const REFS = [msg('r1', 'orders', 'lib', 'references'), msg('r2', 'customers', 'lib', 'references')]

// ---- Claim: a generated client ----
const OA_ACTORS: SeqActor[] = [ORDERS, { id: 'doc', name: 'OpenAPI', sub: 'document', tone: 'pool' }, CUSTOMERS]
const GEN = [msg('pub', 'customers', 'doc', 'publishes'), msg('gen', 'doc', 'orders', 'generated client')]

// ---- Claim: tests against production ----
const PROD_ACTORS: SeqActor[] = [
  { id: 'ci', name: 'Pipeline', sub: 'Customers', tone: 'pool' },
  { id: 'prod', name: 'Production', tone: 'io' },
  { id: 'suite', name: 'Test suite', sub: "Orders' calls", tone: 'ui' },
]
const DEPLOY = msg('deploy', 'ci', 'prod', 'deploy new version')
const RUN = msg('run', 'suite', 'prod', "Orders' calls", undefined, true)

const SPECS: Record<string, SeqSpec> = {
  setup: seq([ORDERS, CUSTOMERS], {
    call: { rows: [CALL] },
    change: { rows: [CALL, NEXT] },
    'no-e2e': { rows: [CALL, NEXT, msg('e2e', 'orders', 'customers', 'no end-to-end env', 'skip')] },
  }),

  consumer: seq(
    C_ACTORS,
    {
      expect: { rows: [EXPECT], line: [0, 4] },
      mock: { rows: [EXPECT, ...MOCK], line: [6, 11] },
      pact: { rows: [EXPECT, ...MOCK, ...WRITE], line: 6, output: [{ label: 'Orders', text: 'tests pass, contract written', kind: 'ok' }] },
    },
    CONSUMER_CODE,
  ),
  provider: seq(
    P_ACTORS,
    {
      replay: { rows: REPLAY, line: [1, 4] },
      pass: {
        rows: [...REPLAY, msg('res', 'api', 'verifier', '200 {id, name}', 'ok'), note('match', 'verifier', 'matches', 'ok')],
        line: 4,
        output: [{ label: 'Customers', text: 'verified, build passes', kind: 'ok' }],
      },
      break: {
        rows: [...REPLAY, msg('res', 'api', 'verifier', '200 {id, fullName}', 'bad'), note('match', 'verifier', 'no name', 'bad')],
        line: 4,
        bad: true,
        output: [{ label: 'Customers', text: 'verification failed, not deployed', kind: 'bad' }],
      },
    },
    PROVIDER_CODE,
  ),

  'shared-claim': seq(LIB_ACTORS, {
    ref: { rows: REFS },
    change: { rows: [...REFS, note('change', 'customers', 'API change'), note('err', 'orders', 'compile error')] },
  }),
  'shared-reality': seq(LIB_ACTORS, {
    ref: { rows: REFS },
    json: {
      rows: [...REFS, note('change', 'customers', 'JSON: fullName', 'bad'), note('lib', 'lib', 'unchanged'), note('err', 'orders', 'compiles'), msg('call', 'orders', 'customers', 'name is null', 'bad', true)],
    },
    coupled: {
      rows: [...REFS, note('change', 'customers', 'JSON: fullName', 'bad'), note('lib', 'lib', 'unchanged'), note('err', 'orders', 'compiles'), msg('call', 'orders', 'customers', 'name is null', 'bad', true), note('v2', 'lib', 'v2: redeploy both', 'bad')],
    },
  }),

  'openapi-claim': seq(OA_ACTORS, {
    gen: { rows: GEN },
    never: { rows: [...GEN, msg('call', 'orders', 'customers', 'only valid requests', undefined, true)] },
  }),
  'openapi-reality': seq(OA_ACTORS, {
    gen: { rows: GEN },
    remove: { rows: [...GEN, note('drop', 'customers', 'drops name'), msg('pub2', 'customers', 'doc', 'updated'), note('build', 'customers', 'build passes', 'bad')] },
    late: {
      rows: [
        ...GEN,
        note('drop', 'customers', 'drops name'),
        msg('pub2', 'customers', 'doc', 'updated'),
        note('build', 'customers', 'build passes', 'bad'),
        msg('call', 'orders', 'customers', 'name missing', 'bad', true),
      ],
    },
  }),

  'prod-claim': seq(PROD_ACTORS, {
    deploy: { rows: [DEPLOY] },
    run: { rows: [DEPLOY, RUN] },
    rollback: { rows: [DEPLOY, RUN, note('fail', 'suite', 'calls fail'), msg('back', 'ci', 'prod', 'roll back')] },
  }),
  'prod-reality': seq(PROD_ACTORS, {
    deploy: { rows: [DEPLOY, note('live', 'prod', 'live', 'bad')] },
    run: {
      rows: [DEPLOY, note('live', 'prod', 'live', 'bad'), note('users', 'prod', 'real calls fail', 'bad'), RUN, note('fail', 'suite', 'calls fail'), msg('back', 'ci', 'prod', 'roll back')],
    },
    contract: { rows: [note('verify', 'ci', 'contract check', 'ok'), msg('deploy', 'ci', 'prod', 'deploy only if it passes', 'ok')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
