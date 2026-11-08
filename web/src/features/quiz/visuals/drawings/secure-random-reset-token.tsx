import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { RowStage, type Chip, type ChipKind, type RowDef, type RowSpec, type RowStep } from '../RowStage'

const CODE = ['var token = new Random().Next().ToString();', 'SendResetLink(user, token);']
const FIX = ['var token = RandomNumberGenerator.GetHexString(64);', 'SendResetLink(user, token);']
const SHARED = ['var token = Random.Shared.Next().ToString();', 'SendResetLink(user, token);']
const SHARED_CLAIM = ['var a = new Random().Next();', 'var b = new Random().Next();', '', 'var token = Random.Shared.Next().ToString();']
const JOIN = ['var r = new Random();', 'var token = $"{r.Next()}{r.Next()}{r.Next()}{r.Next()}";', 'SendResetLink(user, token);']
const HASH = ['var token = new Random().Next().ToString();', 'var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));', 'SendResetLink(user, hash);']

const ROW: Record<string, RowDef> = {
  gen: { id: 'gen', name: 'Generator', tone: 'pool' },
  tokens: { id: 'tokens', name: 'Tokens', sub: 'in reset links', tone: 'io' },
  atk: { id: 'atk', name: 'Attacker', tone: 'bad' },
}
const rows = (...ids: string[]) => ids.map((id) => ROW[id])
const ALL = rows('gen', 'tokens', 'atk')
const spec = (r: RowDef[], steps: Record<string, RowStep>, code = CODE): RowSpec => ({ rows: r, code, steps })
const chip = (key: string, label: string, kind: ChipKind = 'item'): Chip => ({ key, label, kind })

const RANDOM = chip('g', 'new Random()')
const TOKENS = [chip('t1', '490417661'), chip('t2', '2014532668'), chip('t3', '…')]
const NOT_CRYPTO = chip('nc', 'not cryptographic', 'bad')
const BITS31 = chip('b', '31 bits', 'bad')

const SPECS: Record<string, RowSpec> = {
  // ---- Setup: the generator and its tokens; nothing about predictability or size ----
  setup: spec(rows('gen', 'tokens'), {
    code: { rows: { gen: [RANDOM] }, line: 0 },
    tokens: { rows: { gen: [RANDOM], tokens: TOKENS }, line: 1 },
    ask: { rows: { gen: [RANDOM], tokens: TOKENS }, line: null },
  }),

  predict: spec(ALL, {
    algo: { rows: { gen: [RANDOM, NOT_CRYPTO], tokens: TOKENS }, line: 0, bad: true },
    space: { rows: { gen: [RANDOM, NOT_CRYPTO, BITS31], tokens: [...TOKENS, chip('max', '≤ 2,147,483,647', 'bad')], atk: [chip('a1', 'can try them all', 'bad')] }, line: 0, bad: true },
    takeover: {
      rows: { gen: [RANDOM, NOT_CRYPTO, BITS31], tokens: [...TOKENS, chip('max', '≤ 2,147,483,647', 'bad')], atk: [chip('a1', 'can try them all', 'bad'), chip('a2', 'or predicts them', 'bad'), chip('a3', "resets a victim's password", 'bad')] },
      line: 1,
      bad: true,
    },
  }),
  fix: spec(
    ALL,
    {
      csprng: { rows: { gen: [chip('g', 'RandomNumberGenerator', 'ok'), chip('c', 'cryptographic', 'ok')], tokens: [chip('t1', 'A9256F34…61D4BD9', 'ok'), chip('bits', '256 bits', 'ok')] }, line: 0 },
      length: {
        rows: { gen: [chip('g', 'RandomNumberGenerator', 'ok'), chip('c', 'cryptographic', 'ok')], tokens: [chip('t1', 'A9256F34…61D4BD9', 'ok'), chip('bits', '256 bits', 'ok')], atk: [chip('a1', 'guessing: hopeless', 'ok'), chip('a2', 'no prediction', 'ok')] },
        line: 0,
      },
    },
    FIX,
  ),

  'shared-claim': spec(
    rows('gen', 'tokens'),
    {
      repeat: { rows: { gen: [chip('g1', 'new Random()'), chip('g2', 'new Random()')], tokens: [chip('t1', '490417661'), chip('t2', '490417661')] }, line: [0, 1] },
      shared: { rows: { gen: [chip('g1', 'Random.Shared')], tokens: [chip('t1', '490417661'), chip('t2', '2014532668')] }, line: 3 },
    },
    SHARED_CLAIM,
  ),
  'shared-reality': spec(
    ALL,
    {
      seeded: { rows: { gen: [chip('g1', 'new Random(): random seed', 'ok'), chip('g2', 'Random.Shared: random seed', 'ok')], tokens: [chip('t1', '490417661'), chip('t2', '2014532668')] }, line: 0 },
      same: { rows: { gen: [chip('g2', 'Random.Shared'), NOT_CRYPTO, BITS31], tokens: [chip('t1', '490417661'), chip('t2', '2014532668')], atk: [chip('a1', 'can still guess or predict', 'bad')] }, line: 0, bad: true },
    },
    SHARED,
  ),

  'join-claim': spec(
    rows('gen', 'tokens'),
    {
      few: { rows: { gen: [RANDOM], tokens: [chip('t1', '490417661: too short')] }, line: 1 },
      join: { rows: { gen: [RANDOM], tokens: [chip('t1', '490417661 2014532668 …'), chip('ok', 'secure')] }, line: 1 },
    },
    JOIN,
  ),
  'join-reality': spec(
    ALL,
    {
      longer: { rows: { gen: [RANDOM, NOT_CRYPTO], tokens: [chip('p1', 'part 1'), chip('p2', 'part 2'), chip('p3', 'part 3'), chip('p4', 'part 4')] }, line: 1, bad: true },
      predictable: {
        rows: { gen: [RANDOM, NOT_CRYPTO], tokens: [chip('p1', 'part 1'), chip('p2', 'part 2'), chip('p3', 'part 3'), chip('p4', 'part 4')], atk: [chip('a1', 'predicts the generator', 'bad'), chip('a2', 'gets all four parts', 'bad')] },
        line: 1,
        bad: true,
      },
    },
    JOIN,
  ),

  'hash-claim': spec(
    rows('gen', 'tokens'),
    {
      fine: { rows: { gen: [RANDOM], tokens: [chip('t1', '490417661: fine')] }, line: 0 },
      hash: { rows: { gen: [RANDOM], tokens: [chip('t1', '490417661: fine'), chip('h', 'SHA-256: 5C1F…'), chip('g', 'cannot be guessed')] }, line: 1 },
    },
    HASH,
  ),
  'hash-reality': spec(
    ALL,
    {
      input: { rows: { gen: [RANDOM, BITS31], tokens: [chip('t1', 'input: 31 bits', 'bad'), chip('h', 'SHA-256: 5C1F…')] }, line: [0, 1], bad: true },
      guess: {
        rows: { gen: [RANDOM, BITS31], tokens: [chip('t1', 'input: 31 bits', 'bad'), chip('h', 'SHA-256: 5C1F…')], atk: [chip('a1', 'guesses the input', 'bad'), chip('a2', 'hashes each guess', 'bad')] },
        line: 1,
        bad: true,
      },
    },
    HASH,
  ),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <RowStage spec={s} {...p} />]),
)
export default drawing
