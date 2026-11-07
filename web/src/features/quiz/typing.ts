/** Keys belong to a text field while one has focus (radios are fine: they are the options). */
export function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLInputElement) return target.type !== 'radio' && target.type !== 'checkbox'
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}
