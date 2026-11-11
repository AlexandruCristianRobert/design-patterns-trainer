import type { ExamAnswer, ExamSession, HelpUse } from './types'

/** The answer with `use` recorded; the same object when it already was. */
export function withHelp(answer: ExamAnswer, use: HelpUse): ExamAnswer {
  const help = answer.help ?? []
  return help.includes(use) ? answer : { ...answer, help: [...help, use] }
}

/** Some Helper was used on some question of the session. */
export function sessionUsedHelp(session: ExamSession): boolean {
  return Object.values(session.answers).some((a) => (a.help?.length ?? 0) > 0)
}

/** Submitted sessions, split by whether any Helper was used. */
export function helperCounts(sessions: ExamSession[]): { withHelp: number; without: number } {
  let withHelp = 0
  let without = 0
  for (const s of sessions) {
    if (s.status !== 'submitted') continue
    if (sessionUsedHelp(s)) withHelp++
    else without++
  }
  return { withHelp, without }
}
