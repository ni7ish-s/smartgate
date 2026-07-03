import 'dotenv/config'
import Fastify from 'fastify'
import dbPlugin    from './plugins/db.js'
import redisPlugin from './plugins/redis.js'
import adminRoutes from './routes/admin.js'
import proxyRoutes from './routes/proxy.js'
import authPlugin from './plugins/auth.js'
import rateLimitPlugin from './plugins/ratelimit.js'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

// ── Build Fastify instance ───────────────────────────────────────────────────
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, ignore: 'pid,hostname' },
      },
    }),
  },
  // Increase body limit for proxied payloads (10 MB)
  bodyLimit: 10 * 1024 * 1024,
})

// ── Plugins (order matters — db/redis must register before routes) ───────────
await fastify.register(dbPlugin)
await fastify.register(redisPlugin)
await fastify.register(authPlugin)

// ── Health check (before proxy catch-all so it's never proxied) ─────────────
fastify.get('/_health', async () => ({
  status: 'ok',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}))

// ── Admin API  ───────────────────────────────────────────────────────────────
await fastify.register(adminRoutes, { prefix: '/admin' })

// ── Proxy catch-all (must be registered last) ────────────────────────────────
await fastify.register(proxyRoutes)

// ── Start ─────────────────────────────────────────────────────────────────────
try {
  await fastify.listen({ port: PORT, host: HOST })
  fastify.log.info(`SmartGate listening on http://${HOST}:${PORT}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}

