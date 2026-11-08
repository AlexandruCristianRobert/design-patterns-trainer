import { BoxGraph, type Box, type Field, type GraphSpec } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

type Team = 'sales' | 'billing' | 'support'
const TEAMS: Team[] = ['sales', 'billing', 'support']
const NAME: Record<Team, string> = { sales: 'Sales', billing: 'Billing', support: 'Support' }
const ACTIVE: Record<Team, string> = { sales: 'ordered this year', billing: 'pays a plan', support: 'open ticket' }
const USES: Record<Team, string> = { sales: '14 of 60', billing: '11 of 60', support: '9 of 60' }

const team = (t: Team, fields: Field[], kind?: Box['kind'], still?: boolean): Box => ({ id: t, region: 'teams', title: NAME[t], fields, kind, still })

// ---- Setup: three teams and the one shared class ----
const customer = (fields: Field[], still?: boolean): Box => ({ id: 'cust', region: 'code', title: 'Customer', sub: 'class', fields, still })
const usesRef = (): Field => ({ name: 'uses', value: 'Customer', ref: 'cust' })
const SETUP: GraphSpec = {
  regions: [
    { id: 'teams', name: 'Teams', tone: 'ui' },
    { id: 'code', name: 'Code', tone: 'pool' },
  ],
  steps: {
    shared: { boxes: [...TEAMS.map((t) => team(t, [usesRef()])), customer([{ name: 'properties', value: '60' }])] },
    subsets: {
      boxes: [
        ...TEAMS.map((t) => team(t, [usesRef(), { name: 'reads', value: USES[t] }, { name: '"active"', value: ACTIVE[t] }])),
        customer([{ name: 'properties', value: '60' }], true),
      ],
    },
    change: {
      boxes: [
        ...TEAMS.map((t) => team(t, [usesRef(), { name: 'reads', value: USES[t] }, { name: '"active"', value: ACTIVE[t] }], undefined, true)),
        customer([{ name: 'properties', value: '60' }, { name: 'a change', value: 'all 3 agree' }]),
      ],
    },
  },
}

// ---- Reality: one Customer per bounded context ----
const CTX_REGIONS: GraphSpec['regions'] = [
  { id: 'sales', name: 'Sales', sub: 'context', tone: 'ui' },
  { id: 'billing', name: 'Billing', sub: 'context', tone: 'pool' },
  { id: 'support', name: 'Support', sub: 'context', tone: 'io' },
]
const OWN: Record<Team, Field[]> = {
  sales: [{ name: 'Name', value: 'Ana' }, { name: 'LastOrder', value: 'May' }],
  billing: [{ name: 'Plan', value: 'Pro' }, { name: 'Balance', value: '0' }],
  support: [{ name: 'Tickets', value: '1 open' }],
}
const model = (t: Team, o: { id?: Field['kind']; extra?: Field[]; kind?: Box['kind']; still?: boolean } = {}): Box => ({
  id: `${t}-c`,
  region: t,
  title: 'Customer',
  sub: `${NAME[t]} model`,
  fields: [{ name: 'Id', value: 'C-42', kind: o.id }, ...OWN[t], { name: 'IsActive', value: ACTIVE[t] }, ...(o.extra ?? [])],
  kind: o.kind,
  still: o.still,
})
const EVENT: Box = {
  id: 'evt',
  region: 'sales',
  title: 'PlanChosen',
  sub: 'event (contract)',
  fields: [
    { name: 'CustomerId', value: 'C-42' },
    { name: 'Plan', value: 'Pro' },
    { name: 'to', value: 'Billing', ref: 'billing-c' },
  ],
}
const CONTEXTS: GraphSpec = {
  regions: CTX_REGIONS,
  steps: {
    split: { boxes: TEAMS.map((t) => model(t)) },
    link: { boxes: TEAMS.map((t) => model(t, { id: 'ok', still: true })) },
    translate: {
      boxes: [
        ...TEAMS.map((t) =>
          t === 'billing' ? model(t, { id: 'ok', extra: [{ name: 'from', value: 'PlanChosen', kind: 'ok' }] }) : model(t, { id: 'ok', still: true }),
        ),
        EVENT,
      ],
    },
  },
}
const DUNNING: Field = { name: 'Dunning', value: 'level 1', kind: 'ok' }
const CHANGE: GraphSpec = {
  regions: CTX_REGIONS,
  steps: {
    billing: { boxes: TEAMS.map((t) => (t === 'billing' ? model(t, { extra: [DUNNING], kind: 'ok' }) : model(t, { still: true }))) },
    alone: {
      boxes: TEAMS.map((t) =>
        t === 'billing' ? model(t, { extra: [DUNNING], kind: 'ok', still: true }) : model(t, { extra: [{ name: 'change', value: 'none', kind: 'ok' }] }),
      ),
    },
  },
}

