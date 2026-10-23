export type Point = { x: number; y: number }
export type Box = { cx: number; cy: number; w: number; h: number }

/** How far apart neighbouring parallel edges are drawn, in px. */
export const PARALLEL_GAP = 12
/** How far a self-loop reaches out of its box, and how long its stub along the box side is, in px. */
const LOOP_REACH = 48
const LOOP_HALF_SPAN = 12

/** The key two nodes share whichever way an edge between them points. */
export const pairKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)

export type ParallelSlot = { index: number; count: number }

/** For each edge id, its place among the edges joining the same unordered pair of nodes. Self-loops are not parallel to anything. */
export function parallelSlots(edges: { id: string; from: string; to: string }[]): Map<string, ParallelSlot> {
  const groups = new Map<string, string[]>()
  for (const e of edges) {
    if (e.from === e.to) continue
    const key = pairKey(e.from, e.to)
    groups.set(key, [...(groups.get(key) ?? []), e.id])
  }
  const out = new Map<string, ParallelSlot>()
  for (const ids of groups.values()) ids.forEach((id, index) => out.set(id, { index, count: ids.length }))
  return out
}

/** Signed distance along the normal for slot `index` of `count`: 0 when alone, +-6 for a pair. */
export function slotOffset({ index, count }: ParallelSlot): number {
  return count < 2 ? 0 : (index - (count - 1) / 2) * PARALLEL_GAP
}

/** Where a ray from `origin` in direction `d` leaves the box (origin is inside it). */
function clip(box: Box, origin: Point, d: Point): Point {
  const hw = box.w / 2
  const hh = box.h / 2
  const rx = origin.x - box.cx
  const ry = origin.y - box.cy
  const tx = d.x === 0 ? Infinity : ((d.x > 0 ? hw : -hw) - rx) / d.x
  const ty = d.y === 0 ? Infinity : ((d.y > 0 ? hh : -hh) - ry) / d.y
  const t = Math.max(0, Math.min(tx, ty))
  return Number.isFinite(t) ? { x: origin.x + d.x * t, y: origin.y + d.y * t } : origin
}

/**
 * The ends of a straight edge between two boxes, shifted by `offset` along the normal of the line from the
 * box with the smaller id to the other, so that edges between the same pair separate whichever way they point.
 * `swap` is true when `from` is the box with the larger id.
 */
export function edgeEnds(from: Box, to: Box, offset: number, swap: boolean): { a: Point; b: Point } {
  const dx = to.cx - from.cx
  const dy = to.cy - from.cy
  const len = Math.hypot(dx, dy)
  if (len === 0 || offset === 0) {
    const d = { x: dx, y: dy }
    const a = len === 0 ? { x: from.cx, y: from.cy } : clip(from, { x: from.cx, y: from.cy }, d)
    const b = len === 0 ? { x: to.cx, y: to.cy } : clip(to, { x: to.cx, y: to.cy }, { x: -dx, y: -dy })
    return { a, b }
  }
  // Normal of the canonical direction, so reversed edges share one frame.
  const sign = swap ? -1 : 1
  const nx = (-dy / len) * sign
  const ny = (dx / len) * sign
  const s = { x: nx * offset, y: ny * offset }
  const a = clip(from, { x: from.cx + s.x, y: from.cy + s.y }, { x: dx, y: dy })
  const b = clip(to, { x: to.cx + s.x, y: to.cy + s.y }, { x: -dx, y: -dy })
  return { a, b }
}

/** A small loop leaving and re-entering the right side of the box, and where its label sits beside it. */
export function selfLoop(box: Box): { path: string; label: Point } {
  const x = box.cx + box.w / 2
  const y1 = box.cy - LOOP_HALF_SPAN
  const y2 = box.cy + LOOP_HALF_SPAN
  const out = x + LOOP_REACH
  return {
    path: `M ${x} ${y1} C ${out} ${y1 - 18}, ${out} ${y2 + 18}, ${x} ${y2}`,
    label: { x: x + LOOP_REACH * 0.75 + 6, y: box.cy },
  }
}
