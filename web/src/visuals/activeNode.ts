import { createContext } from 'react'

/**
 * The hovered or focused class. Kept out of node data on purpose: rebuilding the nodes while focus moves between
 * class boxes makes React Flow re-insert them, and the browser drops focus to the body.
 */
export const ActiveNodeContext = createContext<string | null>(null)
