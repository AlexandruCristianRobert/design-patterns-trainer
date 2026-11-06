// Prints "<topic>\t<id>\t<first line of question>" for every Quiz Question: the overlap index for authors and reviewers.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const dir = fileURLToPath(new URL('../../content/quiz/', import.meta.url))
const topics = parse(readFileSync(dir + 'topics.yaml', 'utf8'))
for (const t of topics) {
  let questions
  try { questions = parse(readFileSync(`${dir}${t.id}.en.yaml`, 'utf8')) ?? [] } catch (e) { if (e.code === 'ENOENT') continue; throw e }
  for (const q of questions) {
    const line = q.question.split('\n').map((s) => s.trim()).find((s) => s && s !== 'What does this program print?') ?? q.question.trim()
    const first = q.code ? `${line} [output: ${q.code.split('\n').find((s) => s.trim())?.trim()}]` : line
    console.log(`${t.id}\t${q.id}\t${first}`)
  }
}
