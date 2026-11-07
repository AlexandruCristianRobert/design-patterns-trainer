import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const REG = [
  'services.AddMediatR(cfg =>',
  '{',
  '    cfg.RegisterServicesFromAssemblyContaining<Program>();',
  '    cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));',
  '    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));',
  '});',
]
/** The registration plus TransactionBehavior's body: what runs before and after next(). Only shown after answering. */
const BODY = [
  '',
  'class TransactionBehavior<TReq, TRes> : IPipelineBehavior<TReq, TRes>',
  '{',
  '    public async Task<TRes> Handle(TReq req, RequestHandlerDelegate<TRes> next, …)',
  '    {',
  '        await using var tx = await db.Database.BeginTransactionAsync();',
  '        var res = await next();',
  '        await tx.CommitAsync();',
  '        return res;',
  '    }',
  '}',
]
const CODE = [...REG, ...BODY]
const FIXED = [...REG.slice(0, 3), REG[4], REG[3], REG[5], ...BODY]
const L = { REG: [3, 4] as [number, number], TX: 3, VAL: 4, BEGIN: 11, NEXT: 12, COMMIT: 13 }
/** In the fixed registration, validation is line 3 and the transaction line 4. */
const F = { VAL: 3, TX: 4 }

const sender: SeqActor = { id: 'sender', name: 'Sender', sub: 'controller', tone: 'ui' }
const tx = (sub: string): SeqActor => ({ id: 'tx', name: 'Transaction', sub, tone: 'pool' })
const val = (sub: string): SeqActor => ({ id: 'val', name: 'Validation', sub, tone: 'pool' })
const handlerA: SeqActor = { id: 'handler', name: 'Handler', sub: 'the command', tone: 'ok' }
// Database work is drawn as notes on the transaction behaviour's lifeline: four columns stay readable at phone width.

const ASREG = [sender, tx('registered 1st'), val('registered 2nd'), handlerA]
const spec = (actors: SeqActor[], steps: Record<string, SeqStep>, code = CODE): SeqSpec => ({ actors, code, outputName: 'Result', steps })

const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const result = (response: string, txs: string, rk: OutLine['kind'] = 'plain', tk: OutLine['kind'] = 'plain'): OutLine[] => [
  { label: 'Response', text: response, kind: rk },
  { label: 'Transactions', text: txs, kind: tk },
]
const pending = result('…', 'none yet', 'muted', 'muted')

// ---- Reality, as registered: transaction outermost ----
const send = msg('send', 'sender', 'tx', 'invalid cmd')
const begin = note('begin', 'tx', 'BEGIN')
const next1 = msg('next1', 'tx', 'val', 'next()')
const invalid = note('invalid', 'val', 'invalid: throws', 'bad')
const never = note('never', 'handler', 'never runs', 'skip')
const back = msg('back', 'val', 'tx', 'exception', 'bad')
const rollback = note('rollback', 'tx', 'ROLLBACK, no work done', 'bad')
const out = msg('out', 'tx', 'sender', 'exception', 'bad')

const R = {
  send: { rows: [send], line: L.TX, output: pending },
  begin: { rows: [send, begin], line: L.BEGIN, output: result('…', '1 open', 'muted') },
  validate: { rows: [send, begin, next1, invalid, never], line: L.NEXT, output: result('…', '1 open', 'muted') },
  rollback: {
    rows: [send, begin, next1, invalid, never, back, rollback, out],
    line: L.NEXT,
    bad: true,
    output: result('ValidationException', '1 opened and rolled back, empty', 'plain', 'bad'),
  },
} satisfies Record<string, SeqStep>
const asRegistered = (steps: Record<string, SeqStep>) => spec(ASREG, steps)

// ---- Reality, fixed: validation outermost ----
const FIXED_ACTORS = [sender, val('registered 1st'), tx('registered 2nd'), handlerA]
const fSend = msg('send', 'sender', 'val', 'invalid cmd')
const fInvalid = note('invalid', 'val', 'invalid: throws', 'bad')
const fOut = msg('out', 'val', 'sender', 'exception', 'bad')
const fNever = note('never', 'tx', 'never runs', 'skip')
const fixedRows = [fSend, fInvalid, fOut, fNever]
const validRows = [
  msg('v-send', 'sender', 'val', 'valid cmd'),
  msg('v-next', 'val', 'tx', 'next()', 'ok'),
  note('v-begin', 'tx', 'BEGIN', 'ok'),
  msg('v-handle', 'tx', 'handler', 'next()', 'ok'),
  note('v-commit', 'tx', 'COMMIT', 'ok'),
]

// ---- The Setup: the behaviours as one box, their order unknown ----
const SETUP_ACTORS: SeqActor[] = [sender, { id: 'pipe', name: 'Behaviours', sub: 'Transaction and Validation', tone: 'pool' }, handlerA]
const regNotes = [note('reg-1', 'pipe', 'registered 1st: TransactionBehavior'), note('reg-2', 'pipe', 'registered 2nd: ValidationBehavior')]

// ---- Claim C rows ----
const caught = note('caught', 'val', 'catches its own exception')
const returns = msg('returns', 'val', 'tx', 'returns a response')

