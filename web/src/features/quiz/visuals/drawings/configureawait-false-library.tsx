import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { LaneStage, type Block, type Kind, type Lane, type LaneSpec } from '../LaneStage'

const code = (configure: string, caller: string) => [
  'public async Task<int> LoadAsync(Stream stream)',
  '{',
  '    var buffer = new byte[4096];',
  `    int n = await stream.ReadAsync(buffer)${configure};`,
  '    return Parse(buffer, n);',
  '}',
  '',
  caller,
]
const AWAIT = 3
const RETURN = 4
const CALLER = 7
const CAF = '.ConfigureAwait(false)'
const UI_AWAITS = 'async void OnClick(...) => count = await Library.LoadAsync(file);'
const UI_BLOCKS = 'void OnClick(...) => count = Library.LoadAsync(file).Result;'
const UI_TRY = 'try { count = await Library.LoadAsync(file); } catch (IOException) { ... }'
const ACTION_BLOCKS = 'public int Get() => Library.LoadAsync(file).Result; // ASP.NET Core action'

const b = (lane: Lane, kind: Kind, label: string, hop?: string): Block => ({ lane, kind, label, hop })

const blockingStart = {
  'caller-calls': { blocks: [b('ui', 'run', 'OnClick() calls LoadAsync(file)')], line: CALLER },
  'runs-to-await': { blocks: [b('ui', 'run', 'LoadAsync runs up to the await')], line: AWAIT },
  'caller-blocks': { blocks: [b('io', 'wait', 'ReadAsync pending, no thread used'), b('ui', 'block', '.Result blocks the UI thread')], line: CALLER },
  'read-completes': { blocks: [b('io', 'ok', 'Read completes')], line: RETURN },
}

const SPECS: Record<string, LaneSpec> = {
  setup: {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_AWAITS),
    steps: {
      'caller-calls': { blocks: [b('ui', 'run', 'OnClick() calls LoadAsync(file)')], line: CALLER },
      'runs-to-await': { blocks: [b('ui', 'run', 'LoadAsync runs up to the await')], line: AWAIT },
      'read-pending': { blocks: [b('io', 'wait', 'ReadAsync pending')], line: AWAIT },
      'where-next': { blocks: [b('ui', 'q', '?'), b('pool', 'q', '?')], line: RETURN },
    },
  },
  'default-await': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code('', UI_BLOCKS),
    steps: {
      ...blockingStart,
      'posted-back': { blocks: [b('ui', 'dead', 'Continuation queued for the UI thread', '↪ back to the captured context')], line: RETURN },
      deadlock: { blocks: [b('ui', 'dead', 'Deadlock: each waits for the other')], line: RETURN },
    },
  },
  'configure-await-false': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_BLOCKS),
    steps: {
      ...blockingStart,
      'runs-on-pool': { blocks: [b('pool', 'run', 'return Parse(buffer, n)', '↪ no hop back')], line: RETURN },
      'result-returns': { blocks: [b('ui', 'ok', '.Result returns, UI continues')], line: CALLER },
    },
  },
  'thread-pool-claim': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_AWAITS),
    steps: {
      'caller-calls': { blocks: [b('ui', 'run', 'OnClick() calls LoadAsync(file)')], line: CALLER },
      'moved-to-pool': { blocks: [b('pool', 'run', 'ReadAsync starts on a pool thread', '↪ forced off the caller')], line: AWAIT },
      'pool-waits': { blocks: [b('pool', 'block', 'Pool thread waits for the disk')], line: AWAIT },
    },
  },
  'thread-pool-reality': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_AWAITS),
    steps: {
      'caller-calls': { blocks: [b('ui', 'run', 'OnClick() calls LoadAsync(file)')], line: CALLER },
      'starts-on-caller': { blocks: [b('ui', 'run', 'ReadAsync starts on the calling thread')], line: AWAIT },
      'pending-no-thread': { blocks: [b('io', 'wait', 'Pending, no thread held')], line: AWAIT },
      'continuation-moves': { blocks: [b('pool', 'run', 'Only the continuation runs here', '↪ the only thing that moves')], line: RETURN },
    },
  },
  'exceptions-claim': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_TRY),
    steps: {
      'caller-awaits': { blocks: [b('ui', 'run', 'Caller awaits inside try')], line: CALLER },
      'read-throws': { blocks: [b('io', 'dead', 'ReadAsync throws IOException')], line: AWAIT },
      swallowed: { blocks: [b('pool', 'run', 'Exception swallowed, carries on')], line: RETURN },
      'catch-skipped': { blocks: [b('ui', 'run', 'catch never runs')], line: CALLER },
    },
  },
  'exceptions-reality': {
    lanes: ['ui', 'pool', 'io'], context: true, code: code(CAF, UI_TRY),
    steps: {
      'caller-awaits': { blocks: [b('ui', 'run', 'Caller awaits inside try')], line: CALLER },
      'read-throws': { blocks: [b('io', 'dead', 'ReadAsync throws IOException')], line: AWAIT },
      rethrown: { blocks: [b('pool', 'dead', 'Rethrown at the await', '↪ resumes on the pool, still throws')], line: AWAIT },
      'catch-runs': { blocks: [b('ui', 'ok', 'catch (IOException) runs')], line: CALLER },
    },
  },
  'aspnet-core-claim': {
    lanes: ['req', 'pool', 'io'], context: true, code: code('', ACTION_BLOCKS),
    steps: {
      'action-calls': { blocks: [b('req', 'run', 'Action calls LoadAsync')], line: CALLER },
      'action-blocks': { blocks: [b('io', 'wait', 'ReadAsync pending'), b('req', 'block', '.Result blocks')], line: CALLER },
      deadlock: { blocks: [b('req', 'dead', 'Deadlock', '↪ back to the request context')], line: RETURN },
    },
  },
  'aspnet-core-reality': {
    lanes: ['req', 'pool', 'io'], context: false, code: code('', ACTION_BLOCKS),
    steps: {
      'action-calls': { blocks: [b('req', 'run', 'Action calls LoadAsync')], line: CALLER },
      'action-blocks': { blocks: [b('io', 'wait', 'ReadAsync pending'), b('req', 'block', '.Result blocks')], line: CALLER },
      'runs-on-pool': { blocks: [b('pool', 'run', 'Continuation runs here', '↪ no context to return to')], line: RETURN },
      'result-returns': { blocks: [b('req', 'ok', '.Result returns')], line: CALLER },
    },
  },
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, spec]) => [stage, (p: StageDrawingProps) => <LaneStage spec={spec} {...p} />]),
)
export default drawing
