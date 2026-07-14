"use client";

const ORACLE_CLIENT_ID_KEY = "oracle-client-id-v1";
const FALLBACK_PREFIX = "oracle-client";

let cachedClientId: string | null = null;

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${FALLBACK_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function getOracleClientId() {
  if (cachedClientId) return cachedClientId;
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(ORACLE_CLIENT_ID_KEY);
  if (stored) {
    cachedClientId = stored;
    return stored;
  }

  const clientId = createClientId();
  window.localStorage.setItem(ORACLE_CLIENT_ID_KEY, clientId);
  cachedClientId = clientId;
  return clientId;
}

export function getOracleClientHeaders(): Record<string, string> {
  const clientId = getOracleClientId();
  return clientId ? { "X-Oracle-Client-Id": clientId } : {};
}
