import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import crypto from 'crypto'

async function authPlugin(fastify) {
  // Register JWT — signs and verifies tokens using your secret
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET,
  })

  // This decorator is what routes call to trigger auth
  // It runs before the request reaches the proxy
  fastify.decorate('authenticate', async function (request, reply) {
    const authHeader = request.headers['authorization']
    const apiKeyHeader = request.headers['x-api-key']

    // Try API key first
    if (apiKeyHeader) {
      const keyHash = crypto
        .createHash('sha256')
        .update(apiKeyHeader)
        .digest('hex')

      const { rows } = await fastify.db.query(
        `SELECT id, active FROM api_keys WHERE key_hash = $1`,
        [keyHash]
      )

      if (!rows[0] || !rows[0].active) {
        return reply.code(401).send({ error: 'Invalid or inactive API key' })
      }

      // Update last_used_at non-blocking
      fastify.db.query(
        `UPDATE api_keys SET last_used_at = now() WHERE id = $1`,
        [rows[0].id]
      )

      request.clientType = 'api_key'
      request.clientId = rows[0].id
      return
    }

    // Try JWT
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await request.jwtVerify()
        request.clientType = 'jwt'
        request.clientId = decoded.sub
        return
      } catch {
        return reply.code(401).send({ error: 'Invalid or expired JWT' })
      }
    }

    // Neither provided
    return reply.code(401).send({ error: 'Authentication required' })
  })
}

export default fp(authPlugin, { name: 'auth' })