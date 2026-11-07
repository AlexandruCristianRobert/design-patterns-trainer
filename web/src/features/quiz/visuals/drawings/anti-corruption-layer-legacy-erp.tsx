import { BoxGraph, type Box, type Field, type GraphSpec, type GraphStep, type OutLine, type Region } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'

// ---- Regions ----
const DOMAIN: Region = { id: 'domain', name: 'Pricing domain', tone: 'ui' }
const ERP: Region = { id: 'erp', name: 'Legacy ERP', sub: 'generated client', tone: 'io' }
const ACL: Region = { id: 'acl', name: 'Anti-corruption layer', tone: 'pool' }
const NEW_ERP: Region = { id: 'erp', name: 'New ERP', sub: 'generated client', tone: 'io' }
const ERP_DB: Region = { id: 'erp', name: 'Legacy ERP', sub: 'its database', tone: 'io' }
const SERVICE: Region = { id: 'domain', name: 'Pricing service', tone: 'ui' }

// ---- Boxes ----
const erpType = (fields: Field[] = [{ name: 'KUNNR', value: '0000104711' }, { name: 'STATUS', value: '"03"' }], kind?: Box['kind']): Box => ({
  id: 'zkna1',
  region: 'erp',
  title: 'ZKna1Customer',
  sub: 'generated type',
  fields,
  kind,
})
const quote = (customer: Field, kind?: Box['kind']): Box => ({ id: 'quote', region: 'domain', title: 'PriceQuote', sub: 'entity', fields: [customer, { name: 'Price', value: '120.00' }], kind })
const rule = (checks: string, kind?: Field['kind']): Box => ({ id: 'rule', region: 'domain', title: 'Pricing rule', fields: [{ name: 'checks', value: checks, kind }] })
const terms = (text: string, kind?: OutLine['kind'], extra: OutLine[] = []): OutLine[] => [{ label: 'ERP terms in the domain', text, kind }, ...extra]

const SETUP_CODE = [
  '// Pricing domain',
  'public class PriceQuote',
  '{',
  '    public ZKna1Customer Customer { get; }  // generated',
  '    public decimal Price { get; }',
  '}',
  '',
  '// a pricing rule',
  'if (quote.Customer.STATUS == "03") …',
]

// Reality: the domain's own model and port, an adapter that translates
const customer: Box = { id: 'customer', region: 'domain', title: 'Customer', sub: "the domain's own model", fields: [{ name: 'Id', value: 'CustomerId' }, { name: 'Status', value: 'CustomerStatus' }] }
const port: Box = { id: 'port', region: 'domain', title: 'ICustomerDirectory', sub: 'interface', fields: [{ name: 'GetAsync', value: 'returns Customer' }] }
const adapter = (fields: Field[], title = 'ErpCustomerDirectory', kind?: Box['kind']): Box => ({ id: 'adapter', region: 'acl', title, fields, kind })
const implementsPort: Field = { name: 'implements', value: 'the interface', ref: 'port' }
const callsErp: Field = { name: 'calls', value: 'ERP client', ref: 'zkna1' }
const MAP: Field[] = [
  { name: 'KUNNR', value: 'to CustomerId', kind: 'ok' },
  { name: '"03"', value: 'to OnHold', kind: 'ok' },
]
const ACL_CODE = [
  '// Pricing domain: its own model and the interface it needs',
  'public record Customer(CustomerId Id, CustomerStatus Status);',
  'public interface ICustomerDirectory { Task<Customer> GetAsync(CustomerId id); }',
  '',
  '// Anti-corruption layer: the only code that sees ERP types',
  'class ErpCustomerDirectory(ErpClient erp) : ICustomerDirectory',
  '{',
  '    public async Task<Customer> GetAsync(CustomerId id)',
  '    {',
  '        ZKna1Customer c = await erp.GetCustomerAsync(id.Value);',
  '        return new(new CustomerId(c.KUNNR), MapStatus(c.STATUS));',
  '    }',
  '}',
  '',
  '// PriceQuote holds Customer; the rule checks',
  'if (quote.Customer.Status == CustomerStatus.OnHold) …',
]
const A = { MODEL: [1, 2] as [number, number], ADAPTER: 5, CALL: 9, MAP: 10, RULE: 15 }
const domainDone = [quote({ name: 'Customer', value: 'Customer', ref: 'customer', kind: 'ok' }), customer, port, rule('Status == OnHold', 'ok')]

const NEW_CODE = [
  '// only this class is rewritten for the new ERP',
  'class NewErpCustomerDirectory(PartnerClient erp) : ICustomerDirectory',
  '{',
  '    public async Task<Customer> GetAsync(CustomerId id)',
  '    {',
  '        BusinessPartner p = await erp.GetPartnerAsync(id.Value);',
  '        return new(new CustomerId(p.PartnerNo), MapStatus(p.Block));',
  '    }',
  '}',
]
const partner: Box = { id: 'zkna1', region: 'erp', title: 'BusinessPartner', sub: 'generated type', fields: [{ name: 'PartnerNo', value: '104711' }, { name: 'Block', value: '"B"' }] }

