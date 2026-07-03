/**
 * anomaly.js
 * ----------
 * Periodically pulls recent request logs, sends them to Groq/Llama3,
 * and stores any anomalies it finds into anomaly_alerts.
 *
 * Runs every INTERVAL_MS in the background — not on the request path,
 * so it never slows down proxying.
 */

const INTERVAL_MS = 60_000 // run every 60 seconds
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export function startAnomalyDetection(db) {
  setInterval(async () => {
    try {
      await runDetection(db)
    } catch (err) {
      console.error('Anomaly detection error:', err.message)
    }
  }, INTERVAL_MS)

  // Also run immediately on startup
  runDetection(db).catch(err => console.error('Anomaly detection error:', err.message))
}

async function runDetection(db) {
  // Pull last 200 requests from the past 2 minutes
  const { rows: logs } = await db.query(`
    SELECT method, path, status_code, duration_ms, client_ip, logged_at
    FROM request_logs
    WHERE logged_at > now() - interval '2 minutes'
    ORDER BY logged_at DESC
    LIMIT 200
  `)

  if (logs.length === 0) return

  const summary = summarizeLogs(logs)

  const prompt = `
You are a security and performance analyst for an API gateway.
Analyze the following traffic summary from the last 2 minutes and identify any anomalies.

Traffic summary:
${JSON.stringify(summary, null, 2)}

Look for:
- Unusually high error rates (>20% 4xx/5xx)
- A single IP making excessive requests (potential brute force or DDoS)
- Abnormally slow response times (avg duration > 2000ms)
- Sudden spikes in request volume
- Repeated requests to non-existent routes (404 storms)

Respond ONLY with a JSON array. Each item must have:
- severity: "low" | "medium" | "high"
- description: string (one sentence, human readable)
- metadata: object with relevant numbers

If no anomalies found, respond with an empty array: []
`.trim()

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // low temperature = more deterministic, less hallucination
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`)
  }

  const data = await response.json()
  const raw = data.choices[0].message.content.trim()

  let alerts
  try {
    alerts = JSON.parse(raw)
  } catch {
    console.error('Failed to parse Groq response as JSON:', raw)
    return
  }

  if (!Array.isArray(alerts) || alerts.length === 0) return

  // Store alerts in DB
  for (const alert of alerts) {
    if (!['low', 'medium', 'high'].includes(alert.severity)) continue
    await db.query(
      `INSERT INTO anomaly_alerts (severity, description, metadata)
       VALUES ($1, $2, $3)`,
      [alert.severity, alert.description, JSON.stringify(alert.metadata ?? {})]
    )
  }

  console.log(`Anomaly detection: ${alerts.length} alert(s) stored`)
}

function summarizeLogs(logs) {
  const ipCounts = {}
  const pathCounts = {}
  let totalDuration = 0
  let errorCount = 0

  for (const log of logs) {
    ipCounts[log.client_ip] = (ipCounts[log.client_ip] ?? 0) + 1
    pathCounts[log.path] = (pathCounts[log.path] ?? 0) + 1
    totalDuration += log.duration_ms ?? 0
    if (log.status_code >= 400) errorCount++
  }

  const topIps = Object.entries(ipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ip, count]) => ({ ip, count }))

  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, count]) => ({ path, count }))

  return {
    totalRequests: logs.length,
    errorCount,
    errorRate: `${((errorCount / logs.length) * 100).toFixed(1)}%`,
    avgDurationMs: Math.round(totalDuration / logs.length),
    topIps,
    topPaths,
  }
}