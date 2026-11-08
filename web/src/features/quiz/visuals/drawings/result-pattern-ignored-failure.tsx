import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CLIENT: SeqActor = { id: 'client', name: 'Client', tone: 'muted' }
const CTRL: SeqActor = { id: 'ctrl', name: 'Controller', sub: 'the caller', tone: 'ui' }
const HANDLER: SeqActor = { id: 'h', name: 'Handler', tone: 'pool' }
const HEAP: SeqActor = { id: 'heap', name: 'Heap', tone: 'io' }
const ACTORS = [CLIENT, CTRL, HANDLER]

const THROW_CODE = [
  '// in the handler: if (stock < cmd.Qty) throw new OutOfStockException();',
  'await handler.Handle(cmd);',
  'await email.SendConfirmation(cmd.CustomerId);',
  'return Ok("Order placed");',
]
const RESULT_CODE = [
  '// in the handler: if (stock < cmd.Qty) return Result<Order>.Failure("out of stock");',
  'await handler.Handle(cmd);                     // the Result<Order> is discarded',
  'await email.SendConfirmation(cmd.CustomerId);',
  'return Ok("Order placed");',
]
const MATCH_CODE = [
  'var result = await handler.Handle(cmd);',
  'return result.Match(',
  '    order => Ok(order),',
  '    error => Conflict(error));   // the failure path must be written',
]
const C = { HANDLER: 0, CALL: 1, EMAIL: 2, OK: 3 }
const ASYNC_CODE = [
  'public async Task<Result<Order>> Handle(PlaceOrder cmd)',
  '{',
  '    if (!await stock.HasAsync(cmd.Sku, cmd.Qty)) return Result<Order>.Failure("out of stock");',
  '    return Result<Order>.Success(await orders.CreateAsync(cmd));',
  '}',
  '',
  '// caller',
  'Result<Order> result = await handler.Handle(cmd);',
]
const FINALLY_CODE = [
  'await gate.WaitAsync();',
  'try',
  '{',
  '    if (stock < cmd.Qty) return Result<Order>.Failure("out of stock");',
  '    return Result<Order>.Success(Create(cmd));',
  '}',
  'finally',
  '{',
  '    gate.Release();',
  '}',
]

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const spec = (steps: Record<string, SeqStep>, code: string[] | null, actors = ACTORS, outputName = 'Response'): SeqSpec => ({ actors, code: code ?? undefined, outputName, steps })
type K = OutLine['kind']
const out = (lines: [string, string, K?][]): OutLine[] => lines.map(([label, text, kind]) => ({ label, text, kind: text === '?' ? 'muted' : kind }))

const post = msg('post', 'client', 'ctrl', 'POST /orders')
const handle = msg('handle', 'ctrl', 'h', 'Handle(cmd)')
const low = note('low', 'h', 'stock too low')

// ---- Reality: throwing ----
const thrown = msg('throw', 'h', 'ctrl', 'throws (out of stock)', 'ok')
const skipped = note('skip', 'ctrl', 'email, "Order placed": skipped', 'skip')
const errResp = msg('err', 'ctrl', 'client', 'error response (middleware)', 'ok')
// ---- Reality: returning ----
const failure = msg('fail', 'h', 'ctrl', 'Result: Failure', 'plain')
const dropped = note('drop', 'ctrl', 'result never checked', 'bad')
const emailed = note('mail', 'ctrl', 'sends the confirmation', 'bad')
const okResp = msg('ok', 'ctrl', 'client', '200 "Order placed"', 'bad')

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    {
      before: { rows: [handle, low, note('t', 'h', 'today: throws an exception')] },
      after: {
        rows: [handle, low, note('t', 'h', 'today: throws an exception'), msg('handle2', 'ctrl', 'h', 'Handle(cmd)'), note('low2', 'h', 'stock too low'), note('r', 'h', 'new: returns a failure result')],
      },
    },
    null,
    [CTRL, HANDLER],
  ),
  exception: spec(
    {
      call: { rows: [post, handle, low], line: C.CALL, output: out([['Client gets', '?']]) },
      throw: { rows: [post, handle, low, thrown, skipped], line: C.HANDLER, output: out([['Client gets', '?']]) },
      response: { rows: [post, handle, low, thrown, skipped, errResp], line: C.CALL, output: out([['Client gets', 'an error response', 'ok'], ['Confirmation email', 'not sent', 'ok']]) },
    },
    THROW_CODE,
  ),
  result: spec(
    {
      call: { rows: [post, handle, low, failure], line: C.HANDLER, output: out([['Client gets', '?']]) },
      ignored: {
        rows: [post, handle, low, failure, dropped, emailed, okResp],
        line: { each: [C.CALL, C.EMAIL, C.OK] },
        bad: true,
        output: out([['Client gets', '200 "Order placed"', 'bad'], ['Confirmation email', 'sent', 'bad'], ['Compiler', 'no error', 'bad']]),
      },
      guard: {
        rows: [post, handle, low, failure, note('match', 'ctrl', 'Match: the failure path must be written', 'ok'), msg('conflict', 'ctrl', 'client', '409 Conflict', 'ok')],
        line: [1, 3],
        code: MATCH_CODE,
        output: out([['Client gets', '409 Conflict', 'ok'], ['Confirmation email', 'not sent', 'ok']]),
      },
    },
    RESULT_CODE,
  ),

  'perf-claim': spec(
    {
      alloc: { rows: [handle, msg('new', 'h', 'heap', 'new Result<Order> object'), msg('ret', 'h', 'ctrl', 'returns the wrapper')], output: out([['Per call', 'a heap allocation'], ['Faster', '?']]) },
      slower: {
        rows: [handle, msg('new', 'h', 'heap', 'new Result<Order> object'), msg('ret', 'h', 'ctrl', 'returns the wrapper'), note('cmp', 'ctrl', 'return Result: slower than throw')],
        output: out([['Per call', 'a heap allocation'], ['Faster', 'throwing']]),
      },
    },
    null,
    [CTRL, HANDLER, HEAP],
    'The claim',
  ),
  'perf-reality': spec(
    {
      struct: {
        rows: [handle, note('val', 'h', 'Result<Order> as a struct: returned by value', 'ok'), msg('noheap', 'h', 'heap', 'no allocation', 'skip'), msg('ret', 'h', 'ctrl', 'returns the value', 'ok')],
        output: out([['Return a result', 'a value copy, no allocation', 'ok'], ['Throw', '?']]),
      },
      throw: {
        rows: [
          handle,
          note('val', 'h', 'Result<Order> as a struct: returned by value', 'ok'),
          msg('noheap', 'h', 'heap', 'no allocation', 'skip'),
          msg('ret', 'h', 'ctrl', 'returns the value', 'ok'),
          msg('exobj', 'h', 'heap', 'throw: exception object + stack trace', 'bad'),
          note('unwind', 'ctrl', 'unwind frames, find a handler', 'bad'),
        ],
        output: out([['Return a result', 'a value copy, no allocation', 'ok'], ['Throw', 'far more work', 'bad']]),
      },
    },
    null,
    [CTRL, HANDLER, HEAP],
    'Cost',
  ),

  'async-claim': spec(
    {
      async: { rows: [note('a', 'h', 'async method returning Result<T>: not allowed')], output: out([['Async handlers', '?']]) },
      keep: {
        rows: [note('a', 'h', 'async method returning Result<T>: not allowed'), note('k', 'h', 'async handlers keep throwing')],
        output: out([['Async handlers', 'throw exceptions']]),
      },
    },
    null,
    [CTRL, HANDLER],
    'The claim',
  ),
  'async-reality': spec(
    {
      task: { rows: [note('sig', 'h', 'async Task<Result<Order>>: compiles', 'ok')], line: 0, output: out([['Async handlers', 'return results', 'ok']]) },
      await: {
        rows: [note('sig', 'h', 'async Task<Result<Order>>: compiles', 'ok'), handle, msg('fail', 'h', 'ctrl', 'Task completes: Result failure', 'ok'), note('aw', 'ctrl', 'await → Result<Order>', 'ok')],
        line: 7,
        output: out([['Async handlers', 'return results', 'ok'], ['Caller', 'checks it like a sync result', 'ok']]),
      },
    },
    ASYNC_CODE,
    [CTRL, HANDLER],
    'Outcome',
  ),

  'finally-claim': spec(
    {
      finally: { rows: [note('f', 'h', 'try/finally: not usable with results')], output: out([['Cleanup', '?']]) },
      dispose: { rows: [note('f', 'h', 'try/finally: not usable with results'), note('d', 'h', 'cleanup moves to Dispose')], output: out([['Cleanup', 'in Dispose methods']]) },
    },
    null,
    [CTRL, HANDLER],
    'The claim',
  ),
  'finally-reality': spec(
    {
      return: { rows: [handle, note('ret', 'h', 'return Failure (inside try)')], line: 3, output: out([['Lock', 'held'], ['Caller gets', '?']]) },
      finally: { rows: [handle, note('ret', 'h', 'return Failure (inside try)'), note('fin', 'h', 'finally: gate.Release()', 'ok')], line: 8, output: out([['Lock', 'released', 'ok'], ['Caller gets', '?']]) },
      caller: {
        rows: [handle, note('ret', 'h', 'return Failure (inside try)'), note('fin', 'h', 'finally: gate.Release()', 'ok'), msg('fail', 'h', 'ctrl', 'Result: Failure', 'ok')],
        line: 3,
        output: out([['Lock', 'released', 'ok'], ['Caller gets', 'the failure result', 'ok']]),
      },
    },
    FINALLY_CODE,
    [CTRL, HANDLER],
    'Outcome',
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
