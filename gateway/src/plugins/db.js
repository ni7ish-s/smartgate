import fp from 'fastify-plugin'
import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

/**
 * Registers a shared Postgres pool on `fastify.db`.
 * Uses DATABASE_URL from env; falls back to individual PG* vars.
 */
async function dbPlugin(fastify) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

  // Validate connection at startup
  const client = await pool.connect()
  fastify.log.info('✅ Postgres connected')
  client.release()

  // Expose pool on fastify instance
  fastify.decorate('db', pool)

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await pool.end()
    fastify.log.info('Postgres pool closed')
  })
}

// fp() makes the decoration available across all plugins (not scoped)
export default fp(dbPlugin, { name: 'db' })
