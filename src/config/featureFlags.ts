/**
 * Feature flags. Anything that needs a backend or a store stays OFF until it is integrated, tested and
 * approved. Flipping `onlineLeagues` requires the Phase 6 backend (see docs/backend-plan.md).
 */

export const featureFlags = {
  /** Real, server-verified Paw Cup and Daily Dash rankings. Requires backend + security tests. */
  onlineLeagues: false,
  /** Friends codes and async duels. Requires accounts. */
  friends: false,
  /** Developer gallery for pet expressions (never in release builds). */
  devGallery: import.meta.env.DEV,
} as const;
