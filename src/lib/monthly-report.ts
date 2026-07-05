import type { ArchetypeProfile } from "@/lib/archetype-profile";
import type { DreamJournalEntry } from "@/lib/dream-journal";
import type { TimeCapsuleEntry } from "@/lib/time-capsule";
import { createLocalCollection } from "@/lib/oracle-storage";

export type MonthlyReportSnapshot = {
  id: string;
  monthKey: string;
  createdAt: string;
  title: string;
  summary: string;
  archetypePulse: string;
  dreamThread: string;
  capsuleEcho: string;
  nextMonthPrompt: string;
};

type InterpretationMode = "standard" | "shadow";

const MONTHLY_REPORT_KEY = "oracle-monthly-report-v1";
const monthlyReportCollection = createLocalCollection<MonthlyReportSnapshot>(MONTHLY_REPORT_KEY);

function topItem(items: string[]) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function isSameMonth(dateString: string, monthKey: string) {
  return dateString.slice(0, 7) === monthKey;
}

export function loadMonthlyReports(): MonthlyReportSnapshot[] {
  return monthlyReportCollection.load();
}

export function saveMonthlyReports(entries: MonthlyReportSnapshot[]) {
  monthlyReportCollection.save(entries);
}

export function buildMonthlyInnerReport({
  dreamEntries,
  timeCapsules,
  archetypeProfile,
  interpretationMode,
  question,
}: {
  dreamEntries: DreamJournalEntry[];
  timeCapsules: TimeCapsuleEntry[];
  archetypeProfile: ArchetypeProfile;
  interpretationMode: InterpretationMode;
  question: string;
}) {
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthlyDreams = dreamEntries.filter((entry) => isSameMonth(entry.createdAt, monthKey));
  const monthlyCapsules = timeCapsules.filter((entry) => isSameMonth(entry.createdAt, monthKey));

  const dreamMood = topItem(monthlyDreams.map((entry) => entry.mood)) ?? "尚未成形";
  const dreamSymbol = topItem(monthlyDreams.flatMap((entry) => entry.symbols)) ?? archetypeProfile.dominantArchetypes[0] ?? "当下原型";
  const capsuleTheme =
    topItem(monthlyCapsules.map((entry) => entry.archetypeProfileName)) ?? archetypeProfile.profileName;

  const summary =
    monthlyDreams.length || monthlyCapsules.length
      ? `这个月，你已经留下 ${monthlyDreams.length} 条梦境记录、${monthlyCapsules.length} 枚时间胶囊。它们和这次围绕“${question}”展开的阅读一起，开始勾出一条更稳定的内在线索。`
      : `这个月的记录刚刚开始。这次围绕“${question}”展开的阅读，会成为你本月内在报告的第一枚坐标。`;

  const archetypePulse =
    interpretationMode === "shadow"
      ? `本月最强的原型脉冲，落在 ${archetypeProfile.profileName}。它不只是提醒你有什么力量，也在提醒你正在如何保护自己、回避什么，或者反复回到哪些旧的心理路径。`
      : `本月最强的原型脉冲，落在 ${archetypeProfile.profileName}。它更像一种温柔而持续的底色，提醒你真正稳定发光的部分，其实已经在你身上。`;

  const dreamThread =
    monthlyDreams.length > 0
      ? `梦境这条线目前最明显的气氛是“${dreamMood}”，最常回来的符号则是“${dreamSymbol}”。它很可能与这次阅读里的某一束情绪或动机互相呼应。`
      : `这个月的梦境线还没有完全铺开，但你已经可以从“${dreamSymbol}”这个符号开始，慢慢留意哪些夜间画面会反复回来。`;

  const capsuleEcho =
    monthlyCapsules.length > 0
      ? `你已经开始把此刻封存给未来的自己。那些时间胶囊大多围绕“${capsuleTheme}”展开，说明你真正想保留下来的，不只是答案，而是这一段正在形成的内在变化。`
      : `时间胶囊这条线还很新，但正因为如此，它更适合替你收住那些还没有说完、却很值得未来回头再看的部分。`;

  const nextMonthPrompt =
    interpretationMode === "shadow"
      ? "下个月，继续留意那些你最容易立刻合理化的情绪。真正值得写下来的，往往不是最体面的答案，而是最先让你不舒服的那一瞬。"
      : "下个月，继续追踪那些让你感到安静、坚定、愿意靠近自己的时刻。真正会积累成变化的，往往是这些不喧哗的小回声。";

  return {
    monthKey,
    title: `${monthKey.replace("-", " 年 ")} 月内在报告`,
    summary,
    archetypePulse,
    dreamThread,
    capsuleEcho,
    nextMonthPrompt,
  };
}

export function createMonthlyReportSnapshot(
  report: ReturnType<typeof buildMonthlyInnerReport>,
): MonthlyReportSnapshot {
  return {
    id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...report,
  };
}
