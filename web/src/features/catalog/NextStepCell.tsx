import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getPattern } from '../../content/patterns'
import { nextStep } from '../../progress/nextStep'
import type { PatternProgress } from '../../progress/progressStore'

export function NextStepCell({ patternId, progress }: { patternId: string; progress: PatternProgress }) {
  const { t } = useTranslation('catalog')
  const step = nextStep(getPattern(patternId)!.meta, progress)
  const to =
    step.kind === 'examReady'
      ? `/exam?pattern=${patternId}`
      : step.kind === 'readLesson'
        ? `/patterns/${patternId}`
        : `/patterns/${patternId}/practice/${step.exerciseId}`
  const label =
    step.kind === 'examReady' ? t('next.examReady') : step.kind === 'readLesson' ? t('next.readLesson') : t('next.exercise', { index: step.index + 1 })
  return (
    <Link className="next-step" to={to}>
      {label}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  )
}
