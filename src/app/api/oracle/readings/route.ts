import { NextResponse } from "next/server";
import {
  readServerCollection,
  sortByCreatedAtDesc,
  updateServerCollection,
  upsertById,
} from "@/lib/server/oracle-file-database";
import type { 阅读记录 } from "@/lib/reading-history";
import { getClientCollectionName } from "@/lib/server/oracle-client-context";

export const runtime = "nodejs";

const READINGS_COLLECTION = "readings.json";
const MAX_READING_RECORDS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSavedCard(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.nameZh === "string" &&
    (value.orientation === "Upright" || value.orientation === "Reversed") &&
    typeof value.archetypeZh === "string"
  );
}

function isReadingRecord(value: unknown): value is 阅读记录 {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.question === "string" &&
    typeof value.spreadId === "string" &&
    typeof value.spreadName === "string" &&
    (value.interpretationMode === "standard" || value.interpretationMode === "shadow") &&
    Array.isArray(value.cards) &&
    value.cards.every(isSavedCard) &&
    typeof value.readingText === "string" &&
    typeof value.profileName === "string" &&
    typeof value.energyHeadline === "string" &&
    typeof value.reflectionQuestion === "string"
  );
}

export async function GET(request: Request) {
  const collectionName = getClientCollectionName(request, READINGS_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const records = await readServerCollection<阅读记录>(collectionName);
  const sortedRecords = sortByCreatedAtDesc(records).slice(0, MAX_READING_RECORDS);

  return NextResponse.json({
    records: sortedRecords,
    meta: {
      count: sortedRecords.length,
      latestCreatedAt: sortedRecords[0]?.createdAt ?? null,
    },
  });
}

export async function POST(request: Request) {
  const collectionName = getClientCollectionName(request, READINGS_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const record = isRecord(payload) && "record" in payload ? payload.record : payload;

  if (!isReadingRecord(record)) {
    return NextResponse.json({ error: "Invalid reading record payload." }, { status: 400 });
  }

  const records = await updateServerCollection<阅读记录>(collectionName, (current) =>
    upsertById(current, record, MAX_READING_RECORDS),
  );

  return NextResponse.json({
    record,
    recordsCount: records.length,
  });
}
