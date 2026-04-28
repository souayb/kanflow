# Kanflow — Spec-Driven Development (SDD)

## 1. Overview

**Product Name:** Kanflow
**Type:** Kanban Task Management Application
**Goal:** Enable users to visually manage work using projects, columns, and tasks with a fast, minimal, and collaborative UX — enhanced with AI insights, time tracking, and personal productivity tools.

---

## 2. Core Principles

* **Spec-first**: Every feature must map to a defined spec section.
* **Atomic features**: Small, testable units.
* **Deterministic behavior**: No ambiguous UI states.
* **Offline-tolerant**: LocalStorage persistence; optional sync with the Kanflow API when enabled.
* **Extensible architecture**: Context-driven state, composable views.

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Styling | TailwindCSS v4 |
| Icons | Lucide React |
| Animation | Motion (Framer Motion v12) |
| Charts | Recharts |
| Backend | Rust (`kanflow-server`): PostgreSQL (structured domain) + MongoDB (chat, config, blobs) |
| AI | Ollama — `frontend/src/lib/ai.ts` (`VITE_OLLAMA_URL`, `VITE_OLLAMA_MODEL`); dev uses `/ollama` (Vite proxy); Docker frontend uses `/ollama` (nginx → Ollama service) |
| Persistence | localStorage; API sync optional |
| Design System | Meta-inspired (see DESIGN.md) |

---

## 4. Domain Model

### 4.1 Entities

#### User

```ts
User {
  id: string
  name: string
  email: string
  avatar?: string
  role: string
  twoFactorEnabled?: boolean
  passwordLastChanged?: number
}
```

#### Project (replaces Board + Workspace)

```ts
Project {
  id: string
  name: string
  description: string
  columns: Column[]   // embedded, ordered
  createdAt: number
  ownerId: string
  memberIds?: string[] // project team (includes owner in UI; persisted client-side until API supports it)
}
```

#### Column (List)

```ts
Column {
  id: string
  title: string
  order: number
  // boardId derived from parent Project
}
```

#### Task (replaces Card)

```ts
Task {
  id: string
  title: string
  description: string
  status: string          // matches a column title (dynamic)
  priority: 'low' | 'medium' | 'high'
  assigneeId?: string
  dueDate?: number        // Unix ms
  projectId: string
  tags: string[]
  comments: Comment[]
  dependencies: string[]  // task IDs
  createdAt: number
  updatedAt: number
  aiSuggested?: boolean
  aiThinking?: string
}
```

#### Comment

```ts
Comment {
  id: string
  userId: string
  userName: string
  content: string
  createdAt: number
}
```

#### Notification

```ts
Notification {
  id: string
  userId: string
  title: string
  message: string
  type: 'task_update' | 'comment' | 'mention' | 'ai_insight'
  read: boolean
  createdAt: number
  relatedId?: string   // taskId or projectId
}
```

#### PersonalTodo

```ts
PersonalTodo {
  id: string
  userId: string
  content: string
  completed: boolean
  linkedTaskId?: string
  quadrant?: 1 | 2 | 3 | 4   // Eisenhower matrix
  createdAt: number
}
```

#### TimeEntry

```ts
TimeEntry {
  id: string
  taskId: string
  userId: string
  startTime: number
  endTime?: number
  duration: number     // ms
  description: string
  createdAt: number
}
```

#### DashboardWidget

```ts
DashboardWidget {
  id: string
  type: 'overview' | 'activity' | 'performance' | 'upcoming' | 'ai_insights'
  title: string
  enabled: boolean
  order: number
}
```

#### ChatMessage

```ts
ChatMessage {
  id: string
  projectId: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  createdAt: number
}
```

---

## 5. Functional Requirements

### 5.1 Project Management (was Board Management)

* Create project
* Add and remove **project team** members (sidebar; persisted with the project in localStorage; API field planned)
* Rename project (context `updateProject`; wire inline UI as needed)
* Delete project (with confirmation)
* Switch active project

**Acceptance Criteria**

* Project appears instantly after creation
* Project name must be non-empty
* Active project persists across sessions (localStorage)

---

### 5.2 Column Management

* Add column
* Rename column
* Delete column
* Reorder columns (drag-and-drop)

**Rules**

* Minimum: 1 column per project
* Column order must persist
* Task `status` field mirrors column title (dynamic)

---

### 5.3 Task Management (was Card Management)

* Create task (title, description, priority, assignee, due date, tags)
* Edit task via modal (full detail view)
* Delete task
* Move task between columns (drag-and-drop or modal status change)
* Reorder within column
* Add/view comments on task
* Add task dependencies (links to other task IDs)
* Log time on task (start/stop timer)

**Acceptance Criteria**

* Drag-and-drop updates status immediately (optimistic)
* Task `updatedAt` refreshes on every edit
* Empty title is not allowed
* Notifications triggered on create, status change, new comment