const SPECS: Record<string, SeqSpec> = {
  setup: spec(
    SETUP_ACTORS,
    {
      register: { rows: regNotes, line: L.REG },
      send: { rows: [...regNotes, msg('send', 'sender', 'pipe', 'invalid cmd')], line: L.REG, output: pending },
      result: {
        rows: [
          ...regNotes,
          msg('send', 'sender', 'pipe', 'invalid cmd'),
          note('order', 'pipe', '?', 'muted'),
          note('handler', 'handler', '?', 'muted'),
          note('db', 'pipe', 'a transaction: BEGIN … ROLLBACK, no work done'),
          msg('out', 'pipe', 'sender', 'rejected'),
        ],
        line: L.REG,
        output: result('rejected (correct)', 'opened and rolled back, empty', 'plain', 'bad'),
      },
    },
    REG,
  ),
  'transaction-first': asRegistered({ send: R.send, begin: R.begin, validate: R.validate, rollback: R.rollback }),
  'validation-first': spec(
    FIXED_ACTORS,
    {
      send: { rows: [fSend], line: F.VAL, output: pending },
      validate: { rows: [fSend, fInvalid], line: F.VAL, output: pending },
      reject: { rows: fixedRows, line: F.VAL, output: result('ValidationException', 'none', 'plain', 'ok') },
      valid: {
        rows: [...fixedRows, ...validRows],
        line: L.NEXT,
        output: result('valid command: its result', '1, around the valid command only', 'plain', 'ok'),
      },
    },
    FIXED,
  ),

  'reverse-order-claim': spec(
    [sender, val('registered 2nd, runs 1st'), tx('registered 1st, runs 2nd'), handlerA],
    {
      send: { rows: [fSend], line: L.VAL },
      reject: { rows: [fSend, fInvalid, fOut], line: L.VAL, output: result('ValidationException', 'none') },
      leak: {
        rows: [fSend, fInvalid, fOut, note('leak', 'tx', 'must be leaking transactions')],
        line: L.TX,
        output: result('ValidationException', 'empty ones come from a leak'),
      },
    },
    REG,
  ),
  'reverse-order-reality': asRegistered({ send: R.send, begin: R.begin, validate: R.validate, rollback: R.rollback }),

  'catch-claim': spec(
    ASREG,
    {
      send: { rows: [send, begin], line: L.TX },
      validate: { rows: [send, begin, next1, note('invalid', 'val', 'invalid')], line: L.VAL },
      catch: { rows: [send, begin, next1, note('invalid', 'val', 'invalid'), caught, returns], line: L.VAL },
      commit: {
        rows: [send, begin, next1, note('invalid', 'val', 'invalid'), caught, returns, note('commit', 'tx', 'COMMIT', 'ok')],
        line: L.TX,
        output: result('normal response', 'committed instead of rolled back', 'plain', 'ok'),
      },
    },
    REG,
  ),
  'catch-reality': asRegistered({
    send: { ...R.begin, line: L.BEGIN },
    validate: { rows: [send, begin, next1, note('invalid', 'val', 'invalid')], line: L.NEXT, output: result('…', '1 open', 'muted') },
    catch: {
      rows: [send, begin, next1, note('invalid', 'val', 'invalid'), caught, returns],
      line: L.NEXT,
      output: result('…', '1 open', 'muted', 'muted'),
    },
    commit: {
      rows: [
        send,
        begin,
        next1,
        note('invalid', 'val', 'invalid'),
        caught,
        returns,
        note('commit', 'tx', 'COMMIT, no work done', 'bad'),
        msg('out', 'tx', 'sender', 'some response, no error', 'bad'),
      ],
      line: L.COMMIT,
      output: result('looks like success: failure hidden', '1 opened and committed, empty', 'bad', 'bad'),
    },
  }),

  'after-handler-claim': spec(
    ASREG,
    {
      send: { rows: [msg('send', 'sender', 'handler', 'invalid cmd')], line: L.REG },
      handler: { rows: [msg('send', 'sender', 'handler', 'invalid cmd'), note('first', 'handler', 'runs first')], line: L.REG },
      after: {
        rows: [
          msg('send', 'sender', 'handler', 'invalid cmd'),
          note('first', 'handler', 'runs first'),
          msg('after', 'handler', 'tx', 'then the behaviours'),
          note('tx-after', 'tx', 'runs after the handler'),
          note('val-after', 'val', 'runs after the handler'),
        ],
        line: L.REG,
      },
      move: {
        rows: [
          msg('send', 'sender', 'handler', 'invalid cmd'),
          note('first', 'handler', 'runs first'),
          msg('after', 'handler', 'tx', 'then the behaviours'),
          note('tx-after', 'tx', 'runs after the handler'),
          note('val-after', 'val', 'runs after the handler'),
          note('move', 'handler', 'first line: validate'),
        ],
        line: L.VAL,
      },
    },
    REG,
  ),
  'after-handler-reality': asRegistered({ send: R.send, begin: R.begin, validate: R.validate, rollback: { ...R.rollback, line: L.REG, bad: false } }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
