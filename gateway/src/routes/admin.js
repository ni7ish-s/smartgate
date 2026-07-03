import { invalidateCache } from '../services/routeLoader.js'
import crypto from 'crypto'

/**
 * admin.js — Route management API
 * --------------------------------
 * Provides CRUD endpoints for gateway routing rules.
 * These are consumed by the React dashboard.
 *
 * All routes are prefixed with /admin (set by server.js register call).
 *
 * POST   /admin/routes          — create route
 * GET    /admin/routes          — list all routes
 * PUT    /admin/routes/:id      — update route
 * DELETE /admin/routes/:id      — delete route
 * POST   /admin/routes/reload   — force cache bust
 */
export default async function adminRoutes(fastify) {
  // ── List ──────────────────────────────────────────────────────────────────
  fastify.get('/routes', async (_req, reply) => {
    const { rows } = await fastify.db.query(
      `SELECT * FROM routes ORDER BY created_at DESC`
    )
    return reply.send(rows)
  })

  // ── Create ────────────────────────────────────────────────────────────────
  fastify.post('/routes', {
    schema: {
      body: {
        type: 'object',
        required: ['prefix', 'upstream'],
        properties: {
          prefix:          { type: 'string', minLength: 1 },
          upstream:        { type: 'string', minLength: 1 },
          strip_prefix:    { type: 'boolean', default: false },
          auth_required:   { type: 'boolean', default: false },
          rate_limit_rps:  { type: 'integer', minimum: 1, default: 100 },
          active:          { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const { prefix, upstream, strip_prefix = false, auth_required = false, rate_limit_rps = 100, active = true } = request.body

    const { rows } = await fastify.db.query(
      `INSERT INTO routes (prefix, upstream, strip_prefix, auth_required, rate_limit_rps, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [prefix, upstream, strip_prefix, auth_required, rate_limit_rps, active]
    )

    invalidateCache()
    return reply.code(201).send(rows[0])
  })

  // ── Update ────────────────────────────────────────────────────────────────
  fastify.put('/routes/:id', async (request, reply) => {
    const { id } = request.params
    const fields = request.body

    // Build SET clause dynamically from provided fields
    const allowed = ['prefix', 'upstream', 'strip_prefix', 'auth_required', 'rate_limit_rps', 'active']
    const updates = []
    const values  = []

    for (const key of allowed) {
      if (key in fields) {
        values.push(fields[key])
        updates.push(`${key} = $${values.length}`)
      }
    }

    if (updates.length === 0) {
      return reply.code(400).send({ error: 'No valid fields to update' })
    }

    values.push(id)
    const { rows } = await fastify.db.query(
      `UPDATE routes SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    )

    if (!rows[0]) return reply.code(404).send({ error: 'Route not found' })

    invalidateCache()
    return reply.send(rows[0])
  })

  // ── Delete ────────────────────────────────────────────────────────────────
  fastify.delete('/routes/:id', async (request, reply) => {
    const { rows } = await fastify.db.query(
      `DELETE FROM routes WHERE id = $1 RETURNING id`,
      [request.params.id]
    )

    if (!rows[0]) return reply.code(404).send({ error: 'Route not found' })

    invalidateCache()
    return reply.send({ deleted: rows[0].id })
  })

  // ── Force cache reload ────────────────────────────────────────────────────
  fastify.post('/routes/reload', async (_req, reply) => {
    invalidateCache()
    return reply.send({ ok: true, message: 'Route cache invalidated' })
  })
}

  // ── API Keys ────────────────────────────────────────────────────────────────

  // Generate and store a new API key
  fastify.post('/keys', async (request, reply) => {
    const { name } = request.body
    if (!name) return reply.code(400).send({ error: 'name is required' })

    // Generate a secure random key
    const rawKey = crypto.randomBytes(32).toString('hex')
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const { rows } = await fastify.db.query(
      `INSERT INTO api_keys (key_hash, name) VALUES ($1, $2) RETURNING id, name, created_at`,
      [keyHash, name]
    )

    // Return the raw key ONCE — we never store it, can't retrieve it again
    return reply.code(201).send({ ...rows[0], key: rawKey })
  })

  // List all keys (never returns the actual key, only metadata)
  fastify.get('/keys', async (_req, reply) => {
    const { rows } = await fastify.db.query(
      `SELECT id, name, active, created_at, last_used_at FROM api_keys ORDER BY created_at DESC`
    )
    return reply.send(rows)
  })

  // Revoke a key
  fastify.delete('/keys/:id', async (request, reply) => {
    const { rows } = await fastify.db.query(
      `UPDATE api_keys SET active = false WHERE id = $1 RETURNING id`,
      [request.params.id]
    )
    if (!rows[0]) return reply.code(404).send({ error: 'Key not found' })
    return reply.send({ revoked: rows[0].id })
  })

  // ── Logs ─────────────────────────────────────────────────────────────────
  fastify.get('/logs', async (_req, reply) => {
    const { rows } = await fastify.db.query(
      `SELECT * FROM request_logs ORDER BY logged_at DESC LIMIT 500`
    )
    return reply.send(rows)
  })

  // ── Alerts ────────────────────────────────────────────────────────────────
  fastify.get('/alerts', async (_req, reply) => {
    const { rows } = await fastify.db.query(
      `SELECT * FROM anomaly_alerts ORDER BY created_at DESC`
    )
    return reply.send(rows)
  })