import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { StageDrawingProps } from './drawing'
import { CodePanel, type LineAt } from './CodePanel'
import type { Tone } from './RowStage'

/** inline: a value stored inside its container · ok/bad: the point the step makes · muted: stale or unknown. */
export type FieldKind = 'plain' | 'inline' | 'ok' | 'bad' | 'muted'
export interface Field {
  name: string
  value?: string
  /** The id of the box this field points at: drawn as an arrow. */
  ref?: string
  kind?: FieldKind
}
/** plain · gone: popped or freed, faded · bad/ok: the box the step is about. */
export type BoxKind = 'plain' | 'gone' | 'bad' | 'ok'
export interface Box {
  id: string
  region: string
  title: string
  sub?: string
  fields?: Field[]
  kind?: BoxKind
}
export interface Region {
  id: string
  name: string
  sub?: string
  tone: Tone
  /** Lay the region's boxes out in a wrapping grid instead of one column. */
  wrap?: boolean
}
export interface OutLine {
  label: string
  text: string
  kind?: 'plain' | 'ok' | 'bad' | 'muted'
}
export interface GraphStep {
  boxes: Box[]
  line?: LineAt
  /** The highlighted code line marks a failure. */
  bad?: boolean
  output?: OutLine[]
}
export interface GraphSpec {
  regions: Region[]
  code?: string[]
  /** Heading of the output strip, e.g. "Console". */
  outputName?: string
  steps: Record<string, GraphStep>
}

interface Arrow { d: string; now: boolean; bad: boolean }

const fieldSame = (a: Field, b: Field) => a.value === b.value && a.ref === b.ref && (a.kind ?? 'plain') === (b.kind ?? 'plain')

