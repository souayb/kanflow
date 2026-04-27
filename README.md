# Kanflow

A local-first Kanban task management application. Manage projects, columns, and tasks with drag-and-drop, time tracking, personal todos, AI-assisted task enhancement (via local [Ollama](https://ollama.com)), and per-project chat.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  React 19 + TypeScript + TailwindCSS v4             │
│  └── AI calls → Ollama :11434 (direct fetch)        │
└────────────────────┬────────────────────────────────┘
                     │ :3000 (Docker) / :3000 (dev)
          ┌──────────▼──────────┐
          │  Nginx (prod)       │  or  Vite dev server
          │  serves /dist       │
          └─────────────────────┘
                     │
          ┌──────────▼──────────┐
          │  Rust API (Axum)    │  :8080
          │  kanflow-server     │
          └──────┬──────┬───────┘
                 │      │
        ┌────────▼─┐  ┌─▼────────┐  ┌────────────┐
        │ Postgres │  │ MongoDB  │  │  Ollama    │
        │  :5432   │  │  :27017  │  │  :11434    │
        │ projects │  │ chat,cfg │  │ llama3.2   │
        └──────────┘  └──────────┘  └────────────┘
```

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6, TailwindCSS v4 |
| Backend | Rust (Axum), sqlx + PostgreSQL, MongoDB |
| AI | Ollama (local, no API key needed) |
| Persistence | localStorage (projects with team metadata, tasks, per-project chat), Postgres + Mongo (API) |
| Containerization | Docker Compose |

---

## Prerequisites

### Docker path (recommended)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + Compose v2
- [Ollama](https://ollama.com/download) — only if running **outside** Docker

### Local dev path
- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) 1.88+ (`rustup update`)
- [Ollama](https://ollama.com/download)
- Docker (for Postgres + MongoDB only)

---

## Quick Start — Docker Compose

Everything runs in one command. The `ollama-pull` service automatically downloads the model on first start.

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd kanban

# 2. Copy and review environment variables
cp .env.example .env

# 3. Start all services (builds images on first run — takes a few minutes for Rust)
docker compose up --build

# Access points:
#   Frontend  →  http://localhost:3000
#   API       →  http://localhost:8080
#   Ollama    →  http://localhost:11434
```

On subsequent starts (images already built):
```bash
docker compose up
```

To rebuild after code changes:
```bash
docker compose up --build frontend   # rebuild only frontend
docker compose up --build backend    # rebuild only backend
docker compose up --build            # rebuild everything
```

To stop and remove containers (volumes are preserved):
```bash
docker compose down
```

To also wipe all data volumes:
```bash
docker compose down -v
```

---

## Local Development (without Docker)

### 1. Start data stores

```bash
docker compose up postgres mongo ollama
```

### 2. Pull an Ollama model

```bash
ollama pull llama3.2
```

### 3. Backend

```bash
cd backend

# Copy and configure environment
cp ../.env.example .env   # or export vars in your shell

# Run (auto-applies migrations on startup)
cargo run
# API available at http://localhost:8080
```

### 4. Frontend

```bash
cd frontend

# Copy and configure environment
cp .env.example .env.local
# Edit .env.local if needed (defaults work with local Ollama on :11434)

# Install dependencies
npm install

# Start dev server (HMR enabled)
npm run dev
# App available at http://localhost:3000
```

---

## Environment Variables

### Root `.env` (backend + Docker Compose)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://kanflow:kanflow@localhost:5432/kanflow` | PostgreSQL connection string |
| `MONGO_URI` | `mongodb://localhost:27017` | MongoDB connection URI |
| `MONGO_DB` | `kanflow` | MongoDB database name |
| `KANFLOW_HOST` | `0.0.0.0` | API server bind host |
| `KANFLOW_PORT` | `8080` | API server port |
| `OLLAMA_MODEL` | `llama3.2` | Model for `ollama-pull` to download on first start |

### Frontend `frontend/.env.local`

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_OLLAMA_URL` | *(unset in dev)* | When unset, `npm run dev` uses same-origin `/ollama` (Vite proxy). Set `http://localhost:11434` only if you want the browser to call Ollama directly. |
| `VITE_OLLAMA_MODEL` | `llama3.2` | Model name for all AI features |

> **Note:** The Compose frontend image is built with `VITE_OLLAMA_URL=/ollama`. Nginx proxies `/ollama` to the `ollama` service so the browser does not need Docker host networking for the LLM.

### Ollama troubleshooting (Docker)

- **`ollama` unhealthy / `ollama-pull` never runs:** The published `ollama/ollama` image does not include `curl`. This repo’s healthcheck uses `ollama list` against the API instead. If the service was unhealthy before, run `docker compose up --build` after pulling the latest `docker-compose.yml`.
- **`POST /api/chat` returns 404:** Ollama often uses **404 for “model not found”**. Ensure `ollama-pull` completed (`docker compose logs ollama-pull`) or run `docker compose run --rm ollama-pull` / `ollama pull llama3.2` on the host. Match `VITE_OLLAMA_MODEL` / `OLLAMA_MODEL` to a pulled tag.

---

## Changing the AI Model

Any model available in the [Ollama library](https://ollama.com/library) can be used.

**With Docker Compose:**
```bash
OLLAMA_MODEL=mistral docker compose up --build frontend
```

**Locally:**
```bash
ollama pull mistral
# Set VITE_OLLAMA_MODEL=mistral in frontend/.env.local
npm run dev
```

Recommended models by use case:

| Model | Size | Best for |
|-------|------|----------|
| `llama3.2` | 2GB | Balanced — default |
| `mistral` | 4GB | Stronger reasoning |
| `qwen2.5` | 4GB | Code + structured JSON |
| `gemma3` | 5GB | Concise outputs |

---

## GPU Acceleration (Ollama)

Uncomment the `deploy` section in `docker-compose.yml` under the `ollama` service:

```yaml
ollama:
  # ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

Requires [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html).

---

## API Endpoints

Base URL: `http://localhost:8080`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `200` even without databases |
| `GET` | `/api/v1/projects` | List all projects |
| `POST` | `/api/v1/projects` | Create a project `{ name, description }` |
| `GET` | `/api/v1/projects/:id/chat` | List chat messages for a project |
| `POST` | `/api/v1/projects/:id/chat` | Append a chat message |
| `GET` | `/api/v1/config` | Get app config document (MongoDB) |
| `PUT` | `/api/v1/config` | Update app config document |
| `POST` | `/api/v1/blobs` | Store an unstructured blob (MongoDB) |

The API returns `503` for any route that requires a database when that database is not connected — it never crashes on startup.

---

## Running Tests

### Frontend

```bash
cd frontend
npm test          # run once
npm run test:watch  # watch mode
```

### Backend

```bash
cd backend
cargo test
```

Contract tests in `backend/crates/kanflow-server/tests/http_contract.rs` run without live databases (they use the test router).

---

## Project Structure

```
kanban/
├── docker-compose.yml        # All services: postgres, mongo, ollama, backend, frontend
├── .env.example              # Root env vars (backend + compose)
│
├── backend/
│   ├── Dockerfile
│   ├── Cargo.toml            # Workspace root
│   ├── migrations/           # sqlx SQL migrations (applied on startup)
│   └── crates/
│       └── kanflow-server/
│           ├── src/
│           │   ├── main.rs   # Entrypoint — connects DBs, runs migrations
│           │   ├── app.rs    # Router + CORS
│           │   ├── config.rs # ServerConfig from env
│           │   ├── state.rs  # AppState (PgPool + MongoDB)
│           │   ├── handlers/ # HTTP handlers (health, projects)
│           │   └── mongo_store.rs  # MongoDB handlers (chat, config, blobs)
│           └── tests/
│               └── http_contract.rs
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf            # SPA routing + asset caching
    ├── .env.example          # Frontend env vars
    ├── vite.config.ts
    ├── package.json
    └── src/
        ├── App.tsx           # Root — view routing
        ├── AppContext.tsx    # Global state (React Context + localStorage)
        ├── types.ts          # All TypeScript types
        ├── constants.ts      # Mock seed data
        ├── lib/
        │   ├── ai.ts         # Ollama client (enhanceTask, chat, SMART, summary)
        │   └── utils.ts      # cn, formatDate, avatar helpers
        └── components/
            ├── Layout.tsx
            ├── KanbanView.tsx
            ├── DashboardView.tsx
            ├── TaskModal.tsx
            ├── ReportingView.tsx
            ├── PersonalTodoView.tsx
            ├── TimeKeepingView.tsx
            ├── ChatComponent.tsx   # Per-project chat + Ollama AI replies
            ├── ProfileDropdown.tsx
            ├── DashboardCustomizer.tsx
            └── Avatar.tsx          # Offline initials avatar
```

---

## Design System

The UI follows a Meta Store-inspired design system documented in [`DESIGN.md`](./DESIGN.md). Key tokens are defined as CSS custom properties in `frontend/src/index.css` under `@theme`.

All fonts are system fonts (`Helvetica Neue`, `Helvetica`, `Arial`) — no external font requests, fully offline-capable.
