import fp from 'fastify-plugin'

async function loggerPlugin(fastify) {
  fastify.decorate('logRequest', async function (request, reply, route, startTime) {
    const duration = Date.now() - startTime
    const status = reply.statusCode

    // Non-blocking insert — we don't await this, logging should never slow down a request
    fastify.db.query(
      `INSERT INTO request_logs 
        (route_id, method, path, status_code, client_ip, duration_ms, request_size, response_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        route?.id ?? null,
        request.method,
        request.url,
        status,
        request.ip,
        duration,
        parseInt(request.headers['content-length'] ?? '0'),
        parseInt(reply.getHeader('content-length') ?? '0'),
      ]
    )
  })
}

export default fp(loggerPlugin, { name: 'logger' })