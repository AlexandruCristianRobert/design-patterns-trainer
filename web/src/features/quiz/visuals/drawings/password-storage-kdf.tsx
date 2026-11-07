import type { OutLine } from '../BoxGraph'
import type { QuestionDrawing, StageDrawingProps } from '../drawing'
import { TableStage, type TableDef, type TableSpec, type TableStep, type TChip, type TRow } from '../TableStage'

const SETUP_CODE = ['// sign-up', 'var user = new User { Name = form.Name };', 'user.Password = /* what goes here? */;', 'db.Users.Add(user);']
const HASH_CODE = [
  'var hasher = new PasswordHasher<User>();',
  'user.PasswordHash = hasher.HashPassword(user, form.Password);',
  '',
  '// at sign-in:',
  'var result = hasher.VerifyHashedPassword(user, user.PasswordHash, attempt);',
]
const H = { HASH: 1, VERIFY: 4 }
const SHA_CODE = ['var salt = RandomNumberGenerator.GetBytes(16);', 'user.Salt = salt;', 'user.Hash = SHA256.HashData(salt.Concat(Encoding.UTF8.GetBytes(password)).ToArray());']
const AES_CODE = ['var key = await LoadKeyFromKeyVaultAsync("passwords");', 'user.Password = EncryptWithAes(key, password);', '', '// support tool:', 'var plain = DecryptWithAes(key, user.Password);']
const HMAC_CODE = ['byte[] key = LoadSecretKey(); // secret, server-side', 'user.Hash = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(password));']

const USERS_PLAIN: TableDef = { id: 'users', name: 'Users', sub: 'database', tone: 'io', columns: ['User', 'Stored'] }
const USERS_SALTED: TableDef = { id: 'users', name: 'Users', sub: 'database', tone: 'io', columns: ['User', 'Salt', 'Hash'] }
const GUESSES: TableDef = { id: 'guess', name: 'Attacker', sub: 'guesses against the leaked table', tone: 'bad', columns: ['Guess', 'Alice?'] }

type Opts = Pick<TRow, 'kind' | 'mark' | 'markKind'>
const user = (name: string, cells: string[], o: Opts = {}): TRow => ({ key: name, cells: [name, ...cells], ...o })
const chip = (key: string, label: string, kind: TChip['kind'] = 'run'): TChip => ({ key, label, kind })
const out = (label: string, text: string, kind?: OutLine['kind']): OutLine => ({ label, text, kind: text === '?' ? 'muted' : kind })
const spec = (tables: TableDef[], code: string[], steps: Record<string, TableStep>): TableSpec => ({ tables, code, outputName: 'Outcome', steps })

// ---- PBKDF2 ----
const SAME = chip('same', 'Alice and Bob: same password')
const PBKDF2 = chip('kdf', 'PBKDF2-HMAC-SHA512 × 100,000')
const salted = (alice: string, bob: string) => [user('alice', ['9f2c…', alice]), user('bob', ['07de…', bob])]
const HASHED = salted('41ab…', 'c3e9…')
const STORED = out('Stored for alice', 'AQAAAAIAAYagAAAAENuKeiSf…')
const guesses = (cost: string, found: Opts = {}): TRow[] => [
  { key: 'g1', cells: ['123456', 'no'], mark: cost, markKind: 'muted' },
  { key: 'g2', cells: ['password', 'no'], mark: cost, markKind: 'muted' },
  { key: 'g3', cells: ['Summer2024', 'yes'], mark: cost, ...found },
]

// ---- Salted SHA-256 ----
const SHA_ROWS = salted('5e88…', 'a1f0…')
const SHA_CHIP = chip('sha', 'SHA-256(salt + password)')

// ---- AES ----
const ENCRYPTED = [user('alice', ['AES: 8c1d…']), user('bob', ['AES: f27a…'])]

// ---- HMAC, no salt ----
const HMAC_CHIP = chip('hmac', 'HMAC-SHA256(key, password)')

