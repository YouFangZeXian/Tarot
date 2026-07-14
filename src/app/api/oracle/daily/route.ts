import { NextResponse } from "next/server";
import {
  readServerCollection,
  sortByCreatedAtDesc,
  updateServerCollection,
  upsertById,
} from "@/lib/server/oracle-file-database";
import type { 每日记录 } from "@/lib/daily-record";
import { getClientCollectionName } from "@/lib/server/oracle-client-context";

export const runtime = "nodejs";

const DAILY_COLLECTION = "daily-records.json";
const MAX_DAILY_RECORDS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDailyRecord(value: unknown): value is 每日记录 {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.readingId === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.dueDate === "string" &&
    typeof value.title === "string" &&
    typeof value.prompt === "string" &&
    (typeof value.completedAt === "undefined" || typeof value.completedAt === "string")
  );
}

export async function GET(request: Request) {
  const collectionName = getClientCollectionName(request, DAILY_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const records = await readServerCollection<每日记录>(collectionName);
  const sortedRecords = sortByCreatedAtDesc(records).slice(0, MAX_DAILY_RECORDS);

  return NextResponse.json({
    records: sortedRecords,
    meta: {
      count: sortedRecords.length,
      pendingCount: sortedRecords.filter((record) => !record.completedAt).length,
      latestCreatedAt: sortedRecords[0]?.createdAt ?? null,
    },
  });
}

export async function POST(request: Request) {
  const collectionName = getClientCollectionName(request, DAILY_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const record = isRecord(payload) && "record" in payload ? payload.record : payload;

  if (!isDailyRecord(record)) {
    return NextResponse.json({ error: "Invalid daily record payload." }, { status: 400 });
  }

  const records = await updateServerCollection<每日记录>(collectionName, (current) =>
    upsertById(current, record, MAX_DAILY_RECORDS),
  );

  return NextResponse.json({
    record,
    recordsCount: records.length,
  });
}