---

### 5.4 Drag and Drop

* Columns: horizontal drag
* Tasks: vertical + cross-column drag

**Behavior**

* Optimistic UI updates
* Smooth animation (Motion library)
* Status field syncs with target column

---

### 5.5 Dashboard

* Customizable widget layout (drag to reorder, toggle enable/disable)
* Widget types: Project Overview, Recent Activity, Performance chart, High Priority tasks, AI Insights

---

### 5.6 Reporting View

* Performance chart (tasks completed vs. added over time) using Recharts
* Filterable by project and date range

---

### 5.7 Personal Todos

* Create personal todos (independent of project tasks)
* Link todo to an existing task
* Toggle complete/incomplete
* Organize by Eisenhower matrix quadrant (1–4)
* Delete todo

---

### 5.8 Time Keeping

* Start/stop timer per task (one active timer at a time)
* View time entries per task
* Total time logged per task

---

### 5.9 AI Insights (Gemini)

* AI-suggested tasks (`aiSuggested: true`) generated via Gemini API
* AI thinking/reasoning stored in `aiThinking` field
* AI insights widget on dashboard
* **Team chat dock** includes an **AI** tab that calls Ollama via `frontend/src/lib/ai.ts` (project-scoped context)

---

### 5.10 Notifications

* In-app notification feed (header bell); entries are **scoped to `userId === currentUser.id`** so assignees only see items addressed to them.
* Types: `task_update`, `comment`, `mention`, `ai_insight`
* **Kanflow AI — Apply all to task** (`TaskModal`): after a successful apply, the actor gets an **`ai_insight`** notification summarizing the update; if the task has an assignee other than the actor, that assignee gets a **`task_update`** notification.
* Mark individual notifications as read (or “Mark all read” for the visible list)
* Badge count reflects **unread notifications for the signed-in user only**

---

### 5.11 Collaboration (Team chat)

* **UI:** `frontend/src/components/TeamChatDock.tsx` — floating dock (Slack-style inspiration: channels sidebar, direct messages, search, optional “+” channels). Tabs: **Channels · DM** (team) and **AI** (per-project Ollama thread, separate storage key so histories never collide).
* **Client persistence:** `localStorage` key `kanflow_team_chat_v1` — object map of **thread keys** → `ChatLine[]`:
  * `c:{projectId}:{channelId}` — project channels (`general` plus any extra ids stored under `kanflow_team_channel_defs_v1` per project).
  * `dm:{userA}:{userB}` — lexicographic pair id for 1:1 DMs (browser-local only; not a server contract yet).
  * `ai:{projectId}` — AI tab transcript.
* **Server-backed slice (today):** When `AppContext.apiOnline` is true and the user is on **`#general`**, the dock loads and appends via **`GET` / `POST` `/api/v1/projects/{project_id}/chat`** (Axum + MongoDB `chat_messages` in `mongo_store.rs`: `project_id`, `user_id`, `user_name`, `content`, `created_at`). If Mongo is disabled or the request fails, the same thread falls back to the local map above. **Extra channels** remain local-only until the API gains a `channel` / `thread_id` dimension (or Postgres channel tables like a classic team product).
* **Future / reference architecture (not the current stack):** Multi-tenant products often add **Postgres** `channels` + `channel_members`, **Mongo** (or dedicated store) for message bodies, **Redis** for hot DM/channel caches, and **WebSocket** fan-out (see common Actix-style patterns). Kanflow intentionally stays on **Axum** and the existing Mongo route until product requirements justify that expansion.

---

## 6. State Management

### Client State Shape (AppContext)

```ts
AppContextType {
  projects: Project[]
  tasks: Task[]
  users: User[]
  notifications: Notification[]
  personalTodos: PersonalTodo[]
  timeEntries: TimeEntry[]
  dashboardWidgets: DashboardWidget[]
  activeProjectId: string | null
  activeTimer: { taskId: string; startTime: number } | null
  currentUser: User | null
}
```

### Rules

* Single React Context (`AppContext`) for all app state
* localStorage keys prefixed `kanflow_*` for persistence (legacy `zenith_*` is migrated once on load)
* Normalize tasks by projectId filtering (not nested under project)
* Task status mirrors column title — keep in sync on column rename

---

## 7. Views

| View | Route/Key | Component |
|------|-----------|-----------|
| Kanban Board | `kanban` | `KanbanView` |
| Dashboard | `dashboard` | `DashboardView` |
| Reporting | `reporting` | `ReportingView` |
| Personal Todos | `todos` | `PersonalTodoView` |
| Time Keeping | `time` | `TimeKeepingView` |

---

## 8. API / Backend

### Kanflow server (Rust)

