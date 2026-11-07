import type { StageDrawingProps } from './drawing'
import { RowStage, type RowDef, type RowStep } from './RowStage'

/** A piece of the thread's stack: its share of the stack's size (in %), drawn at least wide enough for its label. */
export interface Seg {
  key: string
  label: string
  size: number
  /** frame: a call frame · buf: a stackalloc buffer · ok/bad: the point the step makes · gone: popped, faded. */
  kind: 'frame' | 'buf' | 'ok' | 'bad' | 'gone'
  /** Takes all the room left in the bar (an allocation that runs past its end). */
  fill?: boolean
}
export interface StackStep extends RowStep {
  segs: Seg[]
  /** The part of an allocation that lies past the end of the stack. */
  over?: string
}

/** The thread stack as one bar (its right end is the stack's size limit), above rows of chips and the code. sized: name the size and mark the ends. */
export function StackStage({ steps, rows, code, sized, stepIds, stepIndex, reduced }: { steps: Record<string, StackStep>; rows: RowDef[]; code: string[]; sized: boolean } & StageDrawingProps) {
  for (const id of stepIds) if (!steps[id]) throw new Error(`no drawing for step "${id}"`)
  const step = steps[stepIds[stepIndex]]
  const prev = stepIndex > 0 ? steps[stepIds[stepIndex - 1]] : undefined
  const isNow = (s: Seg) => !!prev && !prev.segs.some((p) => p.key === s.key && p.label === s.label && p.kind === s.kind)
  return (
    <div className={`qv-stack-stage${reduced ? ' is-reduced' : ''}`}>
      <div className="qv-stack">
        <div className="qv-stack-name">
          Thread stack<small>{sized ? 'fixed size, typically about 1 MB' : 'this request’s thread'}</small>
        </div>
        <div className="qv-stack-line">
          <div className={`qv-stack-bar${step.over ? ' is-full' : ''}`}>
            {step.segs.map((s) => (
              <span key={s.key} className={`qv-stack-seg is-${s.kind}${s.fill ? ' is-fill' : ''}${isNow(s) ? ' is-now' : ''}`} style={{ flexBasis: `${s.size}%` }}>
                {s.label}
              </span>
            ))}
          </div>
          {step.over && <span className={`qv-stack-over${prev?.over !== step.over ? ' is-now' : ''}`}>{step.over}</span>}
        </div>
        {sized && (
          <div className="qv-stack-ends">
            <span>start</span>
            <span>end of the stack</span>
          </div>
        )}
      </div>
      <RowStage spec={{ rows, code, steps }} stepIds={stepIds} stepIndex={stepIndex} reduced={reduced} />
    </div>
  )
}
