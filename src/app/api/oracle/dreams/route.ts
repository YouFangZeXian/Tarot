import { NextResponse } from "next/server";
import {
  readServerCollection,
  sortByCreatedAtDesc,
  updateServerCollection,
  upsertById,
} from "@/lib/server/oracle-file-database";
import type { DreamJournalEntry, DreamMood } from "@/lib/dream-journal";
import { getClientCollectionName } from "@/lib/server/oracle-client-context";

export const runtime = "nodejs";

const DREAMS_COLLECTION = "dream-journal.json";
const MAX_DREAM_RECORDS = 500;
const DREAM_MOODS: DreamMood[] = ["朦胧", "平静", "牵挂", "压迫", "惊醒", "温柔", "未知"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isDreamMood(value: unknown): value is DreamMood {
  return typeof value === "string" && DREAM_MOODS.includes(value as DreamMood);
}

function isDreamJournalEntry(value: unknown): value is DreamJournalEntry {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.title === "string" &&
    typeof value.dreamText === "string" &&
    isDreamMood(value.mood) &&
    isStringArray(value.symbols) &&
    typeof value.linkedQuestion === "string" &&
    typeof value.linkedSpreadName === "string" &&
    isStringArray(value.linkedCardNames) &&
    (value.interpretationMode === "standard" || value.interpretationMode === "shadow") &&
    typeof value.archetypeProfileName === "string"
  );
}

export async function GET(request: Request) {
  const collectionName = getClientCollectionName(request, DREAMS_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const records = await readServerCollection<DreamJournalEntry>(collectionName);
  const sortedRecords = sortByCreatedAtDesc(records).slice(0, MAX_DREAM_RECORDS);

  return NextResponse.json({
    records: sortedRecords,
    meta: {
      count: sortedRecords.length,
      latestCreatedAt: sortedRecords[0]?.createdAt ?? null,
    },
  });
}

export async function POST(request: Request) {
  const collectionName = getClientCollectionName(request, DREAMS_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const record = isRecord(payload) && "record" in payload ? payload.record : payload;

  if (!isDreamJournalEntry(record)) {
    return NextResponse.json({ error: "Invalid dream journal payload." }, { status: 400 });
  }

  const records = await updateServerCollection<DreamJournalEntry>(collectionName, (current) =>
    upsertById(current, record, MAX_DREAM_RECORDS),
  );

  return NextResponse.json({
    record,
    recordsCount: records.length,
  });
}
