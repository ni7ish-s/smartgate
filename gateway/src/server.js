import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import dbPlugin from './plugins/db.js'
import redisPlugin from './plugins/redis.js'
import authPlugin from './plugins/auth.js'
import rateLimitPlugin from './plugins/ratelimit.js'
import loggerPlugin from './plugins/logger.js'
import adminRoutes from './routes/admin.js'
import proxyRoutes from './routes/proxy.js'
import { startAnomalyDetection } from './services/anomaly.js'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

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
  bodyLimit: 10 * 1024 * 1024,
})

await fastify.register(cors, {
  origin: 'http://localhost:5173'
})

await fastify.register(dbPlugin)
await fastify.register(redisPlugin)
await fastify.register(authPlugin)
await fastify.register(rateLimitPlugin)
await fastify.register(loggerPlugin)

fastify.get('/_health', async () => ({
  status: 'ok',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
}))

await fastify.register(adminRoutes, { prefix: '/admin' })
await fastify.register(proxyRoutes)

try {
  await fastify.listen({ port: PORT, host: HOST })
  fastify.log.info(`SmartGate listening on http://${HOST}:${PORT}`)
  startAnomalyDetection(fastify.db)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}