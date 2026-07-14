import type { 每日记录 } from "@/lib/daily-record";
import type { DreamJournalEntry, DreamMood } from "@/lib/dream-journal";
import type { MonthlyReportSnapshot } from "@/lib/monthly-report";
import type { 阅读记录 } from "@/lib/reading-history";
import type { TimeCapsuleEntry } from "@/lib/time-capsule";

const BACKUP_FORMAT = "oracle-room-backup";
const BACKUP_VERSION = 1;
const DREAM_MOODS: DreamMood[] = ["朦胧", "平静", "牵挂", "压迫", "惊醒", "温柔", "未知"];

export type OracleBackupData = {
  readings: 阅读记录[];
  daily: 每日记录[];
  dreams: DreamJournalEntry[];
  capsules: TimeCapsuleEntry[];
  monthlyReports: MonthlyReportSnapshot[];
};

export type OracleBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: OracleBackupData;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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

function isDailyRecord(value: unknown): value is 每日记录 {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.readingId === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.dueDate === "string" &&
    typeof value.title === "string" &&
    typeof value.prompt === "string" &&
    (value.completedAt === undefined || typeof value.completedAt === "string")
  );
}

function isDreamEntry(value: unknown): value is DreamJournalEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.title === "string" &&
    typeof value.dreamText === "string" &&
    DREAM_MOODS.includes(value.mood as DreamMood) &&
    isStringArray(value.symbols) &&
    typeof value.linkedQuestion === "string" &&
    typeof value.linkedSpreadName === "string" &&
    isStringArray(value.linkedCardNames) &&
    (value.interpretationMode === "standard" || value.interpretationMode === "shadow") &&
    typeof value.archetypeProfileName === "string"
  );
}

function isTimeCapsule(value: unknown): value is TimeCapsuleEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.title === "string" &&
    typeof value.message === "string" &&
    typeof value.openDate === "string" &&
    (value.openedAt === undefined || typeof value.openedAt === "string") &&
    (value.dismissedAt === undefined || typeof value.dismissedAt === "string") &&
    typeof value.linkedQuestion === "string" &&
    typeof value.linkedSpreadName === "string" &&
    isStringArray(value.linkedCardNames) &&
    (value.interpretationMode === "standard" || value.interpretationMode === "shadow") &&
    typeof value.archetypeProfileName === "string"
  );
}

function isMonthlyReport(value: unknown): value is MonthlyReportSnapshot {
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

function isValidBackupData(value: unknown): value is OracleBackupData {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.readings) &&
    value.readings.every(isReadingRecord) &&
    Array.isArray(value.daily) &&
    value.daily.every(isDailyRecord) &&
    Array.isArray(value.dreams) &&
    value.dreams.every(isDreamEntry) &&
    Array.isArray(value.capsules) &&
    value.capsules.every(isTimeCapsule) &&
    Array.isArray(value.monthlyReports) &&
    value.monthlyReports.every(isMonthlyReport)
  );
}

export function createOracleBackup(data: OracleBackupData): OracleBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function parseOracleBackup(raw: string): OracleBackup {
  const parsed = JSON.parse(raw) as unknown;
  if (
    !isRecord(parsed) ||
    parsed.format !== BACKUP_FORMAT ||
    parsed.version !== BACKUP_VERSION ||
    typeof parsed.exportedAt !== "string" ||
    !isValidBackupData(parsed.data)
  ) {
    throw new Error("这不是有效的神谕室档案文件。");
  }

  return parsed as OracleBackup;
}
