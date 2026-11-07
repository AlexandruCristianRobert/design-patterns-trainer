import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { SeqStage, type SeqActor, type SeqRow, type SeqSpec, type SeqStep } from '../SeqStage'

const CODE = [
  'var time = new FakeTimeProvider();',
  'var sender = new RetryingSender(failingOnceTransport, time);',
  '',
  'time.Advance(TimeSpan.FromSeconds(30));',
  'await sender.SendAsync(message);',
  '',
  '// in SendAsync, between attempts:',
  'await Task.Delay(TimeSpan.FromSeconds(30), _time);',
]
const FIX = [
  'var time = new FakeTimeProvider();',
  'var sender = new RetryingSender(failingOnceTransport, time);',
  '',
  'var send = sender.SendAsync(message);',
  'time.Advance(TimeSpan.FromSeconds(30));',
  'await send;',
  '',
  '// in SendAsync, between attempts:',
  'await Task.Delay(TimeSpan.FromSeconds(30), _time);',
]
const L = { NEW: [0, 1] as [number, number], ADVANCE: 3, SEND: 4, DELAY: 7 }
const F = { NEW: [0, 1] as [number, number], SEND: 3, ADVANCE: 4, AWAIT: 5, DELAY: 8 }

const actors: SeqActor[] = [
  { id: 'test', name: 'Test', sub: 'test thread', tone: 'ui' },
  { id: 'time', name: 'FakeTimeProvider', sub: 'fake clock', tone: 'io' },
  { id: 'sender', name: 'RetryingSender', tone: 'pool' },
]
const realActors: SeqActor[] = [...actors, { id: 'real', name: 'Real clock', sub: 'the claim', tone: 'bad' }]
const spec = (steps: Record<string, SeqStep>, code = CODE, a = actors): SeqSpec => ({ actors: a, code, outputName: 'Fake clock', steps })
const msg = (key: string, from: string, to: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from, to, label, kind })
const note = (key: string, at: string, label: string, kind?: SeqRow['kind']): SeqRow => ({ key, from: at, label, kind })
const clock = (now: string, timers: string, timerKind?: OutLine['kind']): OutLine[] => [
  { label: 'now', text: now, kind: now === '?' ? 'muted' : undefined },
  { label: 'timers', text: timers, kind: timers === '?' ? 'muted' : timerKind },
]

// The test as written.
const start = note('start', 'time', 'clock at T0')
const advance = msg('advance', 'test', 'time', 'Advance(30 s)')
const noneDue = note('due', 'time', 'now T0+30s, no timer due')
const send = msg('send', 'test', 'sender', 'SendAsync(message)')
const fails = note('fail', 'sender', 'attempt 1 fails', 'bad')
const delay = msg('delay', 'sender', 'time', 'Task.Delay: create timer (30 s)')
const late = note('timer', 'time', 'timer due at T0+60s', 'bad')
const stuck = note('stuck', 'test', 'await never completes', 'bad')
const RUN = [start, advance, noneDue, send, fails, delay, late]

// The fixed test.
const fSend = msg('send', 'test', 'sender', 'SendAsync(message), task kept')
const fDelay = msg('delay', 'sender', 'time', 'Task.Delay: create timer (30 s)')
const due30 = note('timer', 'time', 'timer due at T0+30s')
const fAdvance = msg('advance', 'test', 'time', 'Advance(30 s)')
const fires = msg('fires', 'time', 'sender', 'timer fires: delay completes', 'ok')
const retry = note('retry', 'sender', 'attempt 2 succeeds', 'ok')
const done = note('done', 'test', 'await send completes', 'ok')
const FIXED = [start, fSend, fails, fDelay, due30, fAdvance, fires]

