import { createLocalCollection } from "@/lib/oracle-storage";

export type TimeCapsuleEntry = {
  id: string;
  createdAt: string;
  title: string;
  message: string;
  openDate: string;
  openedAt?: string;
  dismissedAt?: string;
  linkedQuestion: string;
  linkedSpreadName: string;
  linkedCardNames: string[];
  interpretationMode: "standard" | "shadow";
  archetypeProfileName: string;
};

const TIME_CAPSULE_KEY = "oracle-time-capsule-v1";
const timeCapsuleCollection = createLocalCollection<TimeCapsuleEntry>(TIME_CAPSULE_KEY);

export function loadTimeCapsules(): TimeCapsuleEntry[] {
  return timeCapsuleCollection.load();
}

export function isCapsuleDue(entry: TimeCapsuleEntry, now = new Date()) {
  if (entry.dismissedAt || entry.openedAt) return false;

  const target = new Date(`${entry.openDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return false;

  return target.getTime() <= now.getTime();
}

export function countDueCapsules(entries: TimeCapsuleEntry[], now = new Date()) {
  return entries.filter((entry) => isCapsuleDue(entry, now)).length;
}

export function markCapsuleOpened(entries: TimeCapsuleEntry[], capsuleId: string) {
  return entries.map((entry) =>
    entry.id === capsuleId
      ? {
          ...entry,
          openedAt: entry.openedAt ?? new Date().toISOString(),
        }
      : entry,
  );
}

export function dismissCapsuleReminder(entries: TimeCapsuleEntry[], capsuleId: string) {
  return entries.map((entry) =>
    entry.id === capsuleId
      ? {
          ...entry,
          dismissedAt: entry.dismissedAt ?? new Date().toISOString(),
        }
      : entry,
  );
}

export function saveTimeCapsules(entries: TimeCapsuleEntry[]) {
  timeCapsuleCollection.save(entries);
}

export function createTimeCapsuleEntry(input: Omit<TimeCapsuleEntry, "id" | "createdAt">): TimeCapsuleEntry {
  return {
    ...input,
    id: `capsule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
}

export function getDefaultCapsuleDate() {
  const date = new Date();
  date.setDate(date.getDate() + 21);
  return date.toISOString().slice(0, 10);
}

export function getCapsuleStatus(openDate: string) {
  const now = new Date();
  const target = new Date(`${openDate}T00:00:00`);
  const diff = target.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (Number.isNaN(days)) {
    return "日期未定";
  }

  if (days <= 0) {
    return "已经到了开启的时候";
  }

  if (days === 1) {
    return "再过 1 天开启";
  }

  return `再过 ${days} 天开启`;
}
