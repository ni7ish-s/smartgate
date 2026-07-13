/**
 * routeLoader
 * -----------
 * Loads proxy route rules from the `routes` table in Postgres.
 * Rules are cached in-memory and refreshed every CACHE_TTL_MS.
 *
 * Each rule row:
 *   id, prefix, upstream, strip_prefix, auth_required, rate_limit_rps, active
 *
 * Example: { prefix: '/api/users', upstream: 'http://user-svc:4001' }
 * → any request to /api/users/** is forwarded to http://user-svc:4001/**
 */

const CACHE_TTL_MS = 10_000 // refresh every 10 s

let cachedRoutes = []
let lastFetchedAt = 0

/**
 * @param {import('pg').Pool} db
 * @returns {Promise<Array>}
 */
export async function getRoutes(db) {
  const now = Date.now()
  if (now - lastFetchedAt < CACHE_TTL_MS && cachedRoutes.length > 0) {
    return cachedRoutes
  }

  const { rows } = await db.query(
    `SELECT id, prefix, upstream, strip_prefix, auth_required, rate_limit_rps
     FROM routes
     WHERE active = true
     ORDER BY length(prefix) DESC` // longest prefix wins (most specific first)
  )

  cachedRoutes = rows
  lastFetchedAt = now
  return rows
}

/**
 * Find the best matching route for a given request path.
 * Uses longest-prefix matching — routes are pre-sorted DESC by prefix length.
 *
 * @param {Array}  routes  - result of getRoutes()
 * @param {string} path    - incoming request path
 * @returns {object|null}
 */
export function matchRoute(routes, path) {
  return routes.find((r) => path.startsWith(r.prefix)) ?? null
}

/** Force a refresh on next call (used after route CRUD via dashboard API) */
export function invalidateCache() {
  lastFetchedAt = 0
}
