# Kanflow — Known Errors & Solutions

---

## 1. Keycloak shows "HTTPS required" on first login

### Symptom
After running `docker compose up`, navigating to `http://localhost:3000` redirects to Keycloak but Keycloak returns an error page:

```
HTTPS required
```

### Root cause
Two separate issues can cause this:

1. **`master` realm** (admin console and some bootstrap flows) ships with **`sslRequired: external`**, so plain `http://` to Keycloak is rejected even when `kanflow-realm.json` sets `sslRequired: "none"` for the `kanflow` realm only.

2. Keycloak's `--import-realm` **only imports a realm if it does not already exist**. If a named volume held an older DB (before `sslRequired: "none"` in JSON), a stale `kanflow` realm could keep `external`.

### Solution (automatic)

Compose runs a one-shot **`keycloak-ssl-bootstrap`** service after Keycloak starts. It uses `kcadm.sh` to set **`sslRequired=NONE`** on **`master`** and, if present, **`kanflow`** (`keycloak/bootstrap-master-ssl.sh`). Backend and frontend wait for this job to finish before starting.

Bring the stack up as usual:

```bash
docker compose up -d
```

### Solution (manual cleanup)

If you still see HTTPS errors after a bad volume or custom Keycloak data:

```bash
docker compose down -v
docker compose up -d
```

The `-v` flag removes named volumes so Postgres/Mongo/Ollama data reset too — only use when you accept a full data wipe.

### Prevention
The `keycloak` service does not use a persistent volume for its dev DB, so each fresh container can re-import `keycloak/kanflow-realm.json`.

These environment variables remain set for HTTP dev and reverse proxies:

```yaml
KC_HTTP_ENABLED: "true"
KC_HOSTNAME_STRICT: "false"
KC_HOSTNAME_STRICT_HTTPS: "false"
KC_PROXY_HEADERS: "xforwarded"
```

---

## 2. Keycloak `ssl_required` error when behind Cloudflare or a reverse proxy

### Symptom
Keycloak logs show repeated `LOGIN_ERROR` events with `error="ssl_required"` from a Cloudflare (or other proxy) IP:

```
WARN  [org.keycloak.events] type="LOGIN_ERROR", realmName="master",
      ipAddress="172.67.x.x", error="ssl_required"
```

Users see the "HTTPS required" error page even though the public URL is already HTTPS.

### Root cause
Cloudflare (and most reverse proxies) **terminate SSL** and forward the request to Keycloak over plain HTTP.
Keycloak sees an incoming HTTP connection from a non-localhost IP and — because the **master** realm defaults to `sslRequired: external` — rejects it, even though the client's original connection was HTTPS.

Setting `KC_PROXY: "none"` explicitly disabled proxy-header trust, making the problem worse.

### Solution

Replace `KC_PROXY: "none"` with `KC_PROXY_HEADERS: "xforwarded"` in `docker-compose.yml`:

```yaml
KC_PROXY_HEADERS: "xforwarded"
```

This tells Keycloak 25 to trust the `X-Forwarded-Proto: https` header that Cloudflare injects.
KC then considers the connection as HTTPS and the `sslRequired=external` check on the master realm passes.

Then restart Keycloak:

```bash
docker compose up -d keycloak
```

### Notes
- Use `"forwarded"` instead of `"xforwarded"` if your proxy sends RFC 7239 `Forwarded:` headers (e.g. some nginx configs).
- The `kanflow` realm JSON already has `sslRequired: "none"`, so this issue only surfaces on the master realm when accessed through a proxy.
- This is safe: Keycloak only trusts the forwarded header from the immediate upstream (the proxy), not from arbitrary internet clients.

---
