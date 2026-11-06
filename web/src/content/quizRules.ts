import type { QuizQuestion, QuizTopic } from './quiz'

/** M1 floor per topic; M2 raises it to each topic's target (spec §3.1). */
export const QUIZ_TOPIC_MIN = 2
export const LONGEST_CORRECT_MAX_SHARE = 0.4
export const SHORTEST_CORRECT_MAX_SHARE = 0.4

/** Spec §3.1 targets, each including the M1 seed questions. The shipped-bank test switches from QUIZ_TOPIC_MIN to these in Task 13. */
export const QUIZ_TOPIC_TARGETS: Record<string, number> = {
  'csharp-language': 50, 'clr-memory': 40, 'async-concurrency': 45, 'collections-linq': 40, 'aspnet-core': 50,
  'efcore-data': 40, 'architecture-design': 40, testing: 30, 'web-distributed': 35, 'security-performance': 30,
}

// "of these/those/them" is anchored to the option start so ordinary prose ("changing all of them") stays legal.
const ALL_NONE = /\b(all|none|both|neither) of the (above|others)\b|^\s*(all|none|both|neither) of (the )?(above|others|these|those|them)\b/i
// Letters are shuffled at display time, so explanations must not name one.
// Case-sensitive capitals keep "A task is…" legal; "option"/"choice" + a lowercase letter is also caught.
const LETTER_REF = /\b(?:[Oo]ption|[Aa]nswer|[Cc]hoice)\s+[A-D]\b|\b(?:[Oo]ption|[Cc]hoice)\s+[a-d]\b|\([A-D]\)|\b[A-D]\)\s|\b[A-D] is\b|(?:^|\s)[B-D]\.(?=\s|$)/

// Emphasis markup is not rendered (spec §3.2: code markup only), so it would show as literal asterisks.
const EMPHASIS = /\*\*|\*[^\s*][^*]*\*/
function outsideCode(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
}

/** Problems with one question; an empty list means it is fine. */
export function questionProblems(q: QuizQuestion): string[] {
  const out: string[] = []
  for (const o of q.options) {
    if (ALL_NONE.test(o.text)) out.push(`${q.id}: option "${o.text}" is an all/none/both-of-the-above option`)
    if (o.text.includes('```')) out.push(`${q.id}: option text may use inline code only`)
  }
  const prose = [q.question, ...q.options.flatMap((o) => [o.text, o.explanation])]
  if (prose.some((p) => EMPHASIS.test(outsideCode(p)))) out.push(`${q.id}: emphasis markup (*…*) is not supported; use plain text or \`code\``)
  if (q.options.some((o) => LETTER_REF.test(o.explanation))) out.push(`${q.id}: an explanation refers to an option by letter`)
  if (new Set(q.options.map((o) => o.text.trim())).size !== q.options.length) out.push(`${q.id}: two options have the same text`)
  return out
}

/** Problems with the whole bank: per-question rules, unique ids, file/topic agreement, per-topic floor. */
export function bankProblems(bank: QuizQuestion[], topics: QuizTopic[], fileIds: string[], minFor: (topicId: string) => number): string[] {
  const out = bank.flatMap(questionProblems)
  const seen = new Set<string>()
  for (const q of bank) {
    if (seen.has(q.id)) out.push(`duplicate question id "${q.id}"`)
    seen.add(q.id)
  }
  const topicIds = new Set<string>()
  for (const t of topics) {
    if (topicIds.has(t.id)) out.push(`duplicate topic id "${t.id}" in topics.yaml`)
    topicIds.add(t.id)
  }
  for (const t of topics) {
    if (!fileIds.includes(t.id)) out.push(`topic "${t.id}" has no file content/quiz/${t.id}.en.yaml`)
    const n = bank.filter((q) => q.topicId === t.id).length
    const min = minFor(t.id)
    if (n < min) out.push(`topic "${t.id}" has ${n} questions, needs at least ${min}`)
  }
  for (const f of fileIds) if (!topicIds.has(f)) out.push(`content/quiz/${f}.en.yaml is not listed in topics.yaml`)
  return out
}

/** Share of questions whose correct option is strictly longer than each of the other three. */
export function longestCorrectShare(bank: QuizQuestion[]): number {
  if (bank.length === 0) return 0
  const longest = bank.filter((q) => {
    const c = q.options.find((o) => o.correct)!.text.length
    return q.options.every((o) => o.correct || o.text.length < c)
  }).length
  return longest / bank.length
}

/** Share of questions whose correct option is strictly shorter than each of the other three. */
export function shortestCorrectShare(bank: QuizQuestion[]): number {
  if (bank.length === 0) return 0
  const shortest = bank.filter((q) => {
    const c = q.options.find((o) => o.correct)!.text.length
    return q.options.every((o) => o.correct || o.text.length > c)
  }).length
  return shortest / bank.length
}
