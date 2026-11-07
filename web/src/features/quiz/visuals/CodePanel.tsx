/** A code line (0-based) or inclusive line range to highlight; null highlights nothing. */
export type LineAt = number | [number, number] | null

/** The code under a stage drawing, with the line the caption is about highlighted (bad: it marks a failure). */
export function CodePanel({ code, line, bad = false }: { code: string[]; line: LineAt; bad?: boolean }) {
  const [from, to] = line === null ? [-1, -1] : typeof line === 'number' ? [line, line] : line
  return (
    <pre className="qv-code">
      {code.map((text, i) => (
        <span key={i} className={i >= from && i <= to ? `qv-line is-on${bad ? ' is-bad' : ''}` : 'qv-line'}>
          {text || ' '}
          {'\n'}
        </span>
      ))}
    </pre>
  )
}
