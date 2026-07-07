# Kanflow Mobile (Expo / React Native)

A native iOS/Android client for Kanflow. It talks to the same Rust API and
Keycloak realm as the web app, and surfaces the one-way **GitHub sync**: any task
you create here opens a GitHub Issue (and, if configured, a Projects v2 item).

## Prerequisites

- The backend stack running: `docker compose up -d` from the repo root.
- Node 18+ and the Expo Go app on your phone (or an iOS/Android simulator).

## Run

```bash
cd mobile
npm install
# If versions drift for your installed Expo SDK, run: npx expo install --fix
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

### Pointing at your machine (physical devices)

On a real phone, `localhost` is the phone itself — point the app at your
computer's LAN IP. Find it (`ipconfig getifaddr en0` on macOS) and start with:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:8080 \
EXPO_PUBLIC_KEYCLOAK_URL=http://192.168.1.50:8180 \
npx expo start
```

Simulators on the same machine can use the defaults in `app.json`.

## Auth

Login uses Keycloak Authorization Code + PKCE via the `kanflow-mobile` public
client (defined in `keycloak/kanflow-realm.json`). Its allowed redirect URIs
include `kanflow://*` and `exp://*` so both Expo Go and standalone builds work.
Demo users from the realm: `demo` / `demo` and `admin` / `admin`.

## Structure

| Path | Purpose |
|------|---------|
| `src/config.ts` | API + Keycloak URLs (env-overridable) |
| `src/auth.tsx` | Keycloak PKCE login, token refresh, secure storage |
| `src/api.ts` | Typed REST client (mirrors the web app's contract) |
| `src/navigation.tsx` | Tiny stack navigator (no nav library) |
| `src/screens/*` | Login, Projects, Board, NewTask, TaskDetail |

## GitHub sync

Creating a task calls `POST /api/v1/projects/:id/tasks`. When the backend has
`GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` set (see repo root `.env.example`),
it creates the issue and returns `githubIssueNumber` / `githubIssueUrl`, which the
app displays and lets you open. Moving a task to a column titled **Done** closes
the issue; deleting a task closes it too.
