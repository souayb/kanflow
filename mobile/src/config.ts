import Constants from 'expo-constants';

/**
 * Runtime config. On a physical device `localhost` points at the phone, not your
 * dev machine — override these with your machine's LAN IP via env vars, e.g.:
 *
 *   EXPO_PUBLIC_API_URL=http://192.168.1.50:8080\
 *   EXPO_PUBLIC_KEYCLOAK_URL=http://192.168.1.50:8180 npx expo start
 *
 * Env vars win; otherwise fall back to `app.json` → expo.extra.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:8080';

export const KEYCLOAK_URL: string =
  process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? extra.keycloakUrl ?? 'http://localhost:8180';

export const KEYCLOAK_REALM: string =
  process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? extra.keycloakRealm ?? 'kanflow';

export const KEYCLOAK_CLIENT_ID: string =
  process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? extra.keycloakClientId ?? 'kanflow-mobile';

/** OIDC issuer used for auto-discovery. */
export const KEYCLOAK_ISSUER = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;
