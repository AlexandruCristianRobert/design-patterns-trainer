import type { Plugin } from 'vite'
import { parse } from 'yaml'

/** Turns `.yaml` imports into ES modules exporting the parsed document as default. */
export function yamlPlugin(): Plugin {
  return {
    name: 'yaml',
    transform(code, id) {
      if (!/\.ya?ml$/.test(id.split('?')[0])) return null
      return { code: `export default ${JSON.stringify(parse(code))}`, map: null }
    },
  }
}
