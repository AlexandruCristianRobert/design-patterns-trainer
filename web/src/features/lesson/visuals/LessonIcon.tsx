import { lessonIcons, type LessonIconName } from './icons'

export function LessonIcon({ name, size = 18 }: { name: LessonIconName; size?: number }) {
  const Icon = lessonIcons[name]
  return <Icon size={size} aria-hidden="true" />
}
