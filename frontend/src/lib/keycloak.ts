/**
 * Keycloak singleton — one instance shared across the whole app.
 * Configured via Vite env vars so it works in both dev and Docker.
 */
import Keycloak from 'keycloak-js';

const KC_URL = (import.meta as any).env?.VITE_KEYCLOAK_URL ?? 'http://localhost:8180';
const KC_REALM = (import.meta as any).env?.VITE_KEYCLOAK_REALM ?? 'kanflow';
const KC_CLIENT = (import.meta as any).env?.VITE_KEYCLOAK_CLIENT_ID ?? 'kanflow-frontend';

const keycloak = new Keycloak({
  url: KC_URL,
  realm: KC_REALM,
  clientId: KC_CLIENT,
});

export default keycloak;
