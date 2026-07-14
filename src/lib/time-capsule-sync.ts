import type { TimeCapsuleEntry } from "@/lib/time-capsule";
import { getOracleClientHeaders } from "@/lib/oracle-client-id";

type ServerCapsulesResponse = {
  records?: TimeCapsuleEntry[];
};

function recordTime(record: TimeCapsuleEntry) {
  const times = [record.createdAt, record.openDate, record.openedAt, record.dismissedAt]
    .filter(Boolean)
    .map((value) => Date.parse(value as string))
    .filter(Number.isFinite);

  return times.length ? Math.max(...times) : 0;
}

export function mergeTimeCapsules(localRecords: TimeCapsuleEntry[], serverRecords: TimeCapsuleEntry[], limit = 24) {
  const byId = new Map<string, TimeCapsuleEntry>();

  [...serverRecords, ...localRecords].forEach((record) => {
    const existing = byId.get(record.id);
    if (!existing || recordTime(record) >= recordTime(existing)) {
      byId.set(record.id, record);
    }
  });

  return [...byId.values()].sort((a, b) => recordTime(b) - recordTime(a)).slice(0, limit);
}

export async function fetchServerTimeCapsules() {
  const response = await fetch("/api/oracle/capsules", {
    method: "GET",
    headers: { Accept: "application/json", ...getOracleClientHeaders() },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch server time capsules.");
  }

  const payload = (await response.json()) as ServerCapsulesResponse;
  return Array.isArray(payload.records) ? payload.records : [];
}

export async function persistServerTimeCapsule(record: TimeCapsuleEntry) {
  const response = await fetch("/api/oracle/capsules", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getOracleClientHeaders() },
    body: JSON.stringify({ record }),
  });

  if (!response.ok) {
    throw new Error("Failed to persist server time capsule.");
  }
}
