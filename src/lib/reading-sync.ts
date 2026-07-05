import type { 阅读记录 } from "@/lib/reading-history";

type ServerReadingsResponse = {
  records?: 阅读记录[];
};

function readingTime(record: 阅读记录) {
  const time = Date.parse(record.createdAt);
  return Number.isFinite(time) ? time : 0;
}

export function mergeReadingRecords(localRecords: 阅读记录[], serverRecords: 阅读记录[], limit = 80) {
  const byId = new Map<string, 阅读记录>();

  [...serverRecords, ...localRecords].forEach((record) => {
    const existing = byId.get(record.id);
    if (!existing || readingTime(record) >= readingTime(existing)) {
      byId.set(record.id, record);
    }
  });

  return [...byId.values()].sort((a, b) => readingTime(b) - readingTime(a)).slice(0, limit);
}

export async function fetchServerReadings() {
  const response = await fetch("/api/oracle/readings", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch server readings.");
  }

  const payload = (await response.json()) as ServerReadingsResponse;
  return Array.isArray(payload.records) ? payload.records : [];
}

export async function persistServerReading(record: 阅读记录) {
  const response = await fetch("/api/oracle/readings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record }),
  });

  if (!response.ok) {
    throw new Error("Failed to persist server reading.");
  }
}