// ---- Claim: a versioned NuGet package ----
const PKG_REGIONS: GraphSpec['regions'] = [
  { id: 'teams', name: 'Teams', tone: 'ui' },
  { id: 'pkg', name: 'Package', sub: 'NuGet', tone: 'pool' },
]
const version = (v: '1.0' | '2.0', fields: Field[], kind?: Box['kind'], still?: boolean): Box => ({ id: `v${v[0]}`, region: 'pkg', title: `Customer ${v}`, fields, kind, still })
const V_FIELDS: Field[] = [{ name: 'properties', value: '60' }, { name: 'IsActive', value: '1 property' }]
const on = (v: '1' | '2', kind?: Field['kind']): Field => ({ name: 'uses', value: `v${v}`, ref: `v${v}`, kind })
const PACKAGE_CLAIM: GraphSpec = {
  regions: PKG_REGIONS,
  steps: {
    publish: { boxes: [...TEAMS.map((t) => team(t, [on('1')])), version('1.0', [{ name: 'properties', value: '60' }])] },
    upgrade: {
      boxes: [
        team('sales', [on('2')]),
        team('billing', [on('1'), { name: 'upgrades', value: 'when ready' }]),
        team('support', [on('1'), { name: 'upgrades', value: 'when ready' }]),
        version('1.0', [{ name: 'properties', value: '60' }], undefined, true),
        version('2.0', [{ name: 'properties', value: '60' }]),
      ],
    },
  },
}
const PACKAGE_REALITY: GraphSpec = {
  regions: PKG_REGIONS,
  steps: {
    'one-model': {
      boxes: [
        team('sales', [on('2')], undefined, true),
        team('billing', [on('1')], undefined, true),
        team('support', [on('1')], undefined, true),
        version('1.0', [...V_FIELDS.slice(0, 1), { name: 'IsActive', value: '3 meanings', kind: 'bad' }], 'bad'),
        version('2.0', [...V_FIELDS.slice(0, 1), { name: 'IsActive', value: '3 meanings', kind: 'bad' }], 'bad'),
      ],
    },
    agree: {
      boxes: [
        team('sales', [on('2')], undefined, true),
        team('billing', [on('1'), { name: 'later', value: 'must take v2', kind: 'bad' }]),
        team('support', [on('1'), { name: 'later', value: 'must take v2', kind: 'bad' }]),
        version('1.0', [...V_FIELDS.slice(0, 1), { name: 'IsActive', value: '3 meanings', kind: 'bad' }], 'bad', true),
        version('2.0', [...V_FIELDS.slice(0, 1), { name: 'IsActive', value: '3 meanings', kind: 'bad' }, { name: 'design', value: 'all 3 agree', kind: 'bad' }], 'bad'),
      ],
    },
  },
}

// ---- Claim: a base class with three subclasses ----
const INH_REGIONS: GraphSpec['regions'] = [
  { id: 'sub', name: 'Subclasses', tone: 'ui' },
  { id: 'base', name: 'Base class', tone: 'pool' },
]
const baseBox = (fields: Field[], kind?: Box['kind'], still?: boolean): Box => ({ id: 'base', region: 'base', title: 'Customer', sub: 'base class', fields, kind, still })
const derived = (t: Team, kind?: Field['kind'], extra: Field[] = [], still?: boolean): Box => ({
  id: `d-${t}`,
  region: 'sub',
  title: `${NAME[t]}Customer`,
  fields: [{ name: 'extends', value: 'Customer', ref: 'base', kind }, ...extra],
  still,
})
const COMMON: Field[] = [{ name: 'properties', value: 'the common ones' }]
const BASE_CLAIM: GraphSpec = {
  regions: INH_REGIONS,
  steps: {
    base: { boxes: [baseBox(COMMON)] },
    derived: { boxes: [...TEAMS.map((t) => derived(t)), baseBox(COMMON, undefined, true)] },
  },
}
const BASE_REALITY: GraphSpec = {
  regions: INH_REGIONS,
  steps: {
    shared: { boxes: [...TEAMS.map((t) => derived(t, undefined, [], true)), baseBox([...COMMON, { name: 'owned by', value: 'all 3 teams', kind: 'bad' }], 'bad')] },
    change: {
      boxes: [
        ...TEAMS.map((t) => derived(t, 'bad', [{ name: 'affected', value: 'yes', kind: 'bad' }])),
        baseBox([...COMMON, { name: 'owned by', value: 'all 3 teams', kind: 'bad' }, { name: 'a change', value: 'all 3 agree', kind: 'bad' }], 'bad', true),
      ],
    },
  },
}

// ---- Claim: XML comments on the shared class ----
const DOC: Field = { name: '/// IsActive', value: 'Sales: …, Billing: …, Support: …' }
const docTeams = (o: { still?: boolean; bug?: boolean } = {}) =>
  TEAMS.map((t) => {
    if (o.bug && t === 'sales') return team(t, [{ name: 'sets', value: 'IsActive', ref: 'cust', kind: 'bad' }])
    if (o.bug && t === 'billing') return team(t, [{ name: 'reads', value: 'IsActive', ref: 'cust', kind: 'bad' }, { name: 'sees', value: 'Sales meaning', kind: 'bad' }])
    return team(t, [usesRef()], undefined, o.still)
  })
const DOCS_CLAIM: GraphSpec = {
  regions: SETUP.regions,
  steps: {
    keep: { boxes: [...docTeams(), customer([{ name: 'properties', value: '60' }])] },
    document: { boxes: [...docTeams({ still: true }), customer([{ name: 'properties', value: '60' }, DOC])] },
  },
}
const DOCS_REALITY: GraphSpec = {
  regions: SETUP.regions,
  steps: {
    'still-one': { boxes: [...docTeams({ bug: true }), customer([{ name: 'properties', value: '60' }, DOC, { name: 'IsActive', value: '1 property', kind: 'bad' }], true)] },
    'still-agree': {
      boxes: [
        ...docTeams({ bug: true }).map((b) => ({ ...b, still: true })),
        { ...customer([{ name: 'properties', value: '60' }, DOC, { name: 'IsActive', value: '1 property', kind: 'bad' }, { name: 'a change', value: 'all 3 agree', kind: 'bad' }]), kind: 'bad' as const },
      ],
    },
  },
}

const SPECS: Record<string, GraphSpec> = {
  setup: SETUP,
  contexts: CONTEXTS,
  change: CHANGE,
  'package-claim': PACKAGE_CLAIM,
  'package-reality': PACKAGE_REALITY,
  'base-claim': BASE_CLAIM,
  'base-reality': BASE_REALITY,
  'docs-claim': DOCS_CLAIM,
  'docs-reality': DOCS_REALITY,
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
