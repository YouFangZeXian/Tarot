import { loadDreamJournal, saveDreamJournal, type DreamJournalEntry } from "@/lib/dream-journal";
import { loadMonthlyReports, saveMonthlyReports, type MonthlyReportSnapshot } from "@/lib/monthly-report";
import { loadTimeCapsules, saveTimeCapsules, type TimeCapsuleEntry } from "@/lib/time-capsule";
import { 保存每日记录, 读取每日记录, type 每日记录 } from "@/lib/daily-record";
import { 保存阅读记录, 读取阅读记录, type 阅读记录 } from "@/lib/reading-history";

function createCollectionService<T>({
  load,
  save,
  defaultLimit = 80,
}: {
  load: () => T[];
  save: (entries: T[]) => void;
  defaultLimit?: number;
}) {
  return {
    load,
    save,
    update(producer: (current: T[]) => T[]) {
      const next = producer(load());
      save(next);
      return next;
    },
    prepend(entry: T, options?: { limit?: number; dedupe?: (item: T) => boolean }) {
      const current = load();
      const filtered = options?.dedupe ? current.filter((item) => !options.dedupe?.(item)) : current;
      const next = [entry, ...filtered].slice(0, options?.limit ?? defaultLimit);
      save(next);
      return next;
    },
    replace(producer: (item: T) => T) {
      const next = load().map(producer);
      save(next);
      return next;
    },
  };
}

export const oracleDataService = {
  readings: createCollectionService<阅读记录>({
    load: 读取阅读记录,
    save: 保存阅读记录,
    defaultLimit: 80,
  }),
  daily: createCollectionService<每日记录>({
    load: 读取每日记录,
    save: 保存每日记录,
    defaultLimit: 80,
  }),
  dreams: createCollectionService<DreamJournalEntry>({
    load: loadDreamJournal,
    save: saveDreamJournal,
    defaultLimit: 24,
  }),
  capsules: createCollectionService<TimeCapsuleEntry>({
    load: loadTimeCapsules,
    save: saveTimeCapsules,
    defaultLimit: 24,
  }),
  monthlyReports: createCollectionService<MonthlyReportSnapshot>({
    load: loadMonthlyReports,
    save: saveMonthlyReports,
    defaultLimit: 24,
  }),
  loadSnapshot() {
    return {
      readings: 读取阅读记录(),
      daily: 读取每日记录(),
      dreams: loadDreamJournal(),
      capsules: loadTimeCapsules(),
      monthlyReports: loadMonthlyReports(),
    };
  },
};
