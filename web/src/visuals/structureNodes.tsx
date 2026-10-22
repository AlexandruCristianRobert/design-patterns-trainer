import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { useContext, useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { StructureNode } from '../content/schema'
import { ActiveNodeContext } from './activeNode'

export type Activation = 'hover' | 'focus'

export type ClassNodeData = {
  node: StructureNode
  description: string
  onActivate(id: string, via: Activation, on: boolean): void
}

export type ClassNodeType = Node<ClassNodeData, 'umlClass'>

/**
 * A UML class box: optional «stereotype», the class name in its role colour, then its members in mono.
 * Focusable itself (React Flow's own node focus is off) so keyboard focus reveals the same description
 * as hover (which the diagram tracks through React Flow, so the node keeps its pointer events).
 */
export function ClassNode({ data }: NodeProps<ClassNodeType>) {
  const { t } = useTranslation('lesson')
  const { node, description, onActivate } = data
  const active = useContext(ActiveNodeContext) === node.id
  const descId = useId()
  const stereotype = node.stereotype && t(`diagram.stereotype.${node.stereotype}`)
  return (
    <div
      className="uml-class"
      data-testid={`class-${node.id}`}
      data-role={node.role}
      data-stereotype={node.stereotype}
      data-active={active || undefined}
      tabIndex={0}
      role="group"
      aria-roledescription={t('diagram.classRole')}
      aria-label={stereotype ? t('diagram.stereotypeLabel', { name: node.name, stereotype }) : node.name}
      aria-describedby={descId}
      onFocus={() => onActivate(node.id, 'focus', true)}
      onBlur={() => onActivate(node.id, 'focus', false)}
    >
      {/* Edges attach to these; the UML edges draw from the box outline, so the handles stay invisible. */}
      <Handle type="target" position={Position.Top} isConnectable={false} className="uml-handle" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="uml-handle" />
      <div className="uml-class-head">
        {stereotype && <span className="uml-stereotype">{stereotype}</span>}
        <span className="uml-class-name">{node.name}</span>
      </div>
      {node.members.length > 0 && (
        <ul className="uml-members">
          {node.members.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <span id={descId} hidden>
        {description}
      </span>
    </div>
  )
}
