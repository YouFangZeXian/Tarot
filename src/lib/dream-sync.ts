import type { DreamJournalEntry } from "@/lib/dream-journal";

type ServerDreamsResponse = {
  records?: DreamJournalEntry[];
};

function recordTime(record: DreamJournalEntry) {
  const time = Date.parse(record.createdAt);
  return Number.isFinite(time) ? time : 0;
}

export function mergeDreamEntries(localRecords: DreamJournalEntry[], serverRecords: DreamJournalEntry[], limit = 24) {
  const byId = new Map<string, DreamJournalEntry>();

  [...serverRecords, ...localRecords].forEach((record) => {
    const existing = byId.get(record.id);
    if (!existing || recordTime(record) >= recordTime(existing)) {
      byId.set(record.id, record);
    }
  });

  return [...byId.values()].sort((a, b) => recordTime(b) - recordTime(a)).slice(0, limit);
}

export async function fetchServerDreamEntries() {
  const response = await fetch("/api/oracle/dreams", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch server dream entries.");
  }

  const payload = (await response.json()) as ServerDreamsResponse;
  return Array.isArray(payload.records) ? payload.records : [];
}

export async function persistServerDreamEntry(record: DreamJournalEntry) {
  const response = await fetch("/api/oracle/dreams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record }),
  });

  if (!response.ok) {
    throw new Error("Failed to persist server dream entry.");
  }
}
