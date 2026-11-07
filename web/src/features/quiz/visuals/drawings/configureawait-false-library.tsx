import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { LaneStage, type Block, type Kind, type Lane, type LaneSpec } from '../LaneStage'

const code = (configure: string, caller: string) => [
  'public async Task<int> LoadAsync(Stream stream)',
  '{',
  '    var buffer = new byte[4096];',
  ...(configure ? ['    int n = await stream.ReadAsync(buffer)', `        ${configure};`] : ['    int n = await stream.ReadAsync(buffer);']),
  '    return Parse(buffer, n);',
  '}',
  '',
  caller,
]
/** Highlighted lines (0-based; AWAIT is an inclusive range) — with a configure suffix the await statement spans two lines. */
const at = (configure: boolean) => {
  const shift = configure ? 1 : 0
  return { AWAIT: [3, 3 + shift] as [number, number], RETURN: 4 + shift, CALLER: 7 + shift }
}
const PLAIN = at(false)
const CONF = at(true)
const CAF = '.ConfigureAwait(false)'
const UI_AWAITS = 'OnClick() => count = await LoadAsync(stream);'
const UI_BLOCKS = 'OnClick() => count = LoadAsync(stream).Result;'
const UI_TRY = 'try { count = await LoadAsync(stream); } catch (IOException) { … }'
const ACTION_BLOCKS = 'int Get() => LoadAsync(stream).Result; // ASP.NET Core'

const b = (lane: Lane, kind: Kind, label: string, hop?: string): Block => ({ lane, kind, label, hop })

const blockingStart = (L: ReturnType<typeof at>) => ({
  'caller-calls': { blocks: [b('ui', 'run', 'OnClick() → LoadAsync')], line: L.CALLER },
  'runs-to-await': { blocks: [b('ui', 'run', 'LoadAsync runs up to the await')], line: L.AWAIT },
  'caller-blocks': { blocks: [b('io', 'wait', 'ReadAsync pending, no thread used'), b('ui', 'block', '.Result blocks the UI thread')], line: L.CALLER },
  'read-completes': { blocks: [b('io', 'ok', 'Read completes'), b('ui', 'block', 'Still blocked on .Result')], line: L.AWAIT },
})

const SPECS: Record<string, LaneSpec> = {
  setup: {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_AWAITS),
    steps: {
      'caller-calls': { blocks: [b('ui', 'run', 'OnClick() → LoadAsync')], line: CONF.CALLER },
      'read-started': { blocks: [b('io', 'wait', 'Read in progress')], line: CONF.AWAIT },
      'read-completes': { blocks: [b('io', 'ok', 'Read completes')], line: CONF.AWAIT },
    },
  },
  'default-await': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code('', UI_BLOCKS),
    steps: {
      ...blockingStart(PLAIN),
      'posted-back': { blocks: [b('ui', 'dead', 'Continuation queued for the UI thread', '↪ back to the captured context')], line: PLAIN.RETURN },
      deadlock: { blocks: [b('ui', 'dead', 'Deadlock: each waits for the other')], line: PLAIN.RETURN },
    },
  },
  'configure-await-false': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_BLOCKS),
    steps: {
      ...blockingStart(CONF),
      'runs-on-pool': { blocks: [b('pool', 'run', 'Parse runs here', '↪ no hop back')], line: CONF.RETURN },
      'result-returns': { blocks: [b('ui', 'ok', '.Result returns, UI continues')], line: CONF.CALLER },
    },
  },
  'thread-pool-claim': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_AWAITS),
    steps: {
      'caller-calls': { blocks: [b('ui', 'run', 'OnClick() → LoadAsync')], line: CONF.CALLER },
      'moved-to-pool': { blocks: [b('pool', 'run', 'ReadAsync starts on a pool thread', '↪ forced off the caller')], line: CONF.AWAIT },
    },
  },
  'thread-pool-reality': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_AWAITS),
    steps: {
      'caller-calls': { blocks: [b('ui', 'run', 'OnClick() → LoadAsync')], line: CONF.CALLER },
      'starts-on-caller': { blocks: [b('ui', 'run', 'ReadAsync starts on the calling thread')], line: CONF.AWAIT },
      'pending-no-thread': { blocks: [b('io', 'wait', 'Pending, no thread held')], line: CONF.AWAIT },
      'continuation-moves': { blocks: [b('pool', 'run', 'Only the continuation runs here', '↪ the only thing that moves')], line: CONF.RETURN },
    },
  },
  'exceptions-claim': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_TRY),
    steps: {
      'caller-awaits': { blocks: [b('ui', 'run', 'Caller awaits inside try')], line: CONF.CALLER },
      'read-throws': { blocks: [b('io', 'dead', 'ReadAsync throws IOException')], line: CONF.AWAIT },
      swallowed: { blocks: [b('pool', 'run', 'Carries on as if the read returned')], line: CONF.RETURN },
      'catch-skipped': { blocks: [b('ui', 'run', 'catch never runs')], line: CONF.CALLER },
    },
  },
  'exceptions-reality': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_TRY),
    steps: {
      'caller-awaits': { blocks: [b('ui', 'run', 'Caller awaits inside try')], line: CONF.CALLER },
      'read-throws': { blocks: [b('io', 'dead', 'ReadAsync throws IOException')], line: CONF.AWAIT },
      rethrown: { blocks: [b('pool', 'dead', 'Rethrown at the await', '↪ resumes on the pool, still throws')], line: CONF.AWAIT },
      'catch-runs': { blocks: [b('ui', 'ok', 'catch (IOException) runs')], line: CONF.CALLER },
    },
  },
  'aspnet-core-claim': {
    lanes: ['req', 'pool', 'io'], context: true, code: code('', ACTION_BLOCKS),
    steps: {
      'action-calls': { blocks: [b('req', 'run', 'Action calls LoadAsync')], line: PLAIN.CALLER },
      'action-blocks': { blocks: [b('io', 'wait', 'ReadAsync pending'), b('req', 'block', '.Result blocks')], line: PLAIN.CALLER },
      deadlock: { blocks: [b('req', 'dead', 'Deadlock', '↪ back to the request context')], line: PLAIN.RETURN },
    },
  },
  'aspnet-core-reality': {
    lanes: ['req', 'pool', 'io'], context: false, code: code('', ACTION_BLOCKS),
    steps: {
      'action-calls': { blocks: [b('req', 'run', 'Action calls LoadAsync')], line: PLAIN.CALLER },
      'action-blocks': { blocks: [b('io', 'wait', 'ReadAsync pending'), b('req', 'block', '.Result blocks')], line: PLAIN.CALLER },
      'runs-on-pool': { blocks: [b('pool', 'run', 'Continuation runs here', '↪ no context to return to')], line: PLAIN.RETURN },
      'result-returns': { blocks: [b('req', 'ok', '.Result returns')], line: PLAIN.CALLER },
    },
  },
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <LaneStage spec={spec} {...p} />]),
)
export default drawing