/** Memory as boxes in regions (stack, heap, …) with fields; reference fields draw arrows to their target box. */
export function BoxGraph({ spec, stepIds, stepIndex, reduced }: { spec: GraphSpec } & StageDrawingProps) {
  for (const id of stepIds) if (!spec.steps[id]) throw new Error(`no drawing for step "${id}"`)
  const regionIds = new Set(spec.regions.map((r) => r.id))
  for (const [id, s] of Object.entries(spec.steps)) {
    const boxIds = new Set(s.boxes.map((b) => b.id))
    for (const b of s.boxes) {
      if (!regionIds.has(b.region)) throw new Error(`step "${id}": box "${b.id}" is in unknown region "${b.region}"`)
      for (const f of b.fields ?? []) if (f.ref && !boxIds.has(f.ref)) throw new Error(`step "${id}": ${b.id}.${f.name} points at missing box "${f.ref}"`)
    }
  }
  const step = spec.steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? spec.steps[stepIds[stepIndex - 1]] : undefined
  const prevBox = (id: string) => prev?.boxes.find((b) => b.id === id)
  const boxNow = (b: Box) => {
    if (!prev) return true
    const p = prevBox(b.id)
    return !p || p.title !== b.title || p.region !== b.region || (p.kind ?? 'plain') !== (b.kind ?? 'plain')
  }
  const fieldNow = (b: Box, f: Field) => {
    if (!prev) return false
    const p = prevBox(b.id)?.fields?.find((x) => x.name === f.name)
    return !p || !fieldSame(p, f)
  }
  const outNow = (o: OutLine, i: number) => {
    const p = prev?.output?.[i]
    return !!prev && (!p || p.text !== o.text || p.label !== o.label)
  }

  const canvas = useRef<HTMLDivElement>(null)
  const [arrows, setArrows] = useState<Arrow[]>([])
  const marker = useId().replace(/:/g, '')

  // Arrows are measured from the laid-out boxes: re-measure after every step and whenever the canvas resizes.
  useLayoutEffect(() => {
    const el = canvas.current
    if (!el) return
    const measure = () => {
      const base = el.getBoundingClientRect()
      const next: Arrow[] = []
      let stacked = 0
      for (const src of el.querySelectorAll<HTMLElement>('[data-ref]')) {
        const dst = el.querySelector<HTMLElement>(`[data-box="${src.dataset.ref}"]`)
        if (!dst) continue
        const s = src.getBoundingClientRect()
        const t = dst.getBoundingClientRect()
        const sy = s.top + s.height / 2 - base.top
        let d: string
        if (t.left >= s.right - 2 || t.right <= s.left + 2) {
          // Side by side: leave from the facing side, enter the target's facing side.
          const right = t.left >= s.right - 2
          const sx = (right ? s.right : s.left) - base.left
          const ex = (right ? t.left : t.right) - base.left
          const ey = Math.min(Math.max(sy, t.top - base.top + 12), t.bottom - base.top - 12)
          const dx = (ex - sx) / 2
          d = `M${sx},${sy} C${sx + dx},${sy} ${ex - dx},${ey} ${ex},${ey}`
        } else {
          // Stacked: loop out on the right (each arrow a little further out, so loops stay apart) and come back into the target's right side.
          const sx = s.right - base.left
          const ex = t.right - base.left
          const ey = t.top - base.top + Math.min(16, t.height / 2)
          const out = Math.max(sx, ex) + 12 + 9 * stacked++
          d = `M${sx},${sy} C${out},${sy} ${out},${ey} ${ex},${ey}`
        }
        next.push({ d, now: src.dataset.now === '1', bad: src.dataset.bad === '1' })
      }
      setArrows((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    el.querySelectorAll('[data-box]').forEach((b) => ro.observe(b))
    document.fonts?.ready.then(measure).catch(() => {})
    return () => ro.disconnect()
  }, [stepIndex, stepIds, spec])

  return (
    <div className={`qv-graph${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-canvas" ref={canvas}>
        <div className="qv-regions" style={{ '--qv-regions': spec.regions.length } as CSSProperties}>
          {spec.regions.map((r) => (
            <div key={r.id} className={`qv-region tone-${r.tone}${r.wrap ? ' is-wrap' : ''}`}>
              <div className="qv-region-name">
                {r.name}
                {r.sub && <small>{r.sub}</small>}
              </div>
              {step.boxes
                .filter((b) => b.region === r.id)
                .map((b) => (
                  <div key={b.id} data-box={b.id} className={`qv-box is-${b.kind ?? 'plain'}${boxNow(b) ? ' is-now' : ''}`}>
                    <div className="qv-box-title">
                      {b.title}
                      {b.sub && <small>{b.sub}</small>}
                    </div>
                    {(b.fields ?? []).map((f) => {
                      const now = fieldNow(b, f)
                      return (
                        <div
                          key={f.name}
                          className={`qv-field is-${f.kind ?? 'plain'}${now ? ' is-now' : ''}`}
                          data-ref={f.ref}
                          data-now={f.ref && now ? '1' : undefined}
                          data-bad={f.ref && f.kind === 'bad' ? '1' : undefined}
                        >
                          <span className="qv-field-name">{f.name}</span>
                          <span className="qv-field-value">{f.ref ? (f.value ?? 'ref') : f.value}</span>
                          {f.ref && <span className="qv-field-dot" aria-hidden />}
                        </div>
                      )
                    })}
                  </div>
                ))}
            </div>
          ))}
        </div>
        <svg className="qv-arrows" aria-hidden>
          <defs>
            {['plain', 'now', 'bad'].map((k) => (
              <marker key={k} id={`${marker}-${k}`} className={`qv-arrowhead is-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" />
              </marker>
            ))}
          </defs>
          {arrows.map((a, i) => {
            const k = a.bad ? 'bad' : a.now ? 'now' : 'plain'
            return <path key={i} d={a.d} className={`qv-arrow is-${k}`} markerEnd={`url(#${marker}-${k})`} />
          })}
        </svg>
      </div>
      {step.output && (
        <div className="qv-output">
          {spec.outputName && <div className="qv-output-name">{spec.outputName}</div>}
          {step.output.map((o, i) => (
            <div key={i} className={`qv-out is-${o.kind ?? 'plain'}${outNow(o, i) ? ' is-now' : ''}`}>
              <span className="qv-out-label">{o.label}</span>
              <code>{o.text}</code>
            </div>
          ))}
        </div>
      )}
      {spec.code && <CodePanel code={spec.code} line={step.line ?? null} bad={step.bad} />}
    </div>
  )
}
