import type { QuizQuestion, QuizTopic } from './quiz'

/** M1 floor per topic; M2 raises it to each topic's target (spec §3.1). */
export const QUIZ_TOPIC_MIN = 2
export const LONGEST_CORRECT_MAX_SHARE = 0.4

const ALL_NONE = /\b(all|none|both) of the (above|others)\b/i
// Letters are shuffled at display time, so explanations must not name one. Case-sensitive: "A struct is…" stays legal.
const LETTER_REF = /\b(?:[Oo]ption|[Aa]nswer|[Cc]hoice)\s+[A-D]\b|\b[A-D]\)\s|\b[A-D] is\b/

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
export function bankProblems(bank: QuizQuestion[], topics: QuizTopic[], fileIds: string[], minPerTopic: number): string[] {
  const out = bank.flatMap(questionProblems)
  const seen = new Set<string>()
  for (const q of bank) {
    if (seen.has(q.id)) out.push(`duplicate question id "${q.id}"`)
    seen.add(q.id)
  }
  const topicIds = new Set(topics.map((t) => t.id))
  for (const t of topics) {
    if (!fileIds.includes(t.id)) out.push(`topic "${t.id}" has no file content/quiz/${t.id}.en.yaml`)
    const n = bank.filter((q) => q.topicId === t.id).length
    if (n < minPerTopic) out.push(`topic "${t.id}" has ${n} questions, needs at least ${minPerTopic}`)
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
