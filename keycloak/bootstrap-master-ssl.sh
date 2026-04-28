#!/usr/bin/env bash
# Runs once after Keycloak is reachable: relax master (and kanflow) sslRequired for dev HTTP.
# See ERROR.md — master defaults to sslRequired=external, which breaks plain HTTP and some proxies.
set -euo pipefail

SERVER="${KC_SERVER:-http://keycloak:8180}"
USER="${KEYCLOAK_ADMIN:-admin}"
PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

for i in $(seq 1 120); do
  if /opt/keycloak/bin/kcadm.sh config credentials \
    --server "$SERVER" --realm master --user "$USER" --password "$PASS" 2>/dev/null; then
    echo "kcadm: authenticated to $SERVER (attempt $i)"
    break
  fi
  if [[ "$i" -eq 120 ]]; then
    echo "kcadm: could not reach Keycloak at $SERVER after 120 attempts" >&2
    exit 1
  fi
  sleep 2
done

/opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE --server "$SERVER"
echo "kcadm: master realm sslRequired=NONE"

if /opt/keycloak/bin/kcadm.sh get realms/kanflow --server "$SERVER" &>/dev/null; then
  /opt/keycloak/bin/kcadm.sh update realms/kanflow -s sslRequired=NONE --server "$SERVER" || true
  echo "kcadm: kanflow realm sslRequired=NONE"
else
  echo "kcadm: kanflow realm not present yet (import may still run); skipping"
fi
