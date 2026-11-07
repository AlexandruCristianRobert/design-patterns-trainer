/** A code line (0-based), an inclusive line range, or several separate lines/ranges to highlight; null highlights nothing. */
export type LineAt = number | [number, number] | { each: (number | [number, number])[] } | null

const ranges = (line: LineAt): [number, number][] =>
  line === null ? [] : typeof line === 'number' ? [[line, line]] : !Array.isArray(line) ? line.each.flatMap((l) => ranges(l)) : [line]

/** The code under a stage drawing, with the line the caption is about highlighted (bad: it marks a failure). */
export function CodePanel({ code, line, bad = false }: { code: string[]; line: LineAt; bad?: boolean }) {
  const on = ranges(line)
  return (
    <pre className="qv-code">
      {code.map((text, i) => (
        <span key={i} className={on.some(([from, to]) => i >= from && i <= to) ? `qv-line is-on${bad ? ' is-bad' : ''}` : 'qv-line'}>
          {text || ' '}
          {'\n'}
        </span>
      ))}
    </pre>
  )
}
