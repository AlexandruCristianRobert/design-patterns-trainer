import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  'enum Status { Active, Suspended, Closed }',
  '',
  'string Label(Status s) => s switch',
  '{',
  '    Status.Active => "on",',
  '    Status.Suspended => "paused",',
  '};',
]
const L = { ENUM: 0, SWITCH: [2, 6] as [number, number], ACTIVE: 4, SUSPENDED: 5, END: 6 }
/** Simplified model of the lowered code: the hidden fallback arm written out. */
const HIDDEN_CODE = [...CODE.slice(0, 6), '    _ => throw new SwitchExpressionException(s),', '};']
const FIX_CODE = [...CODE.slice(0, 6), '    _ => "unknown",', '};']

const ARMS: TableDef = { id: 'arms', name: 'Label(s)', sub: 'arms', tone: 'ui', columns: ['s', 'arm'] }
const CFG: TableDef = { id: 'cfg', name: 'Label(Closed)', sub: 'per build', tone: 'io', columns: ['build', 'result'] }

const r = (key: string, cells: string[], kind?: TRow['kind'], mark?: string, markKind?: TRow['markKind']): TRow => ({ key, cells, kind, mark, markKind })
const ACTIVE = r('active', ['Active', '"on"'])
const SUSP = r('susp', ['Suspended', '"paused"'])
const CLOSED = r('closed', ['Closed', ''])
const HIDDEN = r('hidden', ['anything else', 'throw'], 'plain', 'hidden', 'muted')
const HIDDEN_NEW: TRow = { ...HIDDEN, kind: 'new' }
const chip = (key: string, label: string, kind?: TChip['kind']): TChip => ({ key, label, kind })
const WARN = chip('warn', 'warning CS8509', 'wait')
const BUILT = chip('built', 'build succeeds', 'ok')
const out = (call: string, text: string, kind?: OutLine['kind']): OutLine => ({ label: call, text, kind })
const THROWS = 'SwitchExpressionException'

const spec = (tables: TableDef[], steps: Record<string, TableStep>, code = CODE): TableSpec => ({ tables, code, outputName: 'Outcome', steps })

const SPECS: Record<string, TableSpec> = {
  // ---- Setup: the members and the written arms; Closed's arm is left empty, no build or run results ----
  setup: spec([ARMS], {
    enum: { tables: { arms: [r('active', ['Active', '']), r('susp', ['Suspended', '']), CLOSED] }, line: L.ENUM },
    arms: { tables: { arms: [ACTIVE, SUSP, CLOSED] }, line: [L.ACTIVE, L.SUSPENDED] },
    ask: { tables: { arms: [ACTIVE, SUSP, CLOSED] }, line: L.SWITCH },
  }),

  build: spec([ARMS], {
    warn: { tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'skip', 'not covered', 'bad')] }, chips: [WARN, BUILT], line: L.SWITCH },
    hidden: {
      tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'skip', 'not covered', 'bad'), HIDDEN_NEW] },
      chips: [WARN, BUILT],
      line: 6,
      code: HIDDEN_CODE,
    },
  }),
  run: spec(
    [ARMS],
    {
      active: { tables: { arms: [r('active', ['Active', '"on"'], 'hit'), SUSP, CLOSED, HIDDEN] }, line: L.ACTIVE, output: [out('Label(Active)', '"on"', 'ok')] },
      closed: {
        tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'skip'), r('hidden', ['anything else', 'throw'], 'bad', 'hidden', 'muted')] },
        line: 6,
        bad: true,
        output: [out('Label(Active)', '"on"', 'ok'), out('Label(Closed)', THROWS, 'bad')],
      },
      fix: {
        tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'plain', 'goes to _', 'muted'), r('hidden', ['_', '"unknown"'], 'hit')] },
        line: 6,
        code: FIX_CODE,
        output: [out('Label(Active)', '"on"', 'ok'), out('Label(Closed)', '"unknown"', 'ok'), out('Label((Status)42)', '"unknown"', 'ok')],
      },
    },
    HIDDEN_CODE,
  ),

  'error-claim': spec([ARMS], {
    rule: { tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'plain', 'arm needed')] }, line: L.SWITCH },
    build: { tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'plain', 'arm needed')] }, chips: [chip('err', 'compile error'), chip('built', 'no build')], line: L.SWITCH },
  }),
  'error-reality': spec([ARMS], {
    warn: { tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'skip', 'not covered', 'bad')] }, chips: [WARN, BUILT], line: L.SWITCH },
    setting: {
      tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'skip', 'not covered', 'bad')] },
      chips: [WARN, BUILT, chip('opt', 'error only if the project asks', 'run')],
      line: L.SWITCH,
    },
  }),

  'null-claim': spec([ARMS], {
    call: { tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'read', 'no arm')] }, line: L.SWITCH },
    nothing: { tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', 'null'], 'read', 'no arm')] }, line: L.SWITCH, output: [out('Label(Closed)', 'null')] },
  }),
  'null-reality': spec(
    [ARMS],
    {
      call: { tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'skip', 'no arm'), HIDDEN_NEW] }, line: L.SWITCH },
      throw: {
        tables: { arms: [ACTIVE, SUSP, r('closed', ['Closed', ''], 'skip', 'no arm'), r('hidden', ['anything else', 'throw'], 'bad', 'hidden', 'muted')] },
        line: 6,
        bad: true,
        output: [out('Label(Closed)', THROWS, 'bad')],
      },
    },
    HIDDEN_CODE,
  ),

  'config-claim': spec([CFG], {
    debug: { tables: { cfg: [r('debug', ['Debug', 'throws'])] }, line: L.SWITCH },
    release: { tables: { cfg: [r('debug', ['Debug', 'throws']), r('release', ['Release', 'null'])] }, line: L.SWITCH },
  }),
  'config-reality': spec([CFG], {
    debug: { tables: { cfg: [r('debug', ['Debug', 'throws'], 'bad')] }, line: L.SWITCH, output: [out('Debug', THROWS, 'bad')] },
    release: {
      tables: { cfg: [r('debug', ['Debug', 'throws'], 'bad'), r('release', ['Release', 'throws'], 'bad')] },
      line: L.SWITCH,
      output: [out('Debug', THROWS, 'bad'), out('Release', THROWS, 'bad')],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
