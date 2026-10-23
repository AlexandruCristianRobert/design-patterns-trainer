import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from './App'

describe('AppRoutes', () => {
  it.each(['/nope', '/patterns/observer/practice/complete/extra'])('shows a not-found state for %s', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: "This page doesn't exist" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to the Catalog' })).toHaveAttribute('href', '/')
  })
})
