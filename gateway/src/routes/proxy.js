import { getRoutes, matchRoute } from '../services/routeLoader.js'
export default async function proxyRoutes(fastify) {
  fastify.addContentTypeParser('*', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body)
  })

  fastify.route({
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
    url: '/*',
    handler: async (request, reply) => {
      const startTime = Date.now()

      const routes = await getRoutes(fastify.db)
      const route = matchRoute(routes, request.url)

      if (!route) {
        return reply.code(404).send({
          error: 'No route matched',
          path: request.url,
          hint: 'Add a route via POST /admin/routes',
        })
      }

      if (route.auth_required) {
        await fastify.authenticate(request, reply)
        if (reply.sent) return
      }

      await fastify.rateLimit(request, reply, route)
      if (reply.sent) return

      let upstreamPath = request.url
      if (route.strip_prefix) {
        upstreamPath = request.url.slice(route.prefix.length) || '/'
      }
      const upstreamUrl = `${route.upstream}${upstreamPath}`

      request.log.info({ upstreamUrl, routeId: route.id }, '→ proxying request')

      try {
        const upstreamResponse = await fetch(upstreamUrl, {
          method: request.method,
          headers: buildForwardHeaders(request),
          body: ['GET', 'HEAD'].includes(request.method)
            ? undefined
            : request.body ?? undefined,
          redirect: 'manual',
        })

        reply.code(upstreamResponse.status)
        for (const [key, value] of upstreamResponse.headers) {
          if (HOP_BY_HOP.has(key.toLowerCase())) continue
          reply.header(key, value)
        }

        reply.header('x-smartgate-route', route.id)
        reply.header('x-smartgate-upstream', route.upstream)

        reply.raw.on('finish', () => {
          fastify.logRequest(request, reply, route, startTime)
        })

        return reply.send(upstreamResponse.body)
      } catch (err) {
        request.log.error({ err, upstreamUrl }, '✗ upstream unreachable')

        reply.raw.on('finish', () => {
          fastify.logRequest(request, reply, route, startTime)
        })

        return reply.code(502).send({
          error: 'Bad Gateway',
          upstream: route.upstream,
          detail: err.message,
        })
      }
    },
  })
}
function buildForwardHeaders(request) {
  const headers = new Headers()

  for (const [key, value] of Object.entries(request.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue
    headers.set(key, value)
  }

  const clientIp = request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown'
  headers.set('x-forwarded-for', clientIp)
  headers.set('x-forwarded-host', request.hostname)
  headers.set('x-forwarded-proto', request.protocol ?? 'http')
  headers.set('x-real-ip', clientIp)
  headers.set('via', '1.1 smartgate')

  if (request.clientId) {
    headers.set('x-client-id', request.clientId)
    headers.set('x-client-type', request.clientType)
  }

  return headers
}

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