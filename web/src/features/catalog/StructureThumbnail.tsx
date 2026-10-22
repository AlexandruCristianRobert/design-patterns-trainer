import type { Structure } from '../../content/schema'

const W = 72
const H = 44
const PAD = 4
const BOX_W = 18
const BOX_H = 11

/** Maps `v` from [min, max] onto [lo, hi]; a zero-width range lands in the middle. */
function scale(v: number, min: number, max: number, lo: number, hi: number): number {
  return max === min ? (lo + hi) / 2 : lo + ((v - min) / (max - min)) * (hi - lo)
}

const round = (n: number) => Math.round(n * 10) / 10

/** A static miniature of a Structure Diagram: one role-coloured box per node, one line per edge. */
export function StructureThumbnail({ structure }: { structure: Structure }) {
  const xs = structure.nodes.map((n) => n.x)
  const ys = structure.nodes.map((n) => n.y)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const centre = new Map(
    structure.nodes.map((n) => [
      n.id,
      {
        x: round(scale(n.x, minX, maxX, PAD + BOX_W / 2, W - PAD - BOX_W / 2)),
        y: round(scale(n.y, minY, maxY, PAD + BOX_H / 2, H - PAD - BOX_H / 2)),
      },
    ]),
  )
  return (
    <svg className="thumb" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      {structure.edges.map((e) => {
        const a = centre.get(e.from)
        const b = centre.get(e.to)
        if (!a || !b) return null
        return <line key={e.id} className="thumb-edge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      })}
      {structure.nodes.map((n) => {
        const c = centre.get(n.id)!
        return (
          <rect
            key={n.id}
            data-role={n.role}
            className={`thumb-node role-${n.role}`}
            x={round(c.x - BOX_W / 2)}
            y={round(c.y - BOX_H / 2)}
            width={BOX_W}
            height={BOX_H}
            rx={2}
            strokeDasharray={n.stereotype ? '3 2' : undefined}
          />
        )
      })}
    </svg>
  )
}
