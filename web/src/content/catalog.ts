import { z } from 'zod'
import catalogYaml from '../../../content/catalog.yaml'
import { getBuiltPatternIds } from './patterns'
import { parseContent, schemas } from './schema'
import type { CatalogEntry, CatalogText } from './schema'
import { loadText } from './text'
import type { Localized } from './text'

export interface CatalogItem extends CatalogEntry { built: boolean }

export function getCatalog(): CatalogItem[] {
  const entries = parseContent(z.array(schemas.catalog), catalogYaml, 'catalog.yaml')
  const built = new Set(getBuiltPatternIds())
  return entries.map((e) => ({ ...e, built: built.has(e.id) }))
}

export function getCatalogText(id: string, lng: string): Localized<CatalogText> {
  const r = loadText(z.record(z.string(), schemas.catalogText), '', 'catalog.text', lng)
  const value = r.value[id]
  if (!value) throw new Error(`content/catalog.text.${r.untranslated ? 'en' : lng}.yaml: no entry for ${id}`)
  return { value, untranslated: r.untranslated }
}
