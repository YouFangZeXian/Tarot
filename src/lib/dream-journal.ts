import { createLocalCollection } from "@/lib/oracle-storage";

export type DreamMood =
  | "朦胧"
  | "平静"
  | "牵挂"
  | "压迫"
  | "惊醒"
  | "温柔"
  | "未知";

export type DreamJournalEntry = {
  id: string;
  createdAt: string;
  title: string;
  dreamText: string;
  mood: DreamMood;
  symbols: string[];
  linkedQuestion: string;
  linkedSpreadName: string;
  linkedCardNames: string[];
  interpretationMode: "standard" | "shadow";
  archetypeProfileName: string;
};

const DREAM_JOURNAL_KEY = "oracle-dream-journal-v1";
const dreamJournalCollection = createLocalCollection<DreamJournalEntry>(DREAM_JOURNAL_KEY);

export function loadDreamJournal(): DreamJournalEntry[] {
  return dreamJournalCollection.load();
}

export function saveDreamJournal(entries: DreamJournalEntry[]) {
  dreamJournalCollection.save(entries);
}

export function createDreamJournalEntry(input: Omit<DreamJournalEntry, "id" | "createdAt">): DreamJournalEntry {
  return {
    ...input,
    id: `dream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
}
