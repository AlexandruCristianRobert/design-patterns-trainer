// Lessons (`lesson.<locale>.mdx`) compile to a component through @mdx-js/rollup (see vite.config.ts).
declare module '*.mdx' {
  import type { MDXContent } from 'mdx/types'
  const Component: MDXContent
  export default Component
}
