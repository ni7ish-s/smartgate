# SmartGate

SmartGate is a lightweight API gateway with a live dashboard for managing routes, monitoring traffic, and catching anomalies with AI.

## Features

- **Dynamic routing** — add, edit, and delete proxy routes from the dashboard, no restart needed
- **Rate limiting** — per-route request-per-second limits, enforced via a Redis sliding window
- **Traffic monitoring** — live chart of requests, errors, and average response time
- **AI anomaly detection** — background job that analyzes recent traffic with an LLM (via Groq) and flags issues like error spikes, slow responses, or suspicious IPs
- **Auth support** — optional per-route authentication

## Tech Stack

- **Gateway**: Node.js, Fastify, PostgreSQL, Redis
- **Dashboard**: React, Vite, Recharts
- **AI**: Groq API (`openai/gpt-oss-20b`)
- **Infra**: Docker Compose

## Screenshots

### Traffic   
Live view of request volume, errors, and average response time.

<img width="600" alt="sg1" src="https://github.com/user-attachments/assets/ab66b70b-c05a-4bb9-a6a9-7c4bc7fba7a6" />

### Alerts
AI-generated anomaly alerts based on recent traffic patterns.

Still in work.

## Getting Started

### Prerequisites
- Docker and Docker Compose
- A [Groq API key](https://console.groq.com) for anomaly detection

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/ni7ish-s/smartgate.git
   cd smartgate
   ```

2. Create a `.env` file in `gateway/` with:
   ```
   DATABASE_URL=postgresql://smartgate:smartgate@localhost:5432/smartgate
   GROQ_API_KEY=your_key_here
   PORT=3000
   HOST=0.0.0.0
   ```

3. Start everything:
   ```bash
   docker compose up -d
   ```

4. Open the dashboard:
   ```
   http://localhost:5173
   ```

The gateway API runs on `http://localhost:3000`.

### Adding a Route

From the Routes tab, enter a prefix (e.g. `/api/users`), an upstream URL (e.g. `http://user-svc:4001`), and a rate limit. Requests to that prefix will be proxied to the upstream automatically.

## Project Structure

```
smartgate/
├── gateway/          # Fastify backend (proxy, auth, rate limiting, anomaly detection)
│   └── src/
│       ├── routes/       # admin + proxy routes
│       ├── plugins/      # db, redis, auth, rate limit
│       └── services/     # route matching, anomaly detection
└── dashboard/        # React frontend
    └── src/
        └── components/   # Routes, Traffic, Alerts
```

## License

MIT
