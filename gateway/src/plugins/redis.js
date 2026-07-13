import fp from 'fastify-plugin'
import Redis from 'ioredis'
import 'dotenv/config'

async function redisPlugin(fastify) {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

  await redis.connect()
  fastify.log.info('✅ Redis connected')

  fastify.decorate('redis', redis)

  fastify.addHook('onClose', async () => {
    await redis.quit()
    fastify.log.info('Redis connection closed')
  })
}

export default fp(redisPlugin, { name: 'redis' })
