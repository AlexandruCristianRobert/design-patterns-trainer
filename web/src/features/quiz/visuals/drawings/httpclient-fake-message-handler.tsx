import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CLIENT_CODE = [
  'public class ExchangeRateClient(HttpClient http)',
  '{',
  '    public async Task<decimal> GetRateAsync(string currency)',
  '    {',
  '        var response = await http.GetAsync($"rates/{currency}");',
  '        return decimal.Parse(await response.Content.ReadAsStringAsync());',
  '    }',
  '}',
]
const C = { CTOR: 0, GET: 4, PARSE: 5 }
const FAKE_CODE = [
  'class FakeHandler(HttpResponseMessage canned) : HttpMessageHandler',
  '{',
  '    public List<HttpRequestMessage> Requests { get; } = new();',
  '    protected override Task<HttpResponseMessage> SendAsync(',
  '        HttpRequestMessage request, CancellationToken ct)',
  '    { Requests.Add(request); return Task.FromResult(canned); }',
  '}',
  '',
  'var fake = new FakeHandler(new(HttpStatusCode.OK) { Content = new StringContent("0.94") });',
  'var http = new HttpClient(fake) { BaseAddress = new Uri("https://rates.test/") };',
  'var rate = await new ExchangeRateClient(http).GetRateAsync("EUR");',
  'Assert.Equal(0.94m, rate);',
  'Assert.Equal("/rates/EUR", fake.Requests[0].RequestUri!.AbsolutePath);',
]
const F = { HANDLER: [0, 6] as [number, number], FAKE: 8, HTTP: 9, CALL: 10, SEND: [3, 5] as [number, number], ASSERT: [11, 12] as [number, number] }
const MOCK_CODE = [
  'var mock = new Mock<HttpClient>();',
  'mock.Setup(h => h.GetAsync("rates/EUR"))',
  '    .ReturnsAsync(new HttpResponseMessage { Content = new StringContent("0.94") });',
  'var rate = await new ExchangeRateClient(mock.Object).GetRateAsync("EUR");',
]
const IFACE_CODE = [
  'var mock = new Mock<IHttpClient>();',
  'mock.Setup(h => h.GetAsync("rates/EUR")).ReturnsAsync(response);',
  'var rate = await new ExchangeRateClient(mock.Object).GetRateAsync("EUR");',
]
const ECHO_CODE = [
  '// HttpClient cannot be replaced, so call a real service:',
  'var http = new HttpClient { BaseAddress = new Uri("https://echo.example.org/") };',
  'var rate = await new ExchangeRateClient(http).GetRateAsync("EUR");',
]
const ECHO_REAL_CODE = [
  'public HttpClient(HttpMessageHandler handler); // the constructor for this',
  '',
  'var http = new HttpClient { BaseAddress = new Uri("https://echo.example.org/") };',
  'var rate = await new ExchangeRateClient(http).GetRateAsync("EUR");',
]

const TEST: SeqActor = { id: 'test', name: 'Test', tone: 'muted' }
const CLIENT: SeqActor = { id: 'client', name: 'RateClient', sub: 'under test', tone: 'ui' }
const HTTP: SeqActor = { id: 'http', name: 'HttpClient', tone: 'pool' }
const FAKE: SeqActor = { id: 'handler', name: 'Fake', sub: 'handler', tone: 'ok' }
const MOCK: SeqActor = { id: 'http', name: 'Mock', sub: 'of HttpClient', tone: 'pool' }
const IMOCK: SeqActor = { id: 'http', name: 'Mock', sub: 'of IHttpClient', tone: 'pool' }
const ECHO: SeqActor = { id: 'echo', name: 'Echo', sub: 'public service', tone: 'io' }