* Crate: `backend/crates/kanflow-server` — Axum HTTP API, `sqlx` + PostgreSQL for projects/columns/tasks/users, MongoDB for per-project chat, `app_config` documents, and unstructured blob payloads.
* Run Postgres + Mongo locally: `docker compose up -d` (see repo root `docker-compose.yml`).
* Environment: copy `.env.example` — `DATABASE_URL`, `MONGO_URI`, `MONGO_DB`, `KANFLOW_PORT`.
* Health: `GET /health` — used in automated contract tests without live databases.
* Postgres migrations: `20260427100001_project_members.sql` (`project_members` join table), `20260427120000_seed_demo.sql` (full demo dataset: users, projects, columns, five tasks, comment with fixed id, task dependency, time entry, team rows), and `20260427135000_seed_demo_backfill.sql` (idempotent gap-fill for DBs that ran an older seed). All UUIDs and timestamps align with `frontend/src/constants.ts`.

#### Users API & Keycloak alignment

* **`GET /api/v1/users`** — Lists Postgres `users` (id, name, email, role). Used to hydrate assignee pickers when the API is online.
* **`POST /api/v1/users`** — Creates a user row (JSON body: `name`, `email`, optional `role`, default `member`). Requires a **Keycloak realm role** `admin` on the JWT (`realm_access.roles`). When Keycloak is not configured, contract tests attach a dev principal that includes `admin` so the route stays testable.
* **Identity ↔ app user id:** Keycloak’s `sub` is not the Postgres UUID. For demo accounts whose **email** matches `MOCK_USERS` in `frontend/src/constants.ts` (`alex@example.com`, `sam@example.com`, `jordan@example.com`), `AuthProvider` maps the session to the **seed UUID** so assignees, comments, and notifications line up with the database.
* **Realm import:** `keycloak/kanflow-realm.json` includes `admin`, `demo`, and the three seed users above (password **`kanflow`** for Alex/Sam/Jordan in dev; change in production). After changing the file, re-import or recreate the realm in Keycloak.
* **Admin-created users:** Header **User** (admin only) opens a modal that inserts into Postgres. The operator must **create the same user in Keycloak** (matching email) so that person can sign in; the UI surfaces a reminder notification.

### AI

* Client: `frontend/src/lib/ai.ts` — Ollama (`VITE_OLLAMA_URL`, `VITE_OLLAMA_MODEL`); see `frontend/.env.example`. Dashboard **Kanflow AI insight** and task/chat flows call this client.

---

## 9. UI/UX Specification

See `DESIGN.md` for the full Meta-inspired design system.

### Views Layout

```
[ Sidebar Nav ]  |  [ Active View ]
                 |
                 |  Kanban: [ Column ] [ Column ] [ + Add Column ]
                 |  Dashboard: [ Widget Grid ]
                 |  Reporting: [ Charts ]
                 |  Todos: [ Eisenhower Grid ]
                 |  Time: [ Time Entry Table ]
```

### Task Card UI

* Title (required)
* Priority badge (low / medium / high)
* Tags (color pills)
* Assignee avatar
* Due date indicator
* Comment count
* AI suggested indicator (if `aiSuggested: true`)

### Interactions

| Action | Behavior |
|--------|----------|
| Click task card | Open TaskModal |
| Drag task card | Move / reorder |
| Drag column | Reorder columns |
| Click notification | Mark read + navigate |
| Start timer | Activates global activeTimer |

---

## 10. Error Handling

* Network failure → show toast + retry
* Invalid input → inline validation
* API unavailable → continue with localStorage-backed state where applicable
* Empty task title → blocked at submit

---

## 11. Testing Strategy

### Unit Tests

* AppContext reducers / state logic
* Utility functions (`src/lib/utils.ts`)

### Integration Tests

* Task CRUD operations
* Drag-and-drop status sync
* Timer start/stop/persist

### E2E Tests

* Create project → add columns → add tasks → move tasks
* Log time on task → verify entry appears in Time Keeping view
* AI insight generation → widget displays result

---

## 12. Future Enhancements

* Full API sync for projects/tasks (replace or mirror localStorage)
* Real-time multi-user collaboration (WebSocket or SSE against Kanflow server)
* File attachments on tasks
* Activity log / audit trail
* Push notifications
* Mobile responsive layout
* Advanced AI: auto-assign, deadline prediction, workload balancing

---

## 13. Definition of Done (DoD)

A feature is complete when:

* [ ] Spec implemented
* [ ] Tests written and passing
* [ ] UI matches DESIGN.md
* [ ] No console errors
* [ ] localStorage persistence verified
* [ ] Edge cases handled

---

## 14. Agent Execution Rules

1. Do not implement unspecified features
2. Always reference spec section before coding
3. Generate types before logic
4. Write tests alongside features
5. Prefer clarity over abstraction
6. Task `status` must always match an existing column title in the parent project
