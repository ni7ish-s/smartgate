# SmartGate — AI-Native API Gateway

A production-grade reverse proxy / API gateway with an AI layer for anomaly detection. Built as a portfolio project to demonstrate systems design, distributed architecture, and applied AI.

```
Client → SmartGate Gateway → Upstream Services
              │
        ┌─────┴──────┐
        │  Features  │
        ├────────────┤
        │ Dynamic    │  Route rules in Postgres — change without redeploy
        │ Routing    │
        ├────────────┤
        │ Auth       │  JWT + API key validation per route
        ├────────────┤
        │ Rate Limit │  Sliding window in Redis per client/route
        ├────────────┤
        │ Logging    │  Request/response logs in Postgres
        ├────────────┤
        │ AI Guard   │  Groq/Llama3 anomaly detection on traffic patterns
        ├────────────┤
        │ Dashboard  │  React UI — manage routes, live graphs, alerts
        └────────────┘
```

## Tech Stack

| Layer          | Technology              |
|----------------|-------------------------|
| Gateway        | Node.js + Fastify       |
| Database       | PostgreSQL              |
| Cache / RL     | Redis                   |
| AI Detection   | Groq API (Llama 3, free)|
| Dashboard      | React + Recharts        |
| Infra          | Docker Compose          |

## Quickstart

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for local dev)
- Free [Groq API key](https://console.groq.com) (Phase 7)

### 1. Clone and configure

```bash
git clone https://github.com/you/smartgate.git
cd smartgate

cp gateway/.env.example gateway/.env
# Edit gateway/.env — set JWT_SECRET and GROQ_API_KEY
```

### 2. Start infrastructure (Postgres + Redis)

```bash
docker compose up postgres redis -d
```

Postgres auto-runs `postgres/migrations/001_init.sql` on first boot — creates tables and seeds two demo routes.

### 3. Run gateway locally

```bash
cd gateway
npm install
npm run dev
```

Gateway starts on **http://localhost:3000**.

### 4. Test it

```bash
# Health check
curl http://localhost:3000/_health

# List routes
curl http://localhost:3000/admin/routes

# Test proxy (forwards to httpbin.org/get)
curl http://localhost:3000/api/httpbin/get

# Create a new route
curl -X POST http://localhost:3000/admin/routes \
  -H "Content-Type: application/json" \
  -d '{"prefix":"/api/todos","upstream":"https://jsonplaceholder.typicode.com","strip_prefix":true}'
```

### 5. Full stack with Docker

```bash
docker compose up --build
```

---

## Build Phases

| Phase | What | Status |
|-------|------|--------|
| 1 | HTTP proxy + dynamic routing from Postgres | ✅ Done |
| 2 | Route CRUD admin API | ✅ Done |
| 3 | JWT + API key auth middleware | 🔜 Next |
| 4 | Redis sliding-window rate limiter | ⬜ |
| 5 | Request/response logging to Postgres | ⬜ |
| 6 | React dashboard — route manager + traffic graphs | ⬜ |
| 7 | AI anomaly detection via Groq + alerts | ⬜ |
| 8 | Docker Compose — full stack | ⬜ |

---

## Project Structure

```
smartgate/
├── gateway/                  # Fastify reverse proxy
│   ├── src/
│   │   ├── server.js         # Entry point
│   │   ├── plugins/
│   │   │   ├── db.js         # Postgres pool
│   │   │   └── redis.js      # Redis client
│   │   ├── routes/
│   │   │   ├── proxy.js      # Wildcard proxy handler
│   │   │   └── admin.js      # Route CRUD API
│   │   ├── middleware/       # Auth, rate-limit (Phase 3–4)
│   │   └── services/
│   │       └── routeLoader.js# Route cache + longest-prefix match
│   └── Dockerfile
├── dashboard/                # React UI (Phase 6)
├── postgres/
│   └── migrations/
│       └── 001_init.sql      # Schema + seed data
├── docker-compose.yml
└── README.md
```

## API Reference (Phase 1 & 2)

### Gateway

| Method | Path | Description |
|--------|------|-------------|
| GET | `/_health` | Health check |
| ANY | `/*` | Proxy to matched upstream |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/routes` | List all routes |
| POST | `/admin/routes` | Create route |
| PUT | `/admin/routes/:id` | Update route |
| DELETE | `/admin/routes/:id` | Delete route |
| POST | `/admin/routes/reload` | Bust route cache |

### Route Object

```json
{
  "id": "uuid",
  "prefix": "/api/users",
  "upstream": "http://user-svc:4001",
  "strip_prefix": true,
  "auth_required": false,
  "rate_limit_rps": 100,
  "active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```
