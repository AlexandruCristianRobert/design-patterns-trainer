import { getPattern } from '../../content/patterns'
import { getPatternText } from '../../content/text'
import { StructureDiagram } from '../../visuals/StructureDiagram'
import { ScenePlayer } from '../../visuals/scene/ScenePlayer'
import { LessonProvider, useLinkedLines } from '../lesson/LessonContext'

// Dev-only harness (registered only when import.meta.env.DEV) for looking at the Lesson visuals in isolation.
// The example below stands in for the Lesson's code panel, so linked lines can be checked by eye.
function LinkedExample({ source }: { source: string }) {
  const { lines } = useLinkedLines()
  return (
    <pre className="dev-example" data-testid="dev-example">
      {source.split('\n').map((text, i) => {
        const n = i + 1
        const on = lines !== null && n >= lines[0] && n <= lines[1]
        return (
          <span key={n} className={on ? 'dev-line dev-line-on' : 'dev-line'} data-line={n}>
            {String(n).padStart(3, ' ')}  {text}
            {'\n'}
          </span>
        )
      })}
    </pre>
  )
}

export function DevVisualsPage() {
  const pattern = getPattern('observer')!
  const text = getPatternText('observer', 'en').value
  return (
    <LessonProvider>
      <div className="dev-visuals">
        <StructureDiagram structure={pattern.structure} descriptions={text.structure} />
        <ScenePlayer script={pattern.scene} captions={text.scene} />
        <LinkedExample source={pattern.example} />
      </div>
    </LessonProvider>
  )
}