const SPECS: Record<string, SeqSpec> = {
  setup: spec({
    arrange: { rows: [start], line: L.NEW, output: clock('T0', '?') },
    act: { rows: [start, advance, send, note('q', 'sender', '?', 'muted'), stuck], line: { each: [L.ADVANCE, L.SEND, L.DELAY] }, output: clock('?', '?') },
  }),

  'too-early': spec({
    create: { rows: [start], line: L.NEW, output: clock('T0', 'none') },
    advance: { rows: [start, advance, noneDue], line: L.ADVANCE, output: clock('T0+30s', 'none') },
    send: { rows: [start, advance, noneDue, send, fails], line: L.SEND, output: clock('T0+30s', 'none') },
    timer: { rows: RUN, line: L.DELAY, output: clock('T0+30s', 'delay, due T0+60s', 'bad') },
    stuck: { rows: [...RUN, stuck], line: L.SEND, bad: true, output: clock('T0+30s', 'delay, due T0+60s', 'bad') },
  }),
  fixed: spec(
    {
      start: { rows: [start, fSend, fails, fDelay, due30], line: { each: [F.SEND, F.DELAY] }, output: clock('T0', 'delay, due T0+30s') },
      advance: { rows: FIXED, line: F.ADVANCE, output: clock('T0+30s', 'none (fired)', 'ok') },
      await: { rows: [...FIXED, retry, done], line: F.AWAIT, output: clock('T0+30s', 'none (fired)', 'ok') },
    },
    FIX,
  ),

  'real-time-claim': spec(
    {
      delay: { rows: [start, advance, send, fails, msg('real', 'sender', 'real', 'real timer (30 s)', 'bad')], line: L.DELAY },
      wait: { rows: [start, advance, send, fails, msg('real', 'sender', 'real', 'real timer (30 s)', 'bad'), note('wait', 'real', 'waits 30 real seconds', 'bad')], line: L.DELAY },
    },
    CODE,
    realActors,
  ),
  'real-time-reality': spec(
    {
      delay: { rows: [start, advance, send, fails, delay, late], line: L.DELAY, output: clock('T0+30s', 'delay, due T0+60s', 'bad') },
      wait: { rows: [...RUN, note('real', 'real', 'not used'), stuck], line: L.SEND, bad: true, output: clock('T0+30s', 'delay, due T0+60s', 'bad') },
    },
    CODE,
    realActors,
  ),

  'fire-timers-claim': spec({
    advance: { rows: [start, advance, note('only', 'time', 'only GetUtcNow changes', 'bad')], line: L.ADVANCE },
    fire: {
      rows: [start, advance, note('only', 'time', 'only GetUtcNow changes', 'bad'), send, fails, delay, note('wait', 'time', 'waits for FireTimers()', 'bad'), stuck],
      line: L.DELAY,
    },
  }),
  'fire-timers-reality': spec(
    {
      advance: { rows: FIXED, line: F.ADVANCE, output: clock('T0+30s', 'none (fired)', 'ok') },
      fire: { rows: [...RUN, note('nofire', 'test', 'no FireTimers method', 'muted'), stuck], code: CODE, line: { each: [L.ADVANCE, L.SEND] }, bad: true, output: clock('T0+30s', 'delay, due T0+60s', 'bad') },
    },
    FIX,
  ),

  'thread-claim': spec(
    {
      thread: { rows: [note('made', 'test', 'creates the provider'), note('only', 'time', 'timers complete only on that thread', 'bad')], line: F.NEW[0] },
      async: { rows: [note('made', 'test', 'creates the provider'), note('only', 'time', 'timers complete only on that thread', 'bad'), note('no-async', 'test', 'unusable from async code', 'bad')], line: F.AWAIT },
    },
    FIX,
  ),
  'thread-reality': spec(
    {
      thread: { rows: [start, fSend, fails, fDelay, due30, fAdvance, note('on', 'time', 'fires on the thread calling Advance', 'ok')], line: F.ADVANCE, output: clock('T0+30s', 'none (fired)', 'ok') },
      async: { rows: [...FIXED, retry, done], line: F.AWAIT, output: clock('T0+30s', 'none (fired)', 'ok') },
    },
    FIX,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <SeqStage spec={s} {...p} />]),
)
export default drawing
