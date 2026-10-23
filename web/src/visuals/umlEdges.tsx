import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { StructureEdge } from '../content/schema'
import { edgeEnds, selfLoop, slotOffset, type Box, type ParallelSlot, type Point } from './edgeGeometry'

export type UmlEdgeData = { kind: StructureEdge['kind']; label?: string; markerPrefix: string; slot?: ParallelSlot }
export type UmlEdgeType = Edge<UmlEdgeData, 'uml'>

function box(n: InternalNode): Box {
  const p = n.internals.positionAbsolute
  const w = n.measured.width ?? 0
  const h = n.measured.height ?? 0
  return { cx: p.x + w / 2, cy: p.y + h / 2, w, h }
}

/** Beside the line's midpoint, never on it: above a mostly horizontal line, right of a mostly vertical one. */
function labelTransform(a: Point, b: Point): string {
  const mid = `translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2}px)`
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? `${mid} translate(-50%, -100%) translateY(-4px)` : `${mid} translate(8px, -50%)`
}

/** Right of a self-loop, centred on the box's middle. */
function loopLabelTransform(at: Point): string {
  return `translate(${at.x}px, ${at.y}px) translate(0, -50%)`
}

const hollowTriangle = new Set<StructureEdge['kind']>(['realization', 'inheritance'])
const dashed = new Set<StructureEdge['kind']>(['realization', 'dependency', 'creates'])

/** A straight UML relationship between two class-box outlines (a small loop for a class related to itself; parallel edges drawn side by side); the arrowhead and dash follow the kind. */
export function UmlEdge({ id, source, target, data }: EdgeProps<UmlEdgeType>) {
  const { t } = useTranslation('lesson')
  const from = useInternalNode(source)
  const to = useInternalNode(target)
  if (!from || !to || !data) return null
  const self = source === target
  const loop = self ? selfLoop(box(from)) : null
  const ends = self ? null : edgeEnds(box(from), box(to), data.slot ? slotOffset(data.slot) : 0, source > target)
  const marker = `${data.markerPrefix}-${hollowTriangle.has(data.kind) ? 'triangle' : 'open'}`
  const label = data.label ?? (data.kind === 'creates' ? t('diagram.creates') : undefined)
  return (
    <>
      <BaseEdge
        id={id}
        path={loop ? loop.path : `M ${ends!.a.x} ${ends!.a.y} L ${ends!.b.x} ${ends!.b.y}`}
        markerEnd={`url(#${marker})`}
        className={`uml-edge uml-edge-${data.kind}`}
        style={dashed.has(data.kind) ? { strokeDasharray: '6 4' } : undefined}
      />
      {label && (
        <EdgeLabelRenderer>
          <span className="uml-edge-label" style={{ transform: loop ? loopLabelTransform(loop.label) : labelTransform(ends!.a, ends!.b) }}>
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

/** Arrowhead definitions the edges reference by `${prefix}-open` and `${prefix}-triangle`. */
export function UmlMarkers({ prefix }: { prefix: string }) {
  return (
    <svg className="uml-markers" aria-hidden="true" focusable="false">
      <defs>
        <marker id={`${prefix}-open`} viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M1 1 L11 6 L1 11" className="uml-marker-open" />
        </marker>
        <marker id={`${prefix}-triangle`} viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M1 1 L13 7 L1 13 Z" className="uml-marker-triangle" />
        </marker>
      </defs>
    </svg>
  )
}