// Claim: conformist
const CONFORM_CODE = [
  '// Pricing domain, renamed to the ERP\'s terms',
  'public class PriceQuote',
  '{',
  '    public string KUNNR { get; }',
  '    public string STATUS { get; }',
  '    public decimal Price { get; }',
  '}',
  '',
  'if (quote.STATUS == "03") …',
]
const conformQuote = (kind?: Field['kind'], extra: Field[] = []): Box => ({
  id: 'quote',
  region: 'domain',
  title: 'PriceQuote',
  sub: 'entity',
  fields: [{ name: 'KUNNR', value: '0000104711', kind }, { name: 'STATUS', value: '"03"', kind }, ...extra],
})

// Claim: read the ERP's tables
const DB_CODE = [
  '// pricing service, no SOAP client',
  'await using var conn = new SqlConnection(erpDbConnectionString);',
  'var rows = await conn.QueryAsync(',
  '    "SELECT KUNNR, STATUS FROM KNA1 WHERE …");',
  '',
  'if (row.STATUS == "03") …',
]
const DB_CLAIM_CODE = DB_CODE.slice(0, 4)
const service = (fields: Field[], kind?: Box['kind']): Box => ({ id: 'svc', region: 'domain', title: 'Pricing service', fields, kind })
const tables = (fields: Field[] | undefined, kind?: Box['kind']): Box => ({ id: 'kna1', region: 'erp', title: fields ? 'Table KNA1' : 'ERP tables', fields, kind })
const soapGone: Box = { id: 'soap', region: 'domain', title: 'Generated SOAP client types', kind: 'gone' }

// Claim: partial classes
const PARTIAL_CODE = [
  '// next to the generated ZKna1Customer',
  'public partial class ZKna1Customer',
  '{',
  '    public string CustomerId => KUNNR;',
  '    public bool IsOnHold => STATUS == "03";',
  '}',
  '',
  '// Pricing domain',
  'public ZKna1Customer Customer { get; }',
  'if (quote.Customer.IsOnHold) …',
]
const partialType = (kind?: Field['kind'], boxKind?: Box['kind'], changed = false): Box =>
  erpType(
    [
      { name: 'KUNNR', value: '0000104711', kind },
      { name: 'STATUS', value: changed ? 'renamed by the new client' : '"03"', kind: changed ? 'bad' : kind },
      { name: 'CustomerId', value: '=> KUNNR' },
      { name: 'IsOnHold', value: '=> STATUS == "03"' },
    ],
    boxKind,
  )

const graph = (regions: Region[], code: string[], steps: Record<string, GraphStep>): GraphSpec => ({ regions, code, outputName: 'Outcome', steps })

