import { createContext } from 'react'

/**
 * Split from AuthProvider.jsx so the module exports only a context object.
 * A file that exports both a component and a non-component breaks React Fast
 * Refresh, which then silently stops updating the provider during development.
 */
export const AuthContext = createContext(null)