const row = (key: string, from: string, label: string, to?: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const out = (label: string, text: string, kind?: OutLine['kind']): OutLine[] => [{ label, text, kind }]
const seq = (actors: SeqActor[], code: string[], steps: Record<string, SeqStep>, outputName = 'Result'): SeqSpec => ({ actors, code, outputName, steps })

// ---- Setup ----
const needs = row('needs', 'client', 'needs HttpClient')
const get = row('get', 'client', 'GetAsync', 'http')

// ---- Reality ----
const canned = row('canned', 'handler', 'returns 200 "0.94"')
const built = [canned, row('ctor', 'test', 'new HttpClient(fake)', 'http'), row('inject', 'test', 'passes http', 'client')]
const sent = [...built, row('get', 'client', 'GetAsync', 'http'), row('send', 'http', 'SendAsync', 'handler')]
const answered = [...sent, row('resp', 'handler', '200 "0.94"', 'http', 'ok'), row('back', 'http', 'response', 'client', 'ok')]
const asserted = [...answered, row('rate', 'client', '0.94m', 'test', 'ok'), row('check', 'test', 'rate ✓ request ✓', undefined, 'ok')]

// ---- Claims ----
const mockSetup = row('setup', 'test', 'Setup(GetAsync)', 'http')
const echoGet = [get, row('req', 'http', 'GET /rates/EUR', 'echo')]

const SPECS: Record<string, SeqSpec> = {
  setup: seq([TEST, CLIENT, HTTP], CLIENT_CODE, {
    ctor: { rows: [needs], line: C.CTOR, output: out('Response', '?', 'muted') },
    call: { rows: [needs, get], line: C.GET, output: out('Response', '?', 'muted') },
    test: { rows: [needs, get, row('q', 'test', 'response: ?', undefined, 'muted')], line: C.PARSE, output: out('Response', '?', 'muted') },
  }),

  fake: seq([TEST, CLIENT, HTTP, FAKE], FAKE_CODE, {
    handler: { rows: [canned], line: F.HANDLER, output: out('Network', 'not used') },
    construct: { rows: built, line: [F.FAKE, F.CALL], output: out('Network', 'not used') },
    send: { rows: sent, line: F.SEND, output: out('Network', 'not used') },
    respond: { rows: answered, line: F.SEND, output: out('Network', 'not used', 'ok') },
    assert: { rows: asserted, line: F.ASSERT, output: out('Network', 'not used: the fake answered', 'ok') },
  }),

  'mock-claim': seq([TEST, CLIENT, MOCK], MOCK_CODE, {
    setup: { rows: [mockSetup], line: [1, 2], output: out('Response', 'prepared "0.94"') },
    call: { rows: [mockSetup, get, row('back', 'http', 'prepared "0.94"', 'client')], line: 3, output: out('Response', '"0.94" from the mock') },
  }),
  'mock-reality': seq([TEST, CLIENT, MOCK], MOCK_CODE, {
    setup: {
      rows: [row('setup', 'test', 'Setup(GetAsync)', 'http', 'bad'), row('throw', 'http', 'not virtual: throws', undefined, 'bad')],
      line: 1,
      bad: true,
      output: out('Test', 'fails in Setup', 'bad'),
    },
    virtual: {
      rows: [
        row('setup', 'test', 'Setup(GetAsync)', 'http', 'muted'),
        row('only', 'http', 'overrides SendAsync (virtual)', undefined, 'plain'),
        row('get', 'client', 'GetAsync skips it', 'http', 'bad'),
      ],
      line: 3,
      output: out('Test', 'no way to intercept GetAsync', 'bad'),
    },
    seam: {
      rows: [
        row('setup', 'test', 'Setup(GetAsync)', 'http', 'muted'),
        row('only', 'http', 'overrides SendAsync (virtual)', undefined, 'plain'),
        row('get', 'client', 'GetAsync skips it', 'http', 'bad'),
        row('seam', 'http', 'seam: the handler', undefined, 'ok'),
      ],
      line: null,
      output: out('Seam', 'HttpMessageHandler', 'ok'),
    },
  }),

  'interface-claim': seq([TEST, CLIENT, IMOCK], IFACE_CODE, {
    mock: { rows: [row('mock', 'test', 'Mock<IHttpClient>', 'http')], line: [0, 1], output: out('Response', 'prepared') },
    inject: {
      rows: [row('mock', 'test', 'Mock<IHttpClient>', 'http'), row('inject', 'test', 'injects mock', 'client'), row('get', 'client', 'GetAsync', 'http')],
      line: 2,
      output: out('Response', 'from the mock'),
    },
  }),
  'interface-reality': seq([TEST, CLIENT, IMOCK], IFACE_CODE, {
    mock: {
      rows: [row('mock', 'test', 'Mock<IHttpClient>', 'http', 'bad'), row('none', 'http', 'no such type', undefined, 'bad')],
      line: 0,
      bad: true,
      output: out('Build', 'error: IHttpClient not found', 'bad'),
    },
    inject: {
      rows: [row('mock', 'test', 'Mock<IHttpClient>', 'http', 'muted'), row('none', 'http', 'no such type', undefined, 'muted'), row('ctor', 'client', 'needs HttpClient', undefined, 'bad')],
      line: 2,
      bad: true,
      output: out('Build', 'still fails: the ctor needs an HttpClient', 'bad'),
    },
  }),

  'echo-claim': seq([TEST, CLIENT, HTTP, ECHO], ECHO_CODE, {
    fixed: { rows: [row('fixed', 'http', 'cannot be replaced')], line: 0, output: out('Server', '?', 'muted') },
    echo: { rows: [row('fixed', 'http', 'cannot be replaced'), ...echoGet], line: [1, 2], output: out('Server', 'a public echo service') },
  }),
  'echo-reality': seq([TEST, CLIENT, HTTP, ECHO], ECHO_REAL_CODE, {
    fixed: { rows: [row('fixed', 'http', 'has a handler ctor', undefined, 'ok')], line: 0, output: out('Test run', '?', 'muted') },
    echo: {
      rows: [row('fixed', 'http', 'has a handler ctor', undefined, 'ok'), ...echoGet, row('resp', 'echo', 'slow, or 503', 'http', 'bad')],
      line: [2, 3],
      bad: true,
      output: out('Test run', 'slow, and failing when the network is down', 'bad'),
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
