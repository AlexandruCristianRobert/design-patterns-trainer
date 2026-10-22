import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '../i18n'

afterEach(() => cleanup())

// jsdom has no layout; React Flow only needs these to exist (see reactflow.dev "Testing").
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.DOMMatrixReadOnly ??= class {
  m22 = 1
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([1-9.])\)/)?.[1]
    this.m22 = scale !== undefined ? Number(scale) : 1
  }
} as unknown as typeof DOMMatrixReadOnly
