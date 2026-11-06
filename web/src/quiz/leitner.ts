export type Box = 1 | 2 | 3 | 4 | 5
export interface BoxRecord {
  questionId: string
  box: Box
  /** ISO timestamp of the last submitted answer. */
  lastAnsweredAt: string
}
export type QuestionState = 'new' | 'due' | 'waiting'

export const BOX_WAIT_DAYS: Record<Box, number> = { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 }
const DAY_MS = 86_400_000

/** Spec §4: a New question goes to Box 2 when right, Box 1 when wrong; then +1 (max 5) when right, 1 when wrong. */
export function nextBox(prev: Box | undefined, correct: boolean): Box {
  if (!correct) return 1
  if (prev === undefined) return 2
  return Math.min(5, prev + 1) as Box
}

export function dueAtMs(r: BoxRecord): number {
  return Date.parse(r.lastAnsweredAt) + BOX_WAIT_DAYS[r.box] * DAY_MS
}

export function stateOf(r: BoxRecord | undefined, now: Date): QuestionState {
  if (!r) return 'new'
  return now.getTime() >= dueAtMs(r) ? 'due' : 'waiting'
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Spec §4 selection: Due (most overdue first), then New (random), then waiting (closest to Due first); the result is shuffled. */
export function selectQuiz(
  ids: readonly string[],
  boxes: ReadonlyMap<string, BoxRecord>,
  count: number,
  now: Date,
  rng: () => number,
): string[] {
  const due: BoxRecord[] = []
  const waiting: BoxRecord[] = []
  const fresh: string[] = []
  for (const id of ids) {
    const r = boxes.get(id)
    const s = stateOf(r, now)
    if (s === 'new') fresh.push(id)
    else (s === 'due' ? due : waiting).push(r!)
  }
  const byDue = (a: BoxRecord, b: BoxRecord) => dueAtMs(a) - dueAtMs(b)
  const ordered = [
    ...due.sort(byDue).map((r) => r.questionId),
    ...shuffle(fresh, rng),
    ...waiting.sort(byDue).map((r) => r.questionId),
  ]
  return shuffle(ordered.slice(0, Math.max(0, count)), rng)
}
