/** A run of one value's text; `changed` runs are where it differs from the other value. An empty changed run marks characters the other value has and this one lacks. */
export interface DiffPart {
  text: string
  changed: boolean
  /** On a changed run: the length of the longer side of this difference, so both rows can give it the same width and stay aligned. */
  width?: number
}

/** Above this many character pairs the comparison stops being instant, so the values are marked as one change. */
const MAX_CELLS = 4_000_000
/** Below this share of characters in common, a character-level diff is noise: mark the values as one change. */
const MIN_SHARED = 0.4

function whole(expected: string[], actual: string[]) {
  return { expected: [{ text: expected.join(''), changed: true }], actual: [{ text: actual.join(''), changed: true }] }
}

/**
 * Character-level diff of expected and actual (longest common subsequence),
 * so each place they differ is marked on its own: one missing space shows as
 * one gap, not as everything between the first and last difference.
 */
export function diffValues(expected: string, actual: string): { expected: DiffPart[]; actual: DiffPart[] } {
  const e = Array.from(expected)
  const a = Array.from(actual)
  const n = e.length
  const m = a.length
  if ((n + 1) * (m + 1) > MAX_CELLS) return whole(e, a)

  // lcs[i][j]: length of the longest common subsequence of e[i..] and a[j..].
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = e[i] === a[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  if (n > 0 && m > 0 && lcs[0][0] < MIN_SHARED * Math.max(n, m)) return whole(e, a)

  const out = { expected: [] as DiffPart[], actual: [] as DiffPart[] }
  const keep = (side: DiffPart[], text: string) => {
    const last = side[side.length - 1]
    if (last && !last.changed) last.text += text
    else side.push({ text, changed: false })
  }
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && e[i] === a[j]) {
      keep(out.expected, e[i++])
      keep(out.actual, a[j++])
      continue
    }
    // Collect one hunk: everything up to the next shared character.
    let removed = ''
    let added = ''
    while ((i < n || j < m) && !(i < n && j < m && e[i] === a[j])) {
      if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1])) removed += e[i++]
      else added += a[j++]
    }
    const width = Math.max(Array.from(removed).length, Array.from(added).length)
    out.expected.push({ text: removed, changed: true, width })
    out.actual.push({ text: added, changed: true, width })
  }
  return out
}

/** Makes whitespace in a differing run visible: a space, tab or line break would otherwise be an invisible difference. */
export function showWhitespace(text: string): string {
  return text.replace(/ /g, '·').replace(/\t/g, '→').replace(/\r?\n/g, '↵')
}
