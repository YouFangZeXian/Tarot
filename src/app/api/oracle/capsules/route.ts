import { NextResponse } from "next/server";
import {
  readServerCollection,
  sortByCreatedAtDesc,
  updateServerCollection,
  upsertById,
} from "@/lib/server/oracle-file-database";
import type { TimeCapsuleEntry } from "@/lib/time-capsule";
import { getClientCollectionName } from "@/lib/server/oracle-client-context";

export const runtime = "nodejs";

const CAPSULES_COLLECTION = "time-capsules.json";
const MAX_CAPSULE_RECORDS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isTimeCapsuleEntry(value: unknown): value is TimeCapsuleEntry {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.title === "string" &&
    typeof value.message === "string" &&
    typeof value.openDate === "string" &&
    (typeof value.openedAt === "undefined" || typeof value.openedAt === "string") &&
    (typeof value.dismissedAt === "undefined" || typeof value.dismissedAt === "string") &&
    typeof value.linkedQuestion === "string" &&
    typeof value.linkedSpreadName === "string" &&
    isStringArray(value.linkedCardNames) &&
    (value.interpretationMode === "standard" || value.interpretationMode === "shadow") &&
    typeof value.archetypeProfileName === "string"
  );
}

function isPendingCapsule(entry: TimeCapsuleEntry, now = new Date()) {
  if (entry.openedAt || entry.dismissedAt) return false;
  const target = new Date(`${entry.openDate}T00:00:00`);
  return !Number.isNaN(target.getTime()) && target.getTime() <= now.getTime();
}

export async function GET(request: Request) {
  const collectionName = getClientCollectionName(request, CAPSULES_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const records = await readServerCollection<TimeCapsuleEntry>(collectionName);
  const sortedRecords = sortByCreatedAtDesc(records).slice(0, MAX_CAPSULE_RECORDS);

  return NextResponse.json({
    records: sortedRecords,
    meta: {
      count: sortedRecords.length,
      dueCount: sortedRecords.filter((record) => isPendingCapsule(record)).length,
      latestCreatedAt: sortedRecords[0]?.createdAt ?? null,
    },
  });
}

export async function POST(request: Request) {
  const collectionName = getClientCollectionName(request, CAPSULES_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const record = isRecord(payload) && "record" in payload ? payload.record : payload;

  if (!isTimeCapsuleEntry(record)) {
    return NextResponse.json({ error: "Invalid time capsule payload." }, { status: 400 });
  }

  const records = await updateServerCollection<TimeCapsuleEntry>(collectionName, (current) =>
    upsertById(current, record, MAX_CAPSULE_RECORDS),
  );

  return NextResponse.json({
    record,
    recordsCount: records.length,
  });
}
