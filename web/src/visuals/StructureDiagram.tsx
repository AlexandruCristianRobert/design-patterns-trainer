import { ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import type { Structure } from '../content/schema'
import { useLinkedLines } from '../features/lesson/LessonContext'
import { ActiveNodeContext } from './activeNode'
import { parallelSlots } from './edgeGeometry'
import { ClassNode, type Activation, type ClassNodeType } from './structureNodes'
import { UmlEdge, UmlMarkers, type UmlEdgeType } from './umlEdges'

const nodeTypes = { umlClass: ClassNode }
const edgeTypes = { uml: UmlEdge }
const fitViewOptions = { padding: 0.1, maxZoom: 1 }

const FINE_POINTER = '(pointer: fine)'
const subscribeFinePointer = (onChange: () => void) => {
  const mq = window.matchMedia?.(FINE_POINTER)
  mq?.addEventListener('change', onChange)
  return () => mq?.removeEventListener('change', onChange)
}
const isFinePointer = () => window.matchMedia?.(FINE_POINTER).matches ?? false

/** A mouse can drag the zoomed diagram around; on touch a drag must keep scrolling the page. */
function useFinePointer(): boolean {
  return useSyncExternalStore(subscribeFinePointer, isFinePointer, () => false)
}

function ZoomControls() {
  const { t } = useTranslation('lesson')
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const duration = useReducedMotion() ? 0 : 150
  const buttons = [
    { label: t('diagram.zoomIn'), icon: ZoomIn, run: () => zoomIn({ duration }) },
    { label: t('diagram.zoomOut'), icon: ZoomOut, run: () => zoomOut({ duration }) },
    { label: t('diagram.fitView'), icon: Maximize, run: () => fitView({ ...fitViewOptions, duration }) },
  ]
  return (
    <div className="diagram-controls" role="group" aria-label={t('diagram.controls')}>
      {buttons.map(({ label, icon: Icon, run }) => (
        <button key={label} type="button" className="icon-btn" aria-label={label} title={label} onClick={() => void run()}>
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

/**
 * The Pattern's class diagram. Read-only: no dragging or connecting, and the page keeps its scroll —
 * zoom only through the buttons; a mouse drag pans to classes moved off-screen by zooming. Hovering or focusing a class explains it and links its example lines.
 */
export function StructureDiagram(props: StructureDiagramProps) {
  return (
    <ReactFlowProvider>
      <Diagram {...props} />
    </ReactFlowProvider>
  )
}

interface StructureDiagramProps {
  structure: Structure
  descriptions: Record<string, string>
}

function Diagram({ structure, descriptions }: StructureDiagramProps) {
  const { t } = useTranslation('lesson')
  const { link } = useLinkedLines()
  const panOnDrag = useFinePointer()
  const markerPrefix = `uml${useId().replace(/:/g, '')}`
  const [pointer, setPointer] = useState<{ hover: string | null; focus: string | null }>({ hover: null, focus: null })
  const current = useRef(pointer)
  const linked = useRef<string | null>(null)

  const onActivate = useCallback(
    (id: string, via: Activation, on: boolean) => {
      const prev = current.current
      // A late blur/leave from a node that is no longer the one recorded must not clear the newer one.
      const next = { ...prev, [via]: on ? id : prev[via] === id ? null : prev[via] }
      current.current = next
      setPointer(next)
      const active = next.hover ?? next.focus
      if (active !== linked.current) {
        linked.current = active
        link(structure.nodes.find((n) => n.id === active)?.codeLines ?? null)
      }
    },
    [link, structure],
  )

  const nodes = useMemo<ClassNodeType[]>(
    () =>
      structure.nodes.map((n) => ({
        id: n.id,
        type: 'umlClass',
        position: { x: n.x, y: n.y },
        data: { node: n, description: descriptions[n.id] ?? '', onActivate },
      })),
    [structure, descriptions, onActivate],
  )
  const edges = useMemo<UmlEdgeType[]>(() => {
    const slots = parallelSlots(structure.edges)
    return structure.edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: 'uml',
      data: { kind: e.kind, label: e.label, markerPrefix, slot: slots.get(e.id) },
    }))
  }, [structure, markerPrefix])
  const active = pointer.hover ?? pointer.focus
  const activeNode = structure.nodes.find((n) => n.id === active)

  return (
    <figure className="structure-diagram" aria-label={t('diagram.label')}>
      <UmlMarkers prefix={markerPrefix} />
      <div className="diagram-scroll">
        <div className="diagram-canvas">
          <ActiveNodeContext.Provider value={active}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={fitViewOptions}
              minZoom={0.3}
              maxZoom={2}
              nodesDraggable={false}
              nodesConnectable={false}
              nodesFocusable={false}
              edgesFocusable={false}
              elementsSelectable={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              panOnScroll={false}
              panOnDrag={panOnDrag}
              preventScrolling={false}
              onNodeMouseEnter={(_, n) => onActivate(n.id, 'hover', true)}
              onNodeMouseLeave={(_, n) => onActivate(n.id, 'hover', false)}
            />
          </ActiveNodeContext.Provider>
        </div>
      </div>
      <div className="diagram-footer">
        <p className="diagram-description" data-testid="diagram-description" aria-live="polite">
          {activeNode ? (
            <>
              <span className="diagram-description-name" data-role={activeNode.role}>
                {activeNode.name}
              </span>
              {descriptions[activeNode.id] ?? ''}
            </>
          ) : (
            <span className="muted">{t('diagram.hint')}</span>
          )}
        </p>
        <ZoomControls />
      </div>
    </figure>
  )
}
