import { getRoutes, matchRoute } from '../services/routeLoader.js'

/**
 * proxy.js — Dynamic reverse proxy
 * ---------------------------------
 * Registers a wildcard catch-all route (`/*`) that:
 *  1. Loads active route rules from Postgres (with in-memory cache)
 *  2. Matches the incoming path to the best (longest-prefix) rule
 *  3. Rewrites and forwards the request to the upstream service
 *  4. Streams the upstream response back to the client
 *
 * This is Phase 1 — auth, rate-limiting, and logging are added in later phases
 * as separate Fastify hooks/plugins layered on top of this handler.
 */
export default async function proxyRoutes(fastify) {
  fastify.all('/*', async (request, reply) => {
    const routes = await getRoutes(fastify.db)
    const route = matchRoute(routes, request.url)

    if (!route) {
      return reply.code(404).send({
        error: 'No route matched',
        path: request.url,
        hint: 'Add a route via the SmartGate dashboard or POST /admin/routes',
      })
    }

    // Build upstream URL
    let upstreamPath = request.url
    if (route.strip_prefix) {
      upstreamPath = request.url.slice(route.prefix.length) || '/'
    }
    const upstreamUrl = `${route.upstream}${upstreamPath}`

    request.log.info({ upstreamUrl, routeId: route.id }, '→ proxying request')

    // Forward request to upstream, streaming the response back
    try {
      const upstreamResponse = await fetch(upstreamUrl, {
        method: request.method,
        headers: buildForwardHeaders(request),
        body: ['GET', 'HEAD'].includes(request.method)
          ? undefined
          : await request.body?.text?.() ?? undefined,
        // Don't follow redirects — let the client handle them
        redirect: 'manual',
      })

      // Copy status + headers from upstream
      reply.code(upstreamResponse.status)
      for (const [key, value] of upstreamResponse.headers) {
        // Skip hop-by-hop headers
        if (HOP_BY_HOP.has(key.toLowerCase())) continue
        reply.header(key, value)
      }

      // Add a tracing header so clients know SmartGate handled the request
      reply.header('x-smartgate-route', route.id)
      reply.header('x-smartgate-upstream', route.upstream)

      return reply.send(upstreamResponse.body)
    } catch (err) {
      request.log.error({ err, upstreamUrl }, '✗ upstream unreachable')
      return reply.code(502).send({
        error: 'Bad Gateway',
        upstream: route.upstream,
        detail: err.message,
      })
    }
  })
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build headers to forward upstream.
 * Adds standard proxy headers (X-Forwarded-For, etc.).
 */
function buildForwardHeaders(request) {
  const headers = new Headers()

  for (const [key, value] of Object.entries(request.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue
    headers.set(key, value)
  }

  // Standard proxy headers
  const clientIp = request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown'
  headers.set('x-forwarded-for', clientIp)
  headers.set('x-forwarded-host', request.hostname)
  headers.set('x-forwarded-proto', request.protocol ?? 'http')
  headers.set('x-real-ip', clientIp)
  headers.set('via', '1.1 smartgate')

  return headers
}

/** HTTP/1.1 hop-by-hop headers — must not be forwarded */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
])
