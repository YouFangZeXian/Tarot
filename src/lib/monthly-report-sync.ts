import type { MonthlyReportSnapshot } from "@/lib/monthly-report";

type ServerMonthlyReportsResponse = {
  records?: MonthlyReportSnapshot[];
};

function reportTime(record: MonthlyReportSnapshot) {
  const time = Date.parse(record.createdAt);
  return Number.isFinite(time) ? time : 0;
}

export function mergeMonthlyReports(
  localRecords: MonthlyReportSnapshot[],
  serverRecords: MonthlyReportSnapshot[],
  limit = 24,
) {
  const byId = new Map<string, MonthlyReportSnapshot>();

  [...serverRecords, ...localRecords].forEach((record) => {
    const existing = byId.get(record.id);
    if (!existing || reportTime(record) >= reportTime(existing)) {
      byId.set(record.id, record);
    }
  });

  return [...byId.values()].sort((a, b) => reportTime(b) - reportTime(a)).slice(0, limit);
}

export async function fetchServerMonthlyReports() {
  const response = await fetch("/api/oracle/monthly-reports", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch server monthly reports.");
  }

  const payload = (await response.json()) as ServerMonthlyReportsResponse;
  return Array.isArray(payload.records) ? payload.records : [];
}

export async function persistServerMonthlyReport(record: MonthlyReportSnapshot) {
  const response = await fetch("/api/oracle/monthly-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record }),
  });

  if (!response.ok) {
    throw new Error("Failed to persist server monthly report.");
  }
}
