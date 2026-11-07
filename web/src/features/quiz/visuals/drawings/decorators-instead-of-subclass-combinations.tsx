import { BoxGraph, type Box, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type RowDef, type RowSpec, type RowStep } from '../RowStage'

// ---- The class hierarchy (the Setup, the subclass stage, the generator claim) ----
const BASE: RowDef = { id: 'base', name: 'Base class', tone: 'pool' }
const SUBS: RowDef = { id: 'subs', name: 'Subclasses', sub: 'one per combination', tone: 'ui' }
const GEN: RowDef = { id: 'subs', name: 'Subclasses', sub: 'emitted by a source generator', tone: 'ui' }
const NEXT: RowDef = { id: 'next', name: 'Next', sub: 'a new concern', tone: 'muted' }
const HAND: RowDef = { id: 'hand', name: 'Written by hand', tone: 'muted' }
const COUNT: RowDef = { id: 'count', name: 'Classes', tone: 'io' }

const cls = (label: string, kind: Chip['kind'] = 'item'): Chip => ({ key: label, label, kind })
/** A subclass name, with a break opportunity before its ProductRepository suffix (for narrow screens). */
const sub = (prefix: string) => cls(`${prefix}\u200bProductRepository`)
const TODAY = ['Caching', 'Logging', 'LoggingCaching'].map(sub)
const WITH_RETRY = ['Retry', 'RetryCaching', 'RetryLogging', 'RetryLoggingCaching'].map(sub)
const base = [cls('ProductRepository')]
const count = (label: string, kind: Chip['kind'] = 'run'): Chip[] => [{ key: 'count', label, kind }]

const tree = (steps: Record<string, RowStep>, subs = SUBS, extra: RowDef[] = []): RowSpec => ({ rows: [BASE, subs, ...extra, COUNT], steps })

// ---- Objects: decorators, flags, default interface methods ----
const DECOS: Region = { id: 'decos', name: 'Concerns', sub: 'one decorator each', tone: 'ui' }
const DATA: Region = { id: 'data', name: 'Data access', tone: 'pool' }
const ONE: Region = { id: 'one', name: 'The class', tone: 'pool' }
const IFACE: Region = { id: 'one', name: 'The interface', tone: 'ui' }
const IMPL: Region = { id: 'impl', name: 'Implementations', tone: 'pool' }

const DECO_CODE = [
  'interface IProductRepository',
  '    { Product? Get(int id); }',
  'class ProductRepository(AppDb db)',
  '    : IProductRepository { … }',
  'class CachingRepository(',
  '    IProductRepository inner)',
  '    : IProductRepository { … }',
  '// LoggingRepository, RetryRepository alike',
  '',
  'services.AddScoped<IProductRepository>(',
  '  sp => new LoggingRepository(',
  '    new CachingRepository(',
  '      new RetryRepository(',
  '        new ProductRepository(',
  '          sp.GetRequiredService<AppDb>())))));',
]
const DL = { CONTRACT: [0, 3] as [number, number], DECO: [4, 7] as [number, number], REG: [9, 14] as [number, number] }

const iface: Box = { id: 'iface', region: 'data', title: 'IProductRepository', sub: 'interface', fields: [{ name: 'Get', value: 'Product?' }] }
const repo: Box = { id: 'repo', region: 'data', title: 'ProductRepository', sub: ': IProductRepository', fields: [{ name: 'db', value: 'AppDb' }] }
const DECO_NAMES = { log: 'LoggingRepository', cache: 'CachingRepository', retry: 'RetryRepository' } as const
type Deco = keyof typeof DECO_NAMES
const NEXT_OF: Record<Deco, string> = { log: 'cache', cache: 'retry', retry: 'repo' }
const deco = (d: Deco, wired: boolean): Box => ({
  id: d,
  region: 'decos',
  title: DECO_NAMES[d],
  sub: ': IProductRepository',
  fields: [wired ? { name: 'inner', value: 'IProductRepository', ref: NEXT_OF[d] } : { name: 'inner', value: 'IProductRepository' }],
})
const decos = (wired: boolean) => (['log', 'cache', 'retry'] as Deco[]).map((d) => deco(d, wired))
const classes = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Classes', text, kind }]

