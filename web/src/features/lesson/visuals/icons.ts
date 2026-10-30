import {
  Bike,
  BookOpen,
  Building2,
  Car,
  ClipboardList,
  Image,
  Lightbulb,
  Lock,
  Mail,
  Mountain,
  Plus,
  Printer,
  Smartphone,
  TrainFront,
  Truck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

export type LessonIconName =
  | 'clipboard'
  | 'truck'
  | 'bike'
  | 'building'
  | 'mountain'
  | 'plus'
  | 'lock'
  | 'lightbulb'
  | 'warning'
  | 'mail'
  | 'smartphone'
  | 'printer'
  | 'car'
  | 'train'
  | 'image'
  | 'book'

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
  mail: Mail,
  smartphone: Smartphone,
  printer: Printer,
  car: Car,
  train: TrainFront,
  image: Image,
  book: BookOpen,
}
