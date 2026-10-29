import { Bike, Building2, ClipboardList, Lightbulb, Lock, Mountain, Plus, Truck, TriangleAlert, type LucideIcon } from 'lucide-react'

export type LessonIconName = 'clipboard' | 'truck' | 'bike' | 'building' | 'mountain' | 'plus' | 'lock' | 'lightbulb' | 'warning'

/** The icons a Lesson may name in `icon="…"`. */
export const lessonIcons: Record<LessonIconName, LucideIcon> = {
  clipboard: ClipboardList,
  truck: Truck,
  bike: Bike,
  building: Building2,
  mountain: Mountain,
  plus: Plus,
  lock: Lock,
  lightbulb: Lightbulb,
  warning: TriangleAlert,
}

export function LessonIcon({ name, size = 18 }: { name: LessonIconName; size?: number }) {
  const Icon = lessonIcons[name]
  return <Icon size={size} aria-hidden="true" />
}
