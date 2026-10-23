import { MDXProvider } from '@mdx-js/react'
import type { MDXComponents, MDXContent } from 'mdx/types'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getCatalog, getCatalogText } from '../../content/catalog'
import { StructureDiagram } from '../../visuals/StructureDiagram'
import { ScenePlayer } from '../../visuals/scene/ScenePlayer'
import { LessonExample } from './LessonExample'
import { useLessonData } from './lessonData'
import { Section } from './Section'

function LessonDiagram() {
  const { pattern, text } = useLessonData()
  return (
    <div className="lesson-wide">
      <StructureDiagram structure={pattern.structure} descriptions={text.structure} />
    </div>
  )
}

function LessonScene() {
  const { pattern, text } = useLessonData()
  return (
    <div className="lesson-wide">
      <ScenePlayer script={pattern.scene} captions={text.scene} />
    </div>
  )
}

/** The Patterns this one is often mistaken for, each with the one sentence that tells them apart. */
function Lookalikes() {
  const { t } = useTranslation('lesson')
  const { pattern, text, lng } = useLessonData()
  const built = new Set(getCatalog().filter((c) => c.built).map((c) => c.id))
  if (pattern.meta.lookalikes.length === 0) return null
  return (
    <>
      <h3>{t('lookalikes')}</h3>
      <ul className="lookalikes">
        {pattern.meta.lookalikes.map((id) => {
          const name = getCatalogText(id, lng).value.name
          return (
            <li key={id}>
              <span className="lookalike-name">{built.has(id) ? <Link to={`/patterns/${id}`}>{name}</Link> : name}</span>
              <span className="lookalike-diff">{text.lookalikes[id]}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

// Available in every lesson.mdx without imports.
const components: MDXComponents = {
  Section,
  StructureDiagram: LessonDiagram,
  InteractionScene: LessonScene,
  LessonExample,
  Lookalikes,
}

export function LessonContent({ Component }: { Component: MDXContent }) {
  return (
    <MDXProvider components={components}>
      <Component />
    </MDXProvider>
  )
}
