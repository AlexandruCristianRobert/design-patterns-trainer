import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const CODE = [
  '[HttpPut("/users/{id}")]',
  'public async Task<IActionResult> Put(int id, User user)',
  '{',
  '    user.Id = id;',
  '    db.Users.Update(user);',
  '    await db.SaveChangesAsync();',
  '    return NoContent();',
  '}',
]
const DTO_CODE = [
  'public record UpdateUser(string Name, string Email);',
  '',
  '[HttpPut("/users/{id}")]',
  'public async Task<IActionResult> Put(int id, UpdateUser input)',
  '{',
  '    var user = await db.Users.FindAsync(id);',
  '    user!.Name = input.Name;',
  '    user.Email = input.Email;',
  '    await db.SaveChangesAsync();',
  '    return NoContent();',
  '}',
]
const L = { BIND: 1, SAVE: [4, 5] as [number, number] }
const D = { BIND: [0, 3] as [number, number], COPY: [5, 7] as [number, number], SAVE: 8 }

const BODY: TableDef = { id: 'body', name: 'Request body', sub: 'JSON', tone: 'ui', columns: ['Field', 'Value'] }
const bound = (sub: string): TableDef => ({ id: 'bound', name: 'Bound object', sub, tone: 'pool', columns: ['Prop', 'Value'] })
const ROW: TableDef = { id: 'row', name: 'Users row 7', sub: 'database', tone: 'io', columns: ['Column', 'Value'] }

type Look = [kind?: TRow['kind'], mark?: string, markKind?: TRow['markKind']]
const r = (key: string, a: string, b: string, look: Look = []): TRow => ({ key, cells: [a, b], kind: look[0], mark: look[1], markKind: look[2] })
const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })

const FORM_BODY = [r('name', 'name', '"Ana"'), r('email', 'email', '"a@new.ch"')]
const evilBody = (look: Look = ['new', 'added', 'plain']) => [...FORM_BODY, r('admin', 'isAdmin', 'true', look)]
const stored = (admin: Look = [], email = 'a@old.ch') => [r('name', 'Name', 'Ana'), r('email', 'Email', email), r('admin', 'IsAdmin', 'false', admin)]
const SAVED_ADMIN = [r('name', 'Name', 'Ana'), r('email', 'Email', 'a@new.ch'), r('admin', 'IsAdmin', 'true', ['bad', 'saved', 'bad'])]
const boundAdmin = (look: Look = ['bad', 'bound', 'bad']) => [r('name', 'Name', 'Ana'), r('email', 'Email', 'a@new.ch'), r('admin', 'IsAdmin', 'true', look)]

const spec = (steps: Record<string, TableStep>, code: string[] = CODE, boundSub = 'User entity'): TableSpec => ({ tables: [BODY, bound(boundSub), ROW], code, steps })

/** Bound straight to the entity: the extra field is bound and saved. */
const BOUND_STEP: TableStep = { tables: { body: evilBody(['plain']), bound: boundAdmin(), row: stored() }, chips: [chip('v', 'ModelState valid')], line: L.BIND }
const SAVED_STEP: TableStep = { tables: { body: evilBody(['plain']), bound: boundAdmin(['bad']), row: SAVED_ADMIN }, line: L.SAVE, bad: true }

const SPECS: Record<string, TableSpec> = {
  setup: spec({
    form: { tables: { body: FORM_BODY, row: stored() }, chips: [chip('form', 'form: Name, Email')], line: null },
    bind: { tables: { body: FORM_BODY, row: stored() }, chips: [chip('form', 'form: Name, Email')], line: { each: [L.BIND, L.SAVE] } },
  }),

  overpost: spec({
    edit: { tables: { body: evilBody(), row: stored() }, chips: [chip('who', 'signed-in user 7')], line: null },
    bind: BOUND_STEP,
    save: SAVED_STEP,
  }),
  dto: spec(
    {
      bind: {
        tables: { body: evilBody(['plain']), bound: [r('name', 'Name', 'Ana'), r('email', 'Email', 'a@new.ch'), r('admin', 'isAdmin', 'true', ['skip', 'ignored', 'muted'])], row: stored() },
        line: D.BIND,
      },
      copy: {
        tables: { body: evilBody(['plain']), bound: [r('name', 'Name', 'Ana'), r('email', 'Email', 'a@new.ch')], row: stored() },
        chips: [chip('load', 'load user 7'), chip('copy', 'copy Name, Email')],
        line: D.COPY,
      },
      save: {
        tables: { body: evilBody(['plain']), bound: [r('name', 'Name', 'Ana'), r('email', 'Email', 'a@new.ch')], row: stored(['hit', 'unchanged', 'ok'], 'a@new.ch') },
        line: D.SAVE,
      },
    },
    DTO_CODE,
    'UpdateUser',
  ),

  'validation-claim': spec({
    add: { tables: { body: evilBody(), row: stored() }, line: null },
    reject: { tables: { body: evilBody(['bad', 'rejected', 'bad']), row: stored() }, chips: [chip('v', '400: not on the form', 'bad')], line: L.BIND },
  }),
  'validation-reality': spec({
    add: { tables: { body: evilBody(), row: stored() }, line: null },
    reject: { ...SAVED_STEP, chips: [chip('v', 'binds, ModelState valid', 'ok')] },
  }),

  'csrf-claim': spec({
    forged: { tables: { row: stored() }, chips: [chip('evil', 'other site → PUT as user 7')], line: null },
    token: { tables: { row: stored() }, chips: [chip('evil', 'other site → PUT as user 7'), chip('tok', '[ValidateAntiForgeryToken]'), chip('closed', 'hole closed', 'bad')], line: null },
  }),
  'csrf-reality': spec({
    forged: { tables: { row: stored() }, chips: [chip('evil', 'other site → PUT as user 7'), chip('tok', 'antiforgery: rejected', 'ok')], line: null },
    token: { ...SAVED_STEP, chips: [chip('who', 'user 7, own request'), chip('tok', 'token: valid', 'ok'), chip('closed', 'hole still open', 'bad')] },
  }),

  'https-claim': spec({
    transit: { tables: { row: stored() }, chips: [chip('net', 'body changed in transit')], line: null },
    https: { tables: { row: stored() }, chips: [chip('net', 'body changed in transit'), chip('tls', 'HTTPS'), chip('closed', 'extra field impossible', 'bad')], line: null },
  }),
  'https-reality': spec({
    transit: { tables: { row: stored() }, chips: [chip('net', 'network: TLS protects', 'ok')], line: null },
    https: { ...SAVED_STEP, chips: [chip('who', 'caller adds it before TLS'), chip('tls', 'TLS: delivered intact', 'ok'), chip('closed', 'still saved', 'bad')] },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
