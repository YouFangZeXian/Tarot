import { NextResponse } from "next/server";
import {
  readServerCollection,
  sortByCreatedAtDesc,
  updateServerCollection,
  upsertById,
} from "@/lib/server/oracle-file-database";
import type { MonthlyReportSnapshot } from "@/lib/monthly-report";
import { getClientCollectionName } from "@/lib/server/oracle-client-context";

export const runtime = "nodejs";

const MONTHLY_REPORTS_COLLECTION = "monthly-reports.json";
const MAX_MONTHLY_REPORTS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMonthlyReportSnapshot(value: unknown): value is MonthlyReportSnapshot {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.monthKey === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.archetypePulse === "string" &&
    typeof value.dreamThread === "string" &&
    typeof value.capsuleEcho === "string" &&
    typeof value.nextMonthPrompt === "string"
  );
}

export async function GET(request: Request) {
  const collectionName = getClientCollectionName(request, MONTHLY_REPORTS_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const records = await readServerCollection<MonthlyReportSnapshot>(collectionName);
  const sortedRecords = sortByCreatedAtDesc(records).slice(0, MAX_MONTHLY_REPORTS);

  return NextResponse.json({
    records: sortedRecords,
    meta: {
      count: sortedRecords.length,
      latestMonthKey: sortedRecords[0]?.monthKey ?? null,
      latestCreatedAt: sortedRecords[0]?.createdAt ?? null,
    },
  });
}

export async function POST(request: Request) {
  const collectionName = getClientCollectionName(request, MONTHLY_REPORTS_COLLECTION);
  if (!collectionName) {
    return NextResponse.json({ error: "Missing or invalid oracle client id." }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const record = isRecord(payload) && "record" in payload ? payload.record : payload;

  if (!isMonthlyReportSnapshot(record)) {
    return NextResponse.json({ error: "Invalid monthly report payload." }, { status: 400 });
  }

  const records = await updateServerCollection<MonthlyReportSnapshot>(collectionName, (current) =>
    upsertById(current, record, MAX_MONTHLY_REPORTS),
  );

  return NextResponse.json({
    record,
    recordsCount: records.length,
  });
}
