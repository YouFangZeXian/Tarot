import type { 阅读记录 } from "@/lib/reading-history";
import { createLocalCollection } from "@/lib/oracle-storage";

export type 每日记录 = {
  id: string;
  readingId: string;
  createdAt: string;
  dueDate: string;
  title: string;
  prompt: string;
  completedAt?: string;
};

const 每日记录键 = "oracle-daily-record-v1";
const 每日记录集合 = createLocalCollection<每日记录>(每日记录键);

export function 读取每日记录(): 每日记录[] {
  return 每日记录集合.load();
}

export function 保存每日记录(entries: 每日记录[]) {
  每日记录集合.save(entries);
}

export function 创建每日记录({
  reading,
  ritualPrompt,
  practicalGuidance,
}: {
  reading: 阅读记录;
  ritualPrompt: string;
  practicalGuidance?: string;
}): 每日记录 {
  const due = new Date();
  due.setDate(due.getDate() + 1);

  return {
    id: `daily-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    readingId: reading.id,
    createdAt: new Date().toISOString(),
    dueDate: due.toISOString().slice(0, 10),
    title: reading.interpretationMode === "shadow" ? "明日继续向内靠近" : "明日继续回应此刻的声音",
    prompt: practicalGuidance || ritualPrompt,
  };
}

export function 完成每日记录(entries: 每日记录[], dailyId: string) {
  return entries.map((entry) =>
    entry.id === dailyId
      ? {
          ...entry,
          completedAt: entry.completedAt ?? new Date().toISOString(),
        }
      : entry,
  );
}

export function 今日待回应数量(entries: 每日记录[], now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return entries.filter((entry) => !entry.completedAt && entry.dueDate <= today).length;
}

export function 每日记录状态(entry: 每日记录, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  if (entry.completedAt) return "已回应";
  if (entry.dueDate > today) return `将在 ${entry.dueDate} 提醒`;
  return "今日可完成";
}
