import { promises as fs } from "fs";
import path from "path";

const DEFAULT_DATA_DIR = ".oracle-data";
const writeQueues = new Map<string, Promise<unknown>>();

function getDataRoot() {
  return process.env.ORACLE_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), DEFAULT_DATA_DIR);
}

function getCollectionPath(collectionName: string) {
  const safeName = collectionName.replace(/[^a-z0-9_.-]/gi, "");
  return path.join(getDataRoot(), safeName);
}

async function ensureDataRoot() {
  await fs.mkdir(getDataRoot(), { recursive: true });
}

export async function readServerCollection<T>(collectionName: string): Promise<T[]> {
  const filePath = getCollectionPath(collectionName);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writeServerCollection<T>(collectionName: string, entries: T[]) {
  await ensureDataRoot();
  const filePath = getCollectionPath(collectionName);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(entries, null, 2);

  await fs.writeFile(tempPath, payload, "utf8");
  await fs.rename(tempPath, filePath);
}

export async function updateServerCollection<T>(
  collectionName: string,
  producer: (current: T[]) => T[] | Promise<T[]>,
) {
  const previousQueue = writeQueues.get(collectionName) ?? Promise.resolve();

  const nextQueue = previousQueue.then(async () => {
    const current = await readServerCollection<T>(collectionName);
    const next = await producer(current);
    await writeServerCollection(collectionName, next);
    return next;
  });

  writeQueues.set(
    collectionName,
    nextQueue.catch(() => {
      // Keep later writes from being blocked by a rejected queue.
    }),
  );

  return nextQueue;
}

export function sortByCreatedAtDesc<T extends { createdAt?: string }>(entries: T[]) {
  return [...entries].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
}

export function upsertById<T extends { id: string; createdAt?: string }>(entries: T[], entry: T, limit = 500) {
  const withoutCurrent = entries.filter((item) => item.id !== entry.id);
  return sortByCreatedAtDesc([entry, ...withoutCurrent]).slice(0, limit);
}
