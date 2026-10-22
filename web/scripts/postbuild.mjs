// GitHub Pages: SPA fallback (404.html) and .nojekyll (the _framework folder starts with an underscore).
import { copyFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'))
writeFileSync(join(dist, '.nojekyll'), '')
