import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import type { StructureEdge } from '../content/schema'

export type UmlEdgeData = { kind: StructureEdge['kind']; label?: string; markerPrefix: string }
export type UmlEdgeType = Edge<UmlEdgeData, 'uml'>

type Point = { x: number; y: number }

function centre(n: InternalNode): Point {
  const p = n.internals.positionAbsolute
  return { x: p.x + (n.measured.width ?? 0) / 2, y: p.y + (n.measured.height ?? 0) / 2 }
}

/** Where the line from `node`'s centre towards `toward` leaves `node`'s box. */
function boxExit(node: InternalNode, toward: Point): Point {
  const c = centre(node)
  const w = (node.measured.width ?? 0) / 2
  const h = (node.measured.height ?? 0) / 2
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  if (w === 0 || h === 0 || (dx === 0 && dy === 0)) return c
  const s = 1 / Math.max(Math.abs(dx) / w, Math.abs(dy) / h)
  return { x: c.x + dx * s, y: c.y + dy * s }
}

/** Beside the line's midpoint, never on it: above a mostly horizontal line, right of a mostly vertical one. */
function labelTransform(a: Point, b: Point): string {
  const mid = `translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2}px)`
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? `${mid} translate(-50%, -100%) translateY(-4px)` : `${mid} translate(8px, -50%)`
}

const hollowTriangle = new Set<StructureEdge['kind']>(['realization', 'inheritance'])
const dashed = new Set<StructureEdge['kind']>(['realization', 'dependency', 'creates'])

/** A straight UML relationship between two class-box outlines; the arrowhead and dash follow the kind. */
export function UmlEdge({ id, source, target, data }: EdgeProps<UmlEdgeType>) {
  const { t } = useTranslation('lesson')
  const from = useInternalNode(source)
  const to = useInternalNode(target)
  if (!from || !to || !data) return null
  const a = boxExit(from, centre(to))
  const b = boxExit(to, centre(from))
  const marker = `${data.markerPrefix}-${hollowTriangle.has(data.kind) ? 'triangle' : 'open'}`
  const label = data.label ?? (data.kind === 'creates' ? t('diagram.creates') : undefined)
  return (
    <>
      <BaseEdge
        id={id}
        path={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
        markerEnd={`url(#${marker})`}
        className={`uml-edge uml-edge-${data.kind}`}
        style={dashed.has(data.kind) ? { strokeDasharray: '6 4' } : undefined}
      />
      {label && (
        <EdgeLabelRenderer>
          <span className="uml-edge-label" style={{ transform: labelTransform(a, b) }}>
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
