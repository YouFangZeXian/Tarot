type CollectionGuard<T> = (value: unknown) => value is T;

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRecordArray<T extends Record<string, unknown>>(value: unknown): value is T[] {
  return Array.isArray(value) && value.every(isPlainRecord);
}

export function readCollection<T>(key: string, guard?: CollectionGuard<T>): T[] {
  const storage = getLocalStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return guard ? parsed.filter(guard) : (parsed as T[]);
  } catch {
    return [];
  }
}

export function writeCollection<T>(key: string, entries: T[]) {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(entries));
}

export type LocalCollection<T> = {
  key: string;
  load: () => T[];
  save: (entries: T[]) => void;
  update: (producer: (current: T[]) => T[]) => T[];
  prepend: (entry: T, options?: { limit?: number; dedupe?: (item: T) => boolean }) => T[];
  replace: (producer: (item: T) => T) => T[];
};

export function createLocalCollection<T>(key: string, guard?: CollectionGuard<T>): LocalCollection<T> {
  const load = () => readCollection<T>(key, guard);
  const save = (entries: T[]) => writeCollection(key, entries);

  return {
    key,
    load,
    save,
    update(producer) {
      const next = producer(load());
      save(next);
      return next;
    },
    prepend(entry, options) {
      return this.update((current) => {
        const filtered = options?.dedupe ? current.filter((item) => !options.dedupe?.(item)) : current;
        return [entry, ...filtered].slice(0, options?.limit ?? filtered.length + 1);
      });
    },
    replace(producer) {
      return this.update((current) => current.map(producer));
    },
  };
}
