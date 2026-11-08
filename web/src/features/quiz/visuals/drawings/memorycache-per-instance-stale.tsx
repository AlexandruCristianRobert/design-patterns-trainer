import { BoxGraph, type Box, type Field, type GraphSpec } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

type Inst = 'a' | 'b' | 'c'
const INSTS: Inst[] = ['a', 'b', 'c']
const OLD = '10.00'
const NEW = '12.00'
const NUM: Record<Inst, string> = { a: '1', b: '2', c: '3' }

const REGIONS: GraphSpec['regions'] = [
  { id: 'in', name: 'Requests', tone: 'ui' },
  { id: 'inst', name: 'Instances', tone: 'pool' },
  { id: 'store', name: 'Storage', tone: 'io' },
]

/** One API instance; `cache` is its price entry (inline value) or a reference to a shared cache. */
const inst = (i: Inst, fields: Field[], o: { kind?: Box['kind']; still?: boolean } = {}): Box => ({
  id: i,
  region: 'inst',
  title: `Instance ${NUM[i]}`,
  fields,
  kind: o.kind,
  still: o.still,
})
const cache = (value: string, kind?: Field['kind']): Field => ({ name: 'cache p1', value, kind })
const db = (price: string, kind?: Field['kind'], still?: boolean): Box => ({ id: 'db', region: 'store', title: 'Database', fields: [{ name: 'p1', value: price, kind }], still })
const lb = (still?: boolean): Box => ({ id: 'lb', region: 'in', title: 'Load balancer', fields: [{ name: 'spreads', value: 'over 1, 2, 3' }], still })
const update = (fields: Field[], still?: boolean): Box => ({ id: 'upd', region: 'in', title: 'Update', sub: 'request', fields, still })
const UPD_FIELDS: Field[] = [
  { name: 'saves', value: NEW },
  { name: 'then', value: 'Remove(key)' },
]
const via = (kind?: Field['kind']): Field => ({ name: 'sent to', value: 'instance 2', ref: 'b', kind })

// ---- Setup: no instance is marked as the one that handled the update ----
const SETUP: GraphSpec = {
  regions: REGIONS,
  steps: {
    instances: { boxes: [lb(), ...INSTS.map((i) => inst(i, [cache(`${OLD}, 10 min`)])), db(OLD)] },
    update: { boxes: [lb(true), update(UPD_FIELDS), ...INSTS.map((i) => inst(i, [cache('?', 'muted')])), db(NEW)] },
    stale: {
      boxes: [lb(true), update([...UPD_FIELDS, { name: 'afterwards', value: `some get ${OLD}` }]), ...INSTS.map((i) => inst(i, [cache('?', 'muted')], { still: true })), db(NEW, undefined, true)],
    },
  },
}

// ---- Reality: per-process caches ----
const localInsts = (b: Field, ac: Field[], o: { acKind?: Box['kind']; still?: boolean } = {}) =>
  INSTS.map((i) => (i === 'b' ? inst(i, [b], { still: o.still }) : inst(i, ac, { kind: o.acKind })))
const LOCAL: GraphSpec = {
  regions: REGIONS,
  steps: {
    routed: { boxes: [update([via(), { name: 'saves', value: NEW }]), ...localInsts(cache(OLD), [cache(OLD)], {}).map((b) => ({ ...b, still: b.id !== 'b' })), db(NEW, 'ok')] },
    removed: {
      boxes: [update([via(), { name: 'saves', value: NEW }, { name: 'then', value: 'Remove(key)' }], true), ...localInsts(cache('removed', 'ok'), [cache(OLD, 'bad')]), db(NEW, 'ok', true)],
    },
    stale: {
      boxes: [
        update([via(), { name: 'saves', value: NEW }, { name: 'then', value: 'Remove(key)' }], true),
        ...localInsts({ name: 'cache p1', value: `${NEW} (from DB)`, kind: 'ok' }, [cache(OLD, 'bad'), { name: 'replies', value: `${OLD}, ≤ 10 min`, kind: 'bad' }], { acKind: 'bad' }),
        db(NEW, 'ok', true),
      ],
    },
  },
}

// ---- Reality: one shared distributed cache ----
const redis = (value: string, kind?: Field['kind'], still?: boolean): Box => ({ id: 'redis', region: 'store', title: 'Redis', sub: 'IDistributedCache', fields: [{ name: 'p1', value, kind }], still })
const toRedis = (extra: Field[] = []): Field[] => [{ name: 'cache', value: 'Redis', ref: 'redis' }, ...extra]
const SHARED: GraphSpec = {
  regions: REGIONS,
  steps: {
    'one-copy': { boxes: [...INSTS.map((i) => inst(i, toRedis())), redis(OLD), db(OLD)] },
    remove: {
      boxes: [update([via(), { name: 'saves', value: NEW }, { name: 'then', value: 'Remove(key)' }]), ...INSTS.map((i) => inst(i, toRedis(), { still: true })), redis('removed', 'ok'), db(NEW, 'ok')],
    },
    fresh: {
      boxes: [
        update([via(), { name: 'saves', value: NEW }, { name: 'then', value: 'Remove(key)' }], true),
        ...INSTS.map((i) => inst(i, toRedis([{ name: 'replies', value: NEW, kind: 'ok' }]))),
        redis(NEW, 'ok'),
        db(NEW, 'ok', true),
      ],
    },
  },
}

// ---- Claim: register IMemoryCache as a singleton (one process) ----
const PROC: GraphSpec['regions'] = [
  { id: 'ep', name: 'Endpoints', tone: 'ui' },
  { id: 'di', name: 'Services', tone: 'pool' },
]
const mc = (fields: Field[], still?: boolean): Box => ({ id: 'mc', region: 'di', title: 'IMemoryCache', fields, still })
const SINGLETON_CLAIM: GraphSpec = {
  regions: PROC,
  steps: {
    register: { boxes: [mc([{ name: 'lifetime', value: 'singleton' }])] },
    share: {
      boxes: [
        { id: 'upd-ep', region: 'ep', title: 'Update endpoint', fields: [{ name: 'uses', value: 'cache', ref: 'mc' }] },
        { id: 'read-ep', region: 'ep', title: 'Readers', fields: [{ name: 'use', value: 'cache', ref: 'mc' }] },
        mc([{ name: 'lifetime', value: 'singleton' }, { name: 'instances', value: '1' }]),
      ],
    },
  },
}
const SINGLETON_REALITY: GraphSpec = {
  regions: REGIONS,
  steps: {
    already: { boxes: [...INSTS.map((i) => inst(i, [{ name: 'IMemoryCache', value: 'singleton', kind: 'ok' }, cache(OLD)])), db(OLD)] },
    'per-process': {
      boxes: [
        update([via(), { name: 'saves', value: NEW }, { name: 'then', value: 'Remove(key)' }]),
        ...localInsts(cache('removed', 'ok'), [{ name: 'IMemoryCache', value: 'own singleton' }, cache(OLD, 'bad')], { acKind: 'bad' }).map((b) =>
          b.id === 'b' ? { ...b, fields: [{ name: 'IMemoryCache', value: 'own singleton' }, ...(b.fields ?? [])] } : b,
        ),
        db(NEW, 'ok'),
      ],
    },
  },
}

// ---- Claim: sticky sessions ----
const customer = (name: string, to: Inst, extra: Field[] = [], kind?: Box['kind'], still?: boolean): Box => ({
  id: `cust-${name}`,
  region: 'in',
  title: name,
  sub: 'customer',
  fields: [{ name: 'pinned to', value: `instance ${NUM[to]}`, ref: to }, ...extra],
  kind,
  still,
})
const stickyLb = (still?: boolean): Box => ({ id: 'lb', region: 'in', title: 'Load balancer', fields: [{ name: 'sticky', value: 'on' }], still })
const STICKY_CLAIM: GraphSpec = {
  regions: REGIONS,
  steps: {
    sticky: { boxes: [stickyLb(), ...INSTS.map((i) => inst(i, [cache(OLD)], { still: true })), db(OLD, undefined, true)] },
    pinned: { boxes: [stickyLb(true), customer('Ana', 'a'), customer('Ben', 'b'), ...INSTS.map((i) => inst(i, [cache(OLD)], { still: true })), db(OLD, undefined, true)] },
  },
}
const STICKY_REALITY: GraphSpec = {
  regions: REGIONS,
  steps: {
    elsewhere: {
      boxes: [
        update([via(), { name: 'saves', value: NEW }]),
        customer('Ana', 'a', [{ name: 'gets', value: OLD, kind: 'bad' }], 'bad'),
        customer('Ben', 'b', [], undefined, true),
        ...localInsts(cache('removed', 'ok'), [cache(OLD, 'bad')]).map((b) => (b.id === 'c' ? { ...b, still: true } : b)),
        db(NEW, 'ok'),
      ],
    },
    differ: {
      boxes: [
        update([via(), { name: 'saves', value: NEW }], true),
        customer('Ana', 'a', [{ name: 'gets', value: OLD, kind: 'bad' }], 'bad', true),
        customer('Ben', 'b', [{ name: 'gets', value: NEW }]),
        ...localInsts({ name: 'cache p1', value: NEW }, [cache(OLD, 'bad')]).map((b) => (b.id === 'c' ? { ...b, still: true } : b)),
        db(NEW, 'ok', true),
      ],
    },
  },
}

// ---- Claim: remove before saving ----
const SWAPPED: Field[] = [
  { name: 'first', value: 'Remove(key)' },
  { name: 'then', value: `saves ${NEW}` },
]
const ORDER_CLAIM: GraphSpec = {
  regions: REGIONS,
  steps: {
    swap: { boxes: [update(SWAPPED), ...INSTS.map((i) => inst(i, [cache('?', 'muted')], { still: true })), db(OLD, undefined, true)] },
    'no-recache': {
      boxes: [update([...SWAPPED, { name: 'old price', value: 'never re-cached' }]), ...INSTS.map((i) => inst(i, [cache('?', 'muted')], { still: true })), db(NEW)],
    },
  },
}
const ORDER_REALITY: GraphSpec = {
  regions: REGIONS,
  steps: {
    one: { boxes: [update([via(), ...SWAPPED]), ...localInsts(cache('removed', 'ok'), [cache(OLD)]).map((b) => (b.id === 'b' ? b : { ...b, still: true })), db(NEW, 'ok')] },
    others: {
      boxes: [update([via(), ...SWAPPED], true), ...localInsts(cache('removed', 'ok'), [cache(OLD, 'bad'), { name: 'untouched', value: '≤ 10 min', kind: 'bad' }], { acKind: 'bad', still: true }), db(NEW, 'ok', true)],
    },
  },
}

const SPECS: Record<string, GraphSpec> = {
  setup: SETUP,
  local: LOCAL,
  shared: SHARED,
  'singleton-claim': SINGLETON_CLAIM,
  'singleton-reality': SINGLETON_REALITY,
  'sticky-claim': STICKY_CLAIM,
  'sticky-reality': STICKY_REALITY,
  'order-claim': ORDER_CLAIM,
  'order-reality': ORDER_REALITY,
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
