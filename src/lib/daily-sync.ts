import type { 每日记录 } from "@/lib/daily-record";
import { getOracleClientHeaders } from "@/lib/oracle-client-id";

type ServerDailyResponse = {
  records?: 每日记录[];
};

function recordTime(record: 每日记录) {
  const completedTime = record.completedAt ? Date.parse(record.completedAt) : 0;
  const createdTime = Date.parse(record.createdAt);
  const dueTime = Date.parse(record.dueDate);
  return Math.max(
    Number.isFinite(completedTime) ? completedTime : 0,
    Number.isFinite(createdTime) ? createdTime : 0,
    Number.isFinite(dueTime) ? dueTime : 0,
  );
}

export function mergeDailyRecords(localRecords: 每日记录[], serverRecords: 每日记录[], limit = 80) {
  const byId = new Map<string, 每日记录>();

  [...serverRecords, ...localRecords].forEach((record) => {
    const existing = byId.get(record.id);
    if (!existing || recordTime(record) >= recordTime(existing)) {
      byId.set(record.id, record);
    }
  });

  return [...byId.values()].sort((a, b) => recordTime(b) - recordTime(a)).slice(0, limit);
}

export async function fetchServerDailyRecords() {
  const response = await fetch("/api/oracle/daily", {
    method: "GET",
    headers: { Accept: "application/json", ...getOracleClientHeaders() },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch server daily records.");
  }

  const payload = (await response.json()) as ServerDailyResponse;
  return Array.isArray(payload.records) ? payload.records : [];
}

export async function persistServerDailyRecord(record: 每日记录) {
  const response = await fetch("/api/oracle/daily", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getOracleClientHeaders() },
    body: JSON.stringify({ record }),
  });

  if (!response.ok) {
    throw new Error("Failed to persist server daily record.");
  }
}
