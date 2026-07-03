import fp from 'fastify-plugin'

async function rateLimitPlugin(fastify) {
  fastify.decorate('rateLimit', async function (request, reply, route) {
    const key = `rl:${request.ip}:${route.id}`
    const now = Date.now()
    const windowMs = 1000 // 1 second sliding window
    const limit = route.rate_limit_rps

    const pipeline = fastify.redis.pipeline()
    pipeline.zremrangebyscore(key, 0, now - windowMs) // remove timestamps outside the window
    pipeline.zadd(key, now, `${now}`)                 // add current request timestamp
    pipeline.zcard(key)                               // count requests in window
    pipeline.pexpire(key, windowMs)                   // auto-expire key after 1 second
    const results = await pipeline.exec()

    const requestCount = results[2][1] // zcard result

    if (requestCount > limit) {
      reply.header('x-ratelimit-limit', limit)
      reply.header('x-ratelimit-remaining', 0)
      reply.header('retry-after', '1')
      return reply.code(429).send({
        error: 'Too Many Requests',
        limit,
        windowMs,
      })
    }

    reply.header('x-ratelimit-limit', limit)
    reply.header('x-ratelimit-remaining', limit - requestCount)
  })
}

export default fp(rateLimitPlugin, { name: 'rateLimit' })