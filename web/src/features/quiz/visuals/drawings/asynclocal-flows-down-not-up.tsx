import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

const CODE = [
  'var tenant = new AsyncLocal<string?>();',
  'tenant.Value = "outer";',
  '',
  'await SetTenantAsync(tenant);',
  'Console.WriteLine($"after: {tenant.Value}");',
  '',
  'static async Task SetTenantAsync(AsyncLocal<string?> tenant)',
  '{',
  '    tenant.Value = "inner";',
  '    await Task.Yield();',
  '    Console.WriteLine($"inside: {tenant.Value}");',
  '}',
]
const L = { OUTER: 1, CALL: 3, AFTER: 4, ENTER: 6, SET: 8, YIELD: 9, INSIDE: 10 }

const METHODS: Region = { id: 'code', name: 'Methods', tone: 'ui' }
const CONTEXTS: Region = { id: 'ctx', name: 'Execution contexts', sub: 'immutable', tone: 'pool' }
const SHARED: Region = { id: 'ctx', name: 'Shared value', tone: 'pool' }

const spec = (regions: Region[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, code: CODE, outputName: 'Console', steps })
const CTX_NAME: Record<string, string> = { ec1: 'Context 1', ec2: 'Context 2' }
const uses = (ctx: string, name = 'context', kind?: Field['kind']): Field => ({ name, ref: ctx, value: CTX_NAME[ctx], kind })
const main = (sub: string, fields: Field[]): Box => ({ id: 'main', region: 'code', title: 'Main', sub, fields })
const callee = (sub: string, fields: Field[], kind?: Box['kind']): Box => ({ id: 'callee', region: 'code', title: 'SetTenantAsync', sub, fields, kind })
const ctx = (id: string, value: string, kind?: Box['kind']): Box => ({ id, region: 'ctx', title: CTX_NAME[id], fields: [{ name: 'tenant', value }], kind })
const EC1 = ctx('ec1', '"outer"')
const EC2 = ctx('ec2', '"inner"')

const out = (inside: string, after: string, insideKind?: OutLine['kind'], afterKind?: OutLine['kind']): OutLine[] => [
  { label: 'line 1', text: inside, kind: inside === '?' ? 'muted' : insideKind },
  { label: 'line 2', text: after, kind: after === '?' ? 'muted' : afterKind },
]
const UNKNOWN = out('?', '?')

// Frames shared by the reality and the claim realities.
const mainOn1 = (sub = 'awaits the call') => main(sub, [uses('ec1')])
const running2 = callee('running', [uses('ec2')])
const suspended2 = callee('suspended at the await', [uses('ec2', 'resumes with')])
const resumed2 = callee('resumed, any thread', [uses('ec2')])
const INSIDE = out('inside: inner', '?', 'ok')
const BOTH = out('inside: inner', 'after: outer', 'plain', 'ok')

const SPECS: Record<string, GraphSpec> = {
  setup: spec([METHODS], {
    outer: { boxes: [main('running', [{ name: 'tenant.Value', value: '"outer"' }])], line: L.OUTER, output: UNKNOWN },
    call: {
      boxes: [
        main('awaits the call', [{ name: 'reads after the call', value: '?', kind: 'muted' }]),
        callee('', [{ name: 'sets', value: '"inner"' }, { name: 'reads after the await', value: '?', kind: 'muted' }]),
      ],
      line: [L.SET, L.INSIDE],
      output: UNKNOWN,
    },
  }),
  contexts: spec([METHODS, CONTEXTS], {
    outer: { boxes: [main('running', [uses('ec1')]), EC1], line: L.OUTER, output: UNKNOWN },
    enter: { boxes: [mainOn1(), callee('running', [uses('ec1')]), EC1], line: L.CALL, output: UNKNOWN },
    'set-inner': { boxes: [mainOn1(), running2, EC1, EC2], line: L.SET, output: UNKNOWN },
    yield: { boxes: [mainOn1('awaits the task'), suspended2, EC1, EC2], line: L.YIELD, output: UNKNOWN },
    resume: { boxes: [mainOn1('awaits the task'), resumed2, EC1, EC2], line: L.INSIDE, output: INSIDE },
    after: { boxes: [main('continues', [uses('ec1', 'context', 'ok')]), EC1, ctx('ec2', '"inner"', 'gone')], line: L.AFTER, output: BOTH },
  }),

  'shared-claim': spec([METHODS, SHARED], {
    write: {
      boxes: [
        main('awaits the call', [{ name: 'reads', ref: 'val', value: 'tenant.Value' }]),
        callee('running', [{ name: 'writes', ref: 'val', value: 'tenant.Value' }]),
        { id: 'val', region: 'ctx', title: 'tenant.Value', fields: [{ name: 'value', value: '"inner"' }] },
      ],
      line: L.SET,
      output: UNKNOWN,
    },
    after: {
      boxes: [main('continues', [{ name: 'reads', ref: 'val', value: 'tenant.Value' }]), { id: 'val', region: 'ctx', title: 'tenant.Value', fields: [{ name: 'value', value: '"inner"' }] }],
      line: L.AFTER,
      output: out('inside: inner', 'after: inner'),
    },
  }),
  'shared-reality': spec([METHODS, CONTEXTS], {
    write: { boxes: [mainOn1(), running2, EC1, EC2], line: L.SET, output: UNKNOWN },
    after: { boxes: [main('continues', [uses('ec1', 'context', 'ok')]), EC1, ctx('ec2', '"inner"', 'gone')], line: L.AFTER, output: BOTH },
  }),

  'outer-claim': spec([METHODS], {
    resume: {
      boxes: [main('awaits the task', []), callee('resumed', [{ name: 'reads after the await', value: '"outer"' }])],
      line: L.INSIDE,
      output: out('inside: outer', '?'),
    },
    print: { boxes: [main('continues', [{ name: 'reads after the call', value: '"outer"' }])], line: L.AFTER, output: out('inside: outer', 'after: outer') },
  }),
  'outer-reality': spec([METHODS, CONTEXTS], {
    set: { boxes: [mainOn1(), running2, EC1, EC2], line: L.SET, output: UNKNOWN },
    capture: { boxes: [mainOn1('awaits the task'), suspended2, EC1, EC2], line: L.YIELD, output: UNKNOWN },
    print: { boxes: [main('continues', [uses('ec1')]), EC1, ctx('ec2', '"inner"', 'gone')], line: { each: [L.INSIDE, L.AFTER] }, output: BOTH },
  }),

  'lost-claim': spec([METHODS], {
    yield: { boxes: [main('awaits the task', []), callee('suspended at the await', [{ name: 'set', value: '"inner"' }])], line: [L.SET, L.YIELD], output: UNKNOWN },
    resume: {
      boxes: [main('awaits the task', []), callee('resumed', [{ name: 'set', value: '"inner"' }, { name: 'reads after the await', value: '(nothing)' }])],
      line: L.INSIDE,
      output: out('inside: ', 'after: outer'),
    },
  }),
  'lost-reality': spec([METHODS, CONTEXTS], {
    yield: { boxes: [mainOn1('awaits the task'), suspended2, EC1, EC2], line: L.YIELD, output: UNKNOWN },
    resume: { boxes: [mainOn1('awaits the task'), resumed2, EC1, ctx('ec2', '"inner"', 'ok')], line: L.INSIDE, output: INSIDE },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
