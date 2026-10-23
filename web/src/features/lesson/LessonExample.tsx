import { CircleAlert, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CodePanel } from '../../code/CodePanel'
import { useDraft } from '../../code/useDraft'
import { useLinkedLines } from './LessonContext'
import { useLessonData } from './lessonData'

/**
 * The Lesson's runnable example. The learner's edits are kept as the `lesson:<id>` Draft; "Restore original" puts
 * `example.cs` back. Lines the diagram or the scene point at are highlighted.
 */
export function LessonExample() {
  const { t } = useTranslation('lesson')
  const { patternId, pattern } = useLessonData()
  const { lines } = useLinkedLines()
  const { code, setCode, loaded, stale, saveError, reset } = useDraft(`lesson:${patternId}`, pattern.example, pattern.meta.version)
  const original = code === pattern.example

  return (
    <div className="lesson-wide lesson-example">
      {stale && !original && (
        <p className="lesson-note" role="status">
          {t('example.stale')}
        </p>
      )}
      <CodePanel
        code={code}
        onChange={setCode}
        fileName={t('example.fileName')}
        ariaLabel={t('example.editorLabel')}
        highlightedLines={lines}
        readOnly={!loaded}
        extraActions={
          <button
            type="button"
            className="btn btn-quiet"
            disabled={!loaded || original}
            onClick={() => reset(pattern.example)}
          >
            <RotateCcw size={16} aria-hidden="true" />
            <span>{t('example.restore')}</span>
          </button>
        }
      />
      {saveError && (
        <p className="lesson-note lesson-note-bad" role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          {t('example.saveError')}
        </p>
      )}
    </div>
  )
}
