/**
 * =============================================================================
 * features/auth — public API
 * =============================================================================
 *
 * This file is the module's boundary. Host applications and the rest of this
 * app import from `features/auth`, never from its internals (architecture B.3).
 * Keeping the boundary explicit is what makes the module portable: everything
 * reachable from here is a promise, everything else is free to change.
 *
 * NOTHING IS EXPORTED YET. Milestone 2 builds project structure only — there
 * are no authentication flows, no AuthProvider, no hooks and no services. The
 * file exists now so that the import boundary is established before there is
 * anything to import, rather than being retrofitted once call sites already
 * reach into internals.
 *
 * Planned surface, by milestone:
 *   Milestone 4  AuthProvider, useAuth, authService
 *   Milestone 6  ProtectedRoute, PublicOnlyRoute
 *   Milestone 7  profileService
 *   Milestone 10 useRole, RoleGuard
 *   Milestone 12 accountService
 * =============================================================================
 */

export {}
