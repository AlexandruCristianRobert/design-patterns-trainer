import type { MDXComponents } from 'mdx/types'
import { KeyIdea, Note, Pitfall } from './callouts'
import { Key, Role, Slot } from './inline'

/** Every visual a lesson.mdx can use without imports. Later tasks add to this object. */
export const lessonVisuals: MDXComponents = { Role, Key, Slot, KeyIdea, Note, Pitfall }
