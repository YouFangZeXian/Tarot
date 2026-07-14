"use client";

import type { 每日记录 } from "@/lib/daily-record";
import { persistServerDailyRecord } from "@/lib/daily-sync";
import type { DreamJournalEntry } from "@/lib/dream-journal";
import { persistServerDreamEntry } from "@/lib/dream-sync";
import type { MonthlyReportSnapshot } from "@/lib/monthly-report";
import { persistServerMonthlyReport } from "@/lib/monthly-report-sync";
import type { 阅读记录 } from "@/lib/reading-history";
import { persistServerReading } from "@/lib/reading-sync";
import type { TimeCapsuleEntry } from "@/lib/time-capsule";
import { persistServerTimeCapsule } from "@/lib/time-capsule-sync";

const SYNC_QUEUE_KEY = "oracle-sync-queue-v1";
const RETRY_INTERVAL_MS = 45_000;

type SyncWrite =
  | { entity: "reading"; record: 阅读记录 }
  | { entity: "daily"; record: 每日记录 }
  | { entity: "dream"; record: DreamJournalEntry }
  | { entity: "capsule"; record: TimeCapsuleEntry }
  | { entity: "monthlyReport"; record: MonthlyReportSnapshot };

type SyncQueueItem = SyncWrite & {
  id: string;
  operation: "upsert";
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError?: string;
};

export type SyncPhase = "idle" | "syncing" | "synced" | "pending" | "offline" | "error";

export type SyncState = {
  phase: SyncPhase;
  pendingCount: number;
  lastSuccessAt: string | null;
  lastError: string | null;
};

const SERVER_SYNC_STATE: SyncState = {
  phase: "idle",
  pendingCount: 0,
  lastSuccessAt: null,
  lastError: null,
};

let syncState: SyncState = SERVER_SYNC_STATE;
let flushPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isQueueItem(value: unknown): value is SyncQueueItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SyncQueueItem>;
  const record = item.record as { id?: unknown } | undefined;
  return (
    typeof item.id === "string" &&
    ["reading", "daily", "dream", "capsule", "monthlyReport"].includes(item.entity ?? "") &&
    item.operation === "upsert" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    typeof item.retryCount === "number" &&
    typeof record?.id === "string"
  );
}

function readQueue() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(SYNC_QUEUE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isQueueItem) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: SyncQueueItem[]) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

function emitState(next: Partial<SyncState> = {}) {
  syncState = {
    ...syncState,
    ...next,
    pendingCount: readQueue().length,
  };
  listeners.forEach((listener) => listener());
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "同步请求暂时未完成。";
}

function queueId(write: SyncWrite) {
  return `${write.entity}:${write.record.id}`;
}

function enqueueWrite(write: SyncWrite, error: unknown) {
  const queue = readQueue();
  const id = queueId(write);
  const existing = queue.find((item) => item.id === id);
  const now = new Date().toISOString();
  const nextItem: SyncQueueItem = {
    ...write,
    id,
    operation: "upsert",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    retryCount: existing?.retryCount ?? 0,
    lastError: errorMessage(error),
  } as SyncQueueItem;

  writeQueue([nextItem, ...queue.filter((item) => item.id !== id)]);
  emitState({
    phase: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending",
    lastError: nextItem.lastError ?? null,
  });
}

function removeQueuedWrite(id: string, expectation?: { updatedAt?: string; record?: SyncWrite["record"] }) {
  const queue = readQueue();
  const next = queue.filter((item) => {
    if (item.id !== id) return true;
    if (expectation?.updatedAt) return item.updatedAt !== expectation.updatedAt;
    if (expectation?.record) return JSON.stringify(item.record) !== JSON.stringify(expectation.record);
    return false;
  });
  if (next.length !== queue.length) writeQueue(next);
}

function markQueuedWriteFailed(item: SyncQueueItem, error: unknown) {
  const queue = readQueue();
  const next = queue.map((current) =>
    current.id === item.id && current.updatedAt === item.updatedAt
      ? {
          ...current,
          retryCount: current.retryCount + 1,
          lastError: errorMessage(error),
        }
      : current,
  );
  writeQueue(next);
}

async function persistWrite(write: SyncWrite) {
  switch (write.entity) {
    case "reading":
      await persistServerReading(write.record);
      return;
    case "daily":
      await persistServerDailyRecord(write.record);
      return;
    case "dream":
      await persistServerDreamEntry(write.record);
      return;
    case "capsule":
      await persistServerTimeCapsule(write.record);
      return;
    case "monthlyReport":
      await persistServerMonthlyReport(write.record);
  }
}

export async function persistWithRetry(write: SyncWrite) {
  emitState({ phase: "syncing", lastError: null });

  try {
    await persistWrite(write);
    removeQueuedWrite(queueId(write), { record: write.record });
    emitState({
      phase: readQueue().length ? "pending" : "synced",
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
    });
    return true;
  } catch (error) {
    enqueueWrite(write, error);
    return false;
  }
}

export function flushSyncQueue() {
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    const queue = readQueue();
    if (!queue.length) {
      emitState({ phase: "synced", lastError: null });
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      emitState({ phase: "offline" });
      return;
    }

    emitState({ phase: "syncing", lastError: null });
    const results = await Promise.allSettled(
      queue.map(async (item) => {
        await persistWrite(item);
        removeQueuedWrite(item.id, { updatedAt: item.updatedAt });
      }),
    );

    let lastError: string | null = null;
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        markQueuedWriteFailed(queue[index], result.reason);
        lastError = errorMessage(result.reason);
      }
    });

    const pendingCount = readQueue().length;
    emitState({
      phase: lastError ? "error" : pendingCount ? "pending" : "synced",
      lastSuccessAt: pendingCount === queue.length ? syncState.lastSuccessAt : new Date().toISOString(),
      lastError,
    });
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}

export function startSyncQueue() {
  const queue = readQueue();
  emitState({
    phase: queue.length ? (navigator.onLine ? "pending" : "offline") : "synced",
    lastError: queue[0]?.lastError ?? null,
  });

  const retry = () => void flushSyncQueue();
  const handleVisibility = () => {
    if (document.visibilityState === "visible") retry();
  };
  const interval = window.setInterval(() => {
    if (readQueue().length) retry();
  }, RETRY_INTERVAL_MS);

  window.addEventListener("online", retry);
  document.addEventListener("visibilitychange", handleVisibility);
  retry();

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("online", retry);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}

export function subscribeSyncState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncStateSnapshot() {
  return syncState;
}

export function getServerSyncStateSnapshot() {
  return SERVER_SYNC_STATE;
}

export function formatSyncStateLabel(state: SyncState) {
  if (state.phase === "syncing") return state.pendingCount ? `正在同步 ${state.pendingCount} 条档案` : "正在同步";
  if (state.phase === "offline") return state.pendingCount ? `离线保存 · ${state.pendingCount} 条待同步` : "当前处于离线状态";
  if (state.phase === "error") return state.pendingCount ? `同步暂缓 · ${state.pendingCount} 条待重试` : "同步暂缓";
  if (state.pendingCount) return `${state.pendingCount} 条档案等待同步`;
  return "档案已同步";
}
