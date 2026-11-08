import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = ['var builder = WebApplication.CreateBuilder(args);', 'var cfg = builder.Configuration;', 'var cs = cfg.GetConnectionString("Default");']
const L = { BUILD: 0, READ: 2 }

const JSON_FILE = 'appsettings.json'
/** A zero-width space after the dot lets the name wrap there, not mid-word, on a phone. */
const ENV_FILE = 'appsettings.​Production.json'
/** Short values (Server=db1 …) keep the note column narrow. */
const V = { json: 'db1', file: 'db2', env: 'db3' }

/** The Setup lists the three places as the question does, with no order of providers. */
const PLACES: TableDef = { id: 'places', name: 'Where the key is set', sub: 'ConnectionStrings:Default (env var ConnectionStrings__Default), and its value', tone: 'io', columns: ['Source'] }
const PROVIDERS: TableDef = { id: 'prov', name: 'Configuration providers', sub: 'in the order they are added, and their value', tone: 'pool', columns: ['Provider'] }

const spec = (tables: TableDef[], steps: Record<string, TableStep>, outputName = 'App reads'): TableSpec => ({ tables, code: CODE, outputName, steps })

type Kind = TRow['kind']
type MarkKind = TRow['markKind']
/** Narrow tables: the value rides in the note column, ahead of the step's note. */
const withValue = (value: string, mark?: string) => (mark ? `${value}: ${mark}` : value)
const place = (key: 'json' | 'file' | 'env', source: string, kind?: Kind, mark?: string, markKind?: MarkKind): TRow => ({ key, cells: [source], kind, mark: withValue(V[key], mark), markKind })
const PLACE_ROWS = [place('json', JSON_FILE), place('file', ENV_FILE), place('env', 'environment variable')]

type ProvKey = 'json' | 'file' | 'secrets' | 'env' | 'args'
/** One row per default provider; kinds and marks per row for the step. */
const providers = (marks: Partial<Record<ProvKey, [Kind, string?, MarkKind?]>> = {}): TRow[] => {
  const row = (key: ProvKey, name: string, value: string, base: Kind = 'plain'): TRow => {
    const [kind, mark, markKind] = marks[key] ?? [base]
    return { key, cells: [name], kind, mark: withValue(value, mark), markKind }
  }
  return [
    row('json', JSON_FILE, V.json),
    row('file', ENV_FILE, V.file),
    row('secrets', 'user secrets', 'Dev only', 'muted'),
    row('env', 'env variables', V.env),
    row('args', 'command line', 'no args', 'muted'),
  ]
}
const prov = (marks: Parameters<typeof providers>[0], extra: Partial<TableStep> = {}): TableStep => ({ tables: { prov: providers(marks) }, line: L.BUILD, ...extra })
const reads = (value: string, kind?: OutLine['kind']): OutLine[] => [{ label: 'Default', text: `Server=${value}`, kind }]
const chip = (key: string, label: string, kind?: TChip['kind']): TChip => ({ key, label, kind })

const OVER: [Kind, string, MarkKind] = ['skip', 'overridden', 'muted']
const ENV_WINS = prov({ json: OVER, file: OVER, env: ['hit', 'wins, added last', 'ok'] }, { line: L.READ, output: reads(V.env, 'ok') })

const SAME_KEY = [place('json', JSON_FILE, 'read', 'same key'), place('file', ENV_FILE, 'read', 'same key'), place('env', 'environment variable', 'read', 'same key')]

const SPECS: Record<string, TableSpec> = {
  setup: spec([PLACES], {
    sources: { tables: { places: PLACE_ROWS }, line: null },
    run: { tables: { places: PLACE_ROWS }, chips: [chip('env', 'Environment: Production'), chip('args', 'no command-line arguments')], line: L.BUILD },
  }),

  layers: spec([PROVIDERS], {
    order: prov({}),
    json: prov({ json: ['hit', 'sets the key', 'ok'] }),
    'env-file': prov({ json: OVER, file: ['hit', 'overrides the first', 'ok'] }),
    'env-var': prov({ json: OVER, file: OVER, env: ['hit', '__ reads as :', 'ok'] }),
    result: ENV_WINS,
  }),

  'specific-claim': spec([PLACES], {
    specific: { tables: { places: [place('json', JSON_FILE), place('file', ENV_FILE, 'read', 'most specific'), place('env', 'environment variable')] }, line: L.BUILD },
    wins: {
      tables: { places: [place('json', JSON_FILE, 'muted'), place('file', ENV_FILE, 'read', 'overrides all others'), place('env', 'environment variable', 'muted')] },
      line: L.READ,
      output: reads(V.file),
    },
  }),
  'specific-reality': spec([PROVIDERS], {
    'over-json': prov({ json: OVER, file: ['hit', 'overrides the first only', 'ok'] }),
    'env-var': ENV_WINS,
  }),

  'first-claim': spec([PLACES], {
    first: { tables: { places: [place('json', JSON_FILE, 'read', 'first: wins'), place('file', ENV_FILE), place('env', 'environment variable')] }, line: L.BUILD },
    fill: {
      tables: { places: [place('json', JSON_FILE, 'read', 'first: wins'), place('file', ENV_FILE, 'muted', 'missing keys only'), place('env', 'environment variable', 'muted', 'missing keys only')] },
      line: L.READ,
      output: reads(V.json),
    },
  }),
  'first-reality': spec([PROVIDERS], {
    later: prov({ json: OVER, file: ['hit', 'overrides the first', 'ok'] }),
    result: ENV_WINS,
  }),

  'throws-claim': spec(
    [PLACES],
    {
      duplicate: { tables: { places: SAME_KEY }, line: L.BUILD },
      throws: { tables: { places: SAME_KEY }, line: L.BUILD, output: [{ label: 'Startup', text: 'exception: duplicate key' }] },
    },
    'Host',
  ),
  'throws-reality': spec([PROVIDERS], {
    layered: prov({ json: OVER, file: OVER, env: ['hit', 'last one wins', 'ok'] }, { chips: [chip('ok', 'host starts normally', 'ok')] }),
    result: { ...ENV_WINS, chips: [chip('ok', 'host starts normally', 'ok')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
