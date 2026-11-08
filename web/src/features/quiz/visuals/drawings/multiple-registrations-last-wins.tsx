import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  'services.AddSingleton<INotifier, EmailNotifier>();',
  'services.AddSingleton<INotifier, SmsNotifier>();',
  '',
  'class Alerts(INotifier notifier);',
  'class Broadcast(IEnumerable<INotifier> all);',
]
const TRY = CODE.map((l, i) => (i === 1 ? 'services.TryAddSingleton<INotifier, SmsNotifier>();' : l))
const REPLACE = CODE.map((l, i) => (i === 1 ? 'services.Replace(ServiceDescriptor.Singleton<INotifier, SmsNotifier>());' : l))
const L = { EMAIL: 0, SMS: 1, ONE: 3, ALL: 4 }

const DESC: TableDef = { id: 'desc', name: 'Service descriptors', sub: 'in the service collection', tone: 'pool', columns: ['Service', 'Implementation'] }

type Look = [kind?: TRow['kind'], mark?: string, markKind?: TRow['markKind']]
const email = (look: Look = []): TRow => ({ key: 'email', cells: ['INotifier', 'EmailNotifier'], kind: look[0], mark: look[1], markKind: look[2] })
const sms = (look: Look = []): TRow => ({ key: 'sms', cells: ['INotifier', 'SmsNotifier'], kind: look[0], mark: look[1], markKind: look[2] })

const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })
type Got = [text: string, kind?: OutLine['kind']]
const got = (one: Got | null, all: Got | null): OutLine[] => [
  { label: 'Alerts gets', text: one ? one[0] : '?', kind: one ? one[1] : 'muted' },
  { label: 'Broadcast gets', text: all ? all[0] : '?', kind: all ? all[1] : 'muted' },
]
const BOTH = 'EmailNotifier, SmsNotifier'

const spec = (steps: Record<string, TableStep>): TableSpec => ({ tables: [DESC], code: CODE, outputName: 'Constructors', steps })

const TWO: TableStep = { tables: { desc: [email(['plain', 'kept', 'ok']), sms(['new', 'appended'])] }, line: L.SMS }
const SINGLE: TableStep = { tables: { desc: [email(), sms(['hit', 'last: resolved', 'ok'])] }, line: L.ONE, output: got(['SmsNotifier', 'ok'], null) }
const ALL: TableStep = { tables: { desc: [email(['hit', '1st', 'ok']), sms(['hit', '2nd', 'ok'])] }, line: L.ALL, output: got(['SmsNotifier', 'ok'], [BOTH, 'ok']) }

const REGISTERED: TableStep = { tables: { desc: [email(), sms()] }, line: [L.EMAIL, L.SMS] }

const SPECS: Record<string, TableSpec> = {
  setup: spec({
    register: { tables: {}, chips: [chip('e', 'first: EmailNotifier'), chip('s', 'later: SmsNotifier')], line: [L.EMAIL, L.SMS] },
    resolve: { tables: {}, chips: [chip('e', 'first: EmailNotifier'), chip('s', 'later: SmsNotifier')], line: [L.ONE, L.ALL], output: got(null, null) },
  }),

  descriptors: spec({
    first: { tables: { desc: [email(['new', 'appended'])] }, line: L.EMAIL },
    second: TWO,
    single: SINGLE,
    all: ALL,
  }),

  'first-claim': spec({
    register: REGISTERED,
    single: { tables: { desc: [email(['bad', 'first wins', 'bad']), sms()] }, line: L.ONE, output: got(['EmailNotifier', 'bad'], null) },
  }),
  'first-reality': spec({
    register: REGISTERED,
    single: SINGLE,
    tryadd: {
      tables: { desc: [email(['hit', 'resolved', 'ok']), sms(['skip', 'not added', 'muted'])] },
      code: TRY,
      line: L.SMS,
      output: got(['EmailNotifier'], null),
    },
  }),

  'replace-claim': spec({
    second: { tables: { desc: [email(['skip', 'replaced', 'bad']), sms(['new', 'appended'])] }, line: L.SMS },
    resolve: { tables: { desc: [email(['skip', 'replaced', 'bad']), sms(['hit'])] }, line: [L.ONE, L.ALL], output: got(['SmsNotifier'], ['SmsNotifier only', 'bad']) },
  }),
  'replace-reality': spec({
    second: TWO,
    resolve: { ...ALL, line: [L.ONE, L.ALL] },
    replace: {
      tables: { desc: [email(['skip', 'removed', 'muted']), sms(['hit', 'replacement'])] },
      code: REPLACE,
      line: L.SMS,
      output: got(['SmsNotifier'], ['SmsNotifier']),
    },
  }),

  'ambiguous-claim': spec({
    single: { tables: { desc: [email(['read']), sms(['read'])] }, line: L.ONE, bad: true, output: got(['ambiguity error', 'bad'], null) },
    all: { tables: { desc: [email(['read']), sms(['read'])] }, line: L.ALL, output: got(['ambiguity error', 'bad'], [BOTH]) },
  }),
  'ambiguous-reality': spec({
    single: SINGLE,
    all: ALL,
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