const SPECS: Record<string, GraphSpec> = {
  setup: graph([DOMAIN, ERP], SETUP_CODE, {
    today: { boxes: [erpType()], line: null },
    leak: { boxes: [quote({ name: 'Customer', value: 'ZKna1Customer', ref: 'zkna1' }), rule('STATUS == "03"'), erpType()], line: [3, 8], output: terms('KUNNR, STATUS "03"') },
    goal: {
      boxes: [quote({ name: 'Customer', value: 'ZKna1Customer', ref: 'zkna1' }), rule('STATUS == "03"'), erpType()],
      line: null,
      output: terms('KUNNR, STATUS "03"', undefined, [{ label: 'Goal', text: "the domain's own language" }]),
    },
  }),
  acl: graph([DOMAIN, ACL, ERP], ACL_CODE, {
    model: { boxes: [customer, port, erpType()], line: A.MODEL },
    adapter: { boxes: [customer, port, adapter([implementsPort, callsErp]), erpType()], line: A.CALL },
    translate: { boxes: [customer, port, adapter([implementsPort, callsErp, ...MAP]), erpType()], line: A.MAP },
    domain: { boxes: [...domainDone, adapter([implementsPort, callsErp, ...MAP]), erpType()], line: A.RULE, output: terms('none', 'ok') },
  }),
  replace: graph([DOMAIN, ACL, NEW_ERP], NEW_CODE, {
    'new-erp': {
      boxes: [...domainDone, adapter([implementsPort, { ...callsErp, value: 'old ERP client' }, ...MAP.map((f) => ({ ...f, kind: 'muted' as const }))], 'ErpCustomerDirectory', 'bad'), partner],
      line: 5,
      output: [{ label: 'Code that must change', text: '?' }],
    },
    'new-adapter': {
      boxes: [
        ...domainDone,
        adapter(
          [implementsPort, { ...callsErp, value: 'new ERP client' }, { name: 'PartnerNo', value: 'to CustomerId', kind: 'ok' }, { name: '"B"', value: 'to OnHold', kind: 'ok' }],
          'NewErpCustomerDirectory',
          'ok',
        ),
        partner,
      ],
      line: [1, 6],
      output: [{ label: 'Code that must change', text: 'the anti-corruption layer only', kind: 'ok' }],
    },
  }),

  'conform-claim': graph([DOMAIN, ERP], CONFORM_CODE, {
    rename: { boxes: [conformQuote(), rule('STATUS == "03"'), erpType()], line: [3, 4] },
    aligned: { boxes: [conformQuote(undefined, [{ name: 'mapping', value: 'none needed', kind: 'ok' }]), rule('STATUS == "03"'), erpType()], line: [3, 4], output: [{ label: 'Mapping', text: 'none needed' }] },
  }),
  'conform-reality': graph([DOMAIN, ERP], CONFORM_CODE, {
    rename: { boxes: [conformQuote(undefined, [{ name: 'mapping', value: 'none needed' }]), rule('STATUS == "03"'), erpType()], line: [3, 4], output: [{ label: 'Mapping', text: 'none needed' }] },
    spread: {
      boxes: [conformQuote('bad', [{ name: 'mapping', value: 'none needed' }]), rule('STATUS == "03"', 'bad'), erpType()],
      line: 8,
      bad: true,
      output: [{ label: 'Mapping', text: 'none needed' }, ...terms('KUNNR, STATUS "03", everywhere', 'bad')],
    },
  }),

  'database-claim': graph([SERVICE, ERP_DB], DB_CLAIM_CODE, {
    tables: { boxes: [service([{ name: 'reads', value: 'ERP tables', ref: 'kna1' }]), tables(undefined)], line: [1, 3] },
    gone: { boxes: [service([{ name: 'reads', value: 'ERP tables', ref: 'kna1' }]), soapGone, tables(undefined)], line: [1, 3], output: [{ label: 'Generated client types', text: 'gone' }] },
  }),
  'database-reality': graph([SERVICE, ERP_DB], DB_CODE, {
    columns: {
      boxes: [
        service([{ name: 'reads', value: 'KNA1 rows', ref: 'kna1' }, { name: 'gets', value: 'KUNNR, STATUS "03"', kind: 'bad' }]),
        soapGone,
        tables([{ name: 'KUNNR', value: '0000104711', kind: 'bad' }, { name: 'STATUS', value: '"03"', kind: 'bad' }]),
      ],
      line: 3,
      output: [{ label: 'Generated client types', text: 'gone' }, ...terms('KUNNR, STATUS "03"', 'bad')],
    },
    coupled: {
      boxes: [
        service([{ name: 'depends on', value: "ERP's internal schema", ref: 'kna1', kind: 'bad' }, { name: 'gets', value: 'KUNNR, STATUS "03"', kind: 'bad' }], 'bad'),
        soapGone,
        tables([{ name: 'KUNNR', value: '0000104711' }, { name: 'STATUS', value: '"03"' }, { name: 'schema', value: 'internal, may change', kind: 'bad' }]),
      ],
      line: [3, 5],
      bad: true,
      output: [{ label: 'Generated client types', text: 'gone' }, ...terms('KUNNR, STATUS "03"', 'bad'), { label: 'Coupled to', text: "the ERP's internal schema", kind: 'bad' }],
    },
  }),

  'partial-claim': graph([DOMAIN, ERP], PARTIAL_CODE, {
    partial: { boxes: [partialType()], line: [1, 5] },
    friendly: { boxes: [quote({ name: 'Customer', value: 'ZKna1Customer', ref: 'zkna1' }), rule('Customer.IsOnHold'), partialType()], line: [8, 9] },
  }),
  'partial-reality': graph([DOMAIN, ERP], PARTIAL_CODE, {
    still: {
      boxes: [quote({ name: 'Customer', value: 'ZKna1Customer', ref: 'zkna1', kind: 'bad' }), rule('Customer.IsOnHold'), partialType('bad')],
      line: 8,
      bad: true,
      output: terms('ZKna1Customer, with KUNNR and STATUS', 'bad'),
    },
    regen: {
      boxes: [quote({ name: 'Customer', value: 'ZKna1Customer', ref: 'zkna1', kind: 'bad' }, 'bad'), rule('Customer.IsOnHold', 'bad'), partialType(undefined, 'bad', true)],
      line: [4, 9],
      bad: true,
      output: [...terms('ZKna1Customer, with KUNNR and STATUS', 'bad'), { label: 'A client change', text: 'reaches the domain', kind: 'bad' }],
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <BoxGraph spec={s} {...p} />]),
)
export default drawing
