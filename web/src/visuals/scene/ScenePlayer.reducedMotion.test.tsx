import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getPattern } from '../../content/patterns'
import { getPatternText } from '../../content/text'
import { ScenePlayer } from './ScenePlayer'

// motion reads the preference once per module graph, so this lives in its own file.
beforeAll(() => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
})

describe('ScenePlayer under prefers-reduced-motion', () => {
  it('shows the call arrow but no travelling token', () => {
    const { scene } = getPattern('observer')!
    render(<ScenePlayer script={scene} captions={getPatternText('observer', 'en').value.scene} />)
    expect(screen.getByTestId('scene-call')).toHaveTextContent('Subscribe(phone)')
    expect(screen.queryByTestId('scene-token')).toBeNull()
  })
})