const flagCode = (metrics: boolean) => [
  'class ProductRepository(AppDb db)',
  '{',
  '  public bool EnableCaching,',
  `    EnableLogging, EnableRetry${metrics ? ', EnableMetrics' : ''};`,
  '',
  '  public Product? Get(int id)',
  '  {',
  '    if (EnableLogging) …',
  ...(metrics ? ['    if (EnableMetrics) …'] : []),
  '    if (EnableCaching && …) return hit;',
  '    if (EnableRetry) … else …',
  '  }',
  '  public void Save(Product p)',
  '    { /* the same branches */ }',
  '}',
]
const FLAG_CODE = flagCode(false)
const FL = { FLAGS: [2, 3] as [number, number], METHODS: [5, 12] as [number, number], METRICS: { each: [[2, 3] as [number, number], 8] } }
const flagClass = (methods: string, kind?: 'bad', metrics = false): Box => ({
  id: 'repo',
  region: 'one',
  title: 'ProductRepository',
  fields: [
    { name: 'EnableCaching', value: 'bool' },
    { name: 'EnableLogging', value: 'bool' },
    { name: 'EnableRetry', value: 'bool' },
    ...(metrics ? [{ name: 'EnableMetrics', value: 'bool', kind: 'bad' as const }] : []),
    { name: 'Get', value: methods, kind },
    { name: 'Save', value: methods, kind },
  ],
})
const combos = (text: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Flag combinations to test', text, kind }]

const dimCode = (field: boolean, implGet: boolean) => [
  'interface IProductRepository',
  '{',
  ...(field ? ['  Dictionary<int, Product> cache = new();'] : []),
  '  Product? Load(int id);',
  '  Product? Get(int id)',
  '    { /* log, cache, retry, Load */ }',
  '}',
  'class ProductRepository',
  ...(implGet ? ['  : IProductRepository', '{ public Product? Get(int id) … }'] : ['  : IProductRepository { … }']),
]
const DIM_CLAIM = dimCode(false, false)
const DIM_STATE = dimCode(true, false)
const DIM_OVERRIDE = dimCode(false, true)
const dimIface = (cache: boolean): Box => ({
  id: 'iface',
  region: 'one',
  title: 'IProductRepository',
  fields: [
    ...(cache ? [{ name: 'cache', value: 'not allowed', kind: 'bad' as const }] : []),
    { name: 'Load', value: 'no body' },
    { name: 'Get', value: 'default body' },
  ],
})
const dimImpl = (get: string, kind?: 'bad'): Box => ({ id: 'impl', region: 'impl', title: 'ProductRepository', sub: ': IProductRepository', fields: [{ name: 'Get', value: get, kind }] })

const graph = (regions: Region[], code: string[], outputName: string | undefined, steps: Record<string, GraphStep>): GraphSpec => ({ regions, code, outputName, steps })

const ROWS: Record<string, RowSpec> = {
  setup: tree(
    {
      today: { rows: { base, subs: TODAY, next: [], count: count('4') } },
      retry: { rows: { base, subs: TODAY, next: [cls('Retry', 'wait')], count: count('4') } },
    },
    SUBS,
    [NEXT],
  ),
  hierarchy: tree({
    today: { rows: { base, subs: TODAY, count: count('4') } },
    retry: { rows: { base, subs: [...TODAY, ...WITH_RETRY], count: count('8, and 16 with the next concern', 'bad') } },
  }),
  'generate-claim': tree(
    {
      generate: { rows: { base, subs: [...TODAY, ...WITH_RETRY], hand: [], count: count('8') } },
      maintain: { rows: { base, subs: [...TODAY, ...WITH_RETRY], hand: [cls('none', 'ok')], count: count('8') } },
    },
    GEN,
    [HAND],
  ),
  'generate-reality': tree(
    {
      generate: { rows: { base, subs: [...TODAY, ...WITH_RETRY], count: count('8', 'bad') } },
      grow: { rows: { base, subs: [...TODAY, ...WITH_RETRY, cls('+ 8 more for the next concern', 'bad')], count: count('16', 'bad') } },
    },
    GEN,
  ),
}

const GRAPHS: Record<string, GraphSpec> = {
  decorators: graph([DECOS, DATA], DECO_CODE, 'Count', {
    contract: { boxes: [iface, repo], line: DL.CONTRACT },
    wrap: { boxes: [...decos(false), iface, repo], line: DL.DECO },
    compose: { boxes: [...decos(true), iface, repo], line: DL.REG },
    grow: {
      boxes: [...decos(true), iface, repo, { id: 'next', region: 'decos', title: 'MetricsRepository', sub: 'a new concern', kind: 'ok' }],
      line: DL.REG,
      output: classes('4 today, 1 more per new concern', 'ok'),
    },
  }),

  'flags-claim': graph([ONE], FLAG_CODE, 'Count', {
    flags: { boxes: [flagClass('…')], line: FL.FLAGS },
    branch: { boxes: [flagClass('branches on flags')], line: FL.METHODS, output: classes('1, no subclasses') },
  }),
  'flags-reality': graph([ONE], FLAG_CODE, 'Count', {
    flags: { boxes: [flagClass('…')], line: FL.FLAGS, output: classes('1, holding every concern') },
    branch: { boxes: [flagClass('3 concerns', 'bad')], line: FL.METHODS, output: [...classes('1, holding every concern'), ...combos('8', 'bad')] },
    next: { boxes: [flagClass('4 concerns', 'bad', true)], line: FL.METRICS, output: [...classes('1, edited again'), ...combos('16', 'bad')] },
  }),

  'dim-claim': graph([IFACE, IMPL], DIM_CLAIM, undefined, {
    move: { boxes: [dimIface(false)], line: [3, 4] },
    inherit: { boxes: [dimIface(false), dimImpl('inherited')], line: [6, 7] },
  }),
  'dim-reality': graph([IFACE, IMPL], DIM_STATE, 'Compiler', {
    state: { boxes: [dimIface(true)], line: 2, bad: true, output: [{ label: 'Build', text: 'error CS0525: Interfaces cannot contain instance fields', kind: 'bad' }] },
    override: { boxes: [dimIface(false), dimImpl('own body', 'bad')], line: [6, 8] },
  }),
}
/** Stages whose code changes from step to step: dim-reality shows the rejected cache field, then a class that implements Get itself; flags-reality adds the next flag. */
const STEP_CODE: Record<string, Record<string, string[]>> = {
  'dim-reality': { state: DIM_STATE, override: DIM_OVERRIDE },
  'flags-reality': { flags: FLAG_CODE, branch: FLAG_CODE, next: flagCode(true) },
}
const stepCode = (stage: string) => (p: StageDrawingProps) => <BoxGraph spec={{ ...GRAPHS[stage], code: STEP_CODE[stage][p.stepIds[p.stepIndex]] }} {...p} />

const drawing: QuestionDrawing = {
  ...Object.fromEntries(Object.entries(ROWS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />])),
  ...Object.fromEntries(Object.entries(GRAPHS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />])),
  ...Object.fromEntries(Object.keys(STEP_CODE).map((stage) => [stage, stepCode(stage)])),
}
export default drawing