const SPECS: Record<string, TableSpec> = {
  setup: spec([USERS_PLAIN], SETUP_CODE, {
    signup: { tables: { users: [user('alice', ['?'], { kind: 'muted' })] }, line: [1, 3] },
    question: { tables: { users: [user('alice', ['?'], { kind: 'muted' })] }, line: 2 },
  }),
  hash: spec([USERS_SALTED, GUESSES], HASH_CODE, {
    salt: { tables: { users: salted('…', '…') }, chips: [SAME, chip('salt', 'random salt per user')], line: H.HASH },
    derive: { tables: { users: HASHED }, chips: [SAME, chip('salt', 'random salt per user'), PBKDF2], line: H.HASH, output: [out('Alice and Bob', 'different hashes', 'ok')] },
    store: { tables: { users: HASHED }, chips: [SAME, chip('salt', 'random salt per user'), PBKDF2], line: H.HASH, output: [out('Alice and Bob', 'different hashes', 'ok'), STORED] },
    verify: {
      tables: { users: HASHED },
      chips: [SAME, chip('salt', 'random salt per user'), PBKDF2],
      line: H.VERIFY,
      output: [out('Alice and Bob', 'different hashes', 'ok'), STORED, out('Sign-in', 'PasswordVerificationResult.Success', 'ok')],
    },
    leak: {
      tables: { users: HASHED, guess: guesses('100,000 iterations') },
      chips: [SAME, chip('salt', 'random salt per user'), PBKDF2, chip('cost', 'each guess is slow, per salt', 'ok')],
      line: null,
      output: [out('Alice and Bob', 'different hashes', 'ok'), STORED],
    },
  }),

  'sha-claim': spec([USERS_SALTED], SHA_CODE, {
    store: { tables: { users: SHA_ROWS }, chips: [SHA_CHIP], line: [0, 2] },
    safe: { tables: { users: SHA_ROWS }, chips: [SHA_CHIP, chip('safe', 'no known collisions, so safe', 'bad')], line: 2 },
  }),
  'sha-reality': spec([USERS_SALTED, GUESSES], SHA_CODE, {
    store: { tables: { users: SHA_ROWS }, chips: [SHA_CHIP], line: [0, 2] },
    leak: { tables: { users: SHA_ROWS, guess: guesses('1 SHA-256') }, chips: [SHA_CHIP, chip('nocoll', 'no collision needed')], line: 2 },
    fast: {
      tables: { users: SHA_ROWS, guess: guesses('1 SHA-256', { kind: 'bad', mark: 'found', markKind: 'bad' }) },
      chips: [SHA_CHIP, chip('nocoll', 'no collision needed'), chip('fast', 'GPUs: billions of guesses per second', 'bad')],
      line: 2,
      bad: true,
    },
  }),

  'aes-claim': spec([USERS_PLAIN], AES_CODE, {
    store: { tables: { users: ENCRYPTED }, chips: [chip('kv', 'key in Azure Key Vault')], line: [0, 1] },
    recover: {
      tables: { users: ENCRYPTED },
      chips: [chip('kv', 'key in Azure Key Vault')],
      line: 4,
      bad: true,
      output: [out('Support', 'recovers Summer2024', 'bad')],
    },
  }),
  'aes-reality': spec([USERS_PLAIN], AES_CODE, {
    store: { tables: { users: ENCRYPTED }, chips: [chip('kv', 'key in Azure Key Vault')], line: [0, 1] },
    reverse: {
      tables: { users: [user('alice', ['Summer2024'], { kind: 'bad', mark: 'decrypted', markKind: 'bad' }), user('bob', ['Summer2024'], { kind: 'bad', mark: 'decrypted', markKind: 'bad' })] },
      chips: [chip('kv', 'key in Azure Key Vault'), chip('who', 'whoever has the key or the code', 'bad')],
      line: 4,
      bad: true,
      output: [out('Every password', 'readable', 'bad')],
    },
    reset: {
      tables: { users: [user('alice', ['one-way hash'], { kind: 'hit' }), user('bob', ['one-way hash'], { kind: 'hit' })] },
      chips: [chip('reset', 'forgotten: send a reset link', 'ok')],
      line: null,
      output: [out('Forgotten password', 'reset, not recovered', 'ok')],
    },
  }),

  'hmac-claim': spec([USERS_PLAIN], HMAC_CODE, {
    store: { tables: { users: [user('alice', ['b7c2…'])] }, chips: [HMAC_CHIP, chip('nosalt', 'no salt')], line: 1 },
    tables: { tables: { users: [user('alice', ['b7c2…'])] }, chips: [HMAC_CHIP, chip('nosalt', 'no salt'), chip('rainbow', 'the key beats rainbow tables: salt not needed', 'bad')], line: 1 },
  }),
  'hmac-reality': spec([USERS_PLAIN, GUESSES], HMAC_CODE, {
    store: {
      tables: { users: [user('alice', ['b7c2…'], { kind: 'bad' }), user('bob', ['b7c2…'], { kind: 'bad', mark: 'same as alice', markKind: 'bad' })] },
      chips: [HMAC_CHIP, chip('nosalt', 'no salt'), SAME],
      line: 1,
      bad: true,
    },
    key: {
      tables: {
        users: [user('alice', ['b7c2…'], { kind: 'bad' }), user('bob', ['b7c2…'], { kind: 'bad', mark: 'same as alice', markKind: 'bad' })],
        guess: guesses('1 HMAC', { kind: 'bad', mark: 'found, Bob too', markKind: 'bad' }),
      },
      chips: [HMAC_CHIP, chip('nosalt', 'no salt'), SAME, chip('stolen', 'key stolen: fast brute force', 'bad')],
      line: 0,
      bad: true,
    },
  }),
}

const drawing: QuestionDrawing = Object.fromEntries(
  Object.entries(SPECS).map(([stage, s]) => [stage, (p: StageDrawingProps) => <TableStage spec={s} {...p} />]),
)
export default drawing
