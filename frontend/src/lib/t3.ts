import { KANFLOW_KEYS } from './storage';

export const DEFAULT_T3_URL = 'https://app.t3.codes/';

export type AgentSurface = 't3' | 'warp';

export function envDefaultT3Url(): string {
  const fromEnv = (import.meta as { env?: { VITE_T3_URL?: string } }).env?.VITE_T3_URL;
  return normalizeT3Url(fromEnv) ?? normalizeT3Url(DEFAULT_T3_URL) ?? DEFAULT_T3_URL;
}

export function normalizeT3Url(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value) ? value : `https://${value}`;
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function readT3Url(): string {
  return normalizeT3Url(localStorage.getItem(KANFLOW_KEYS.t3Url)) ?? envDefaultT3Url();
}

export function writeT3Url(url: string): string {
  const normalized = normalizeT3Url(url) ?? envDefaultT3Url();
  localStorage.setItem(KANFLOW_KEYS.t3Url, normalized);
  return normalized;
}

export function readAgentSurface(): AgentSurface {
  return localStorage.getItem(KANFLOW_KEYS.agentSurface) === 'warp' ? 'warp' : 't3';
}

export function writeAgentSurface(surface: AgentSurface): void {
  localStorage.setItem(KANFLOW_KEYS.agentSurface, surface);
}

export function openT3(
  url: string,
  open: typeof window.open = (...args) => window.open(...args),
): Window | null {
  return open(url, '_blank', 'noopener,noreferrer');
}
