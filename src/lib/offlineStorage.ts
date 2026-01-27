/**
 * Offline Storage
 *
 * Provides localStorage-based caching and a write queue
 * that replays pending operations when connectivity returns.
 */

import { createLogger } from './logger';

const log = createLogger('OfflineStorage');
const QUEUE_KEY = 'robosim:offline_queue';

/** A queued write operation to replay when online */
export interface QueuedOperation {
  id: string;
  table: string;
  type: 'insert' | 'update' | 'upsert';
  payload: Record<string, unknown>;
  createdAt: number;
}

/**
 * Save a JSON-serializable value to localStorage.
 */
export function saveToLocal<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`robosim:${key}`, JSON.stringify(data));
  } catch (err) {
    log.warn('Failed to save to localStorage', { key, err });
  }
}

/**
 * Load a previously saved value from localStorage.
 */
export function loadFromLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`robosim:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Queue a write operation for later replay.
 */
export function queueForSync(op: Omit<QueuedOperation, 'id' | 'createdAt'>): void {
  const queue = loadFromLocal<QueuedOperation[]>('offline_queue') ?? [];
  queue.push({
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  });
  saveToLocal('offline_queue', queue);
  log.debug('Queued offline write', { table: op.table, type: op.type });
}

/**
 * Retrieve and clear the offline write queue.
 */
export function drainQueue(): QueuedOperation[] {
  const queue = loadFromLocal<QueuedOperation[]>('offline_queue') ?? [];
  if (queue.length > 0) {
    localStorage.removeItem(`${QUEUE_KEY}`);
    // Also remove with the prefixed key used by saveToLocal
    localStorage.removeItem('robosim:offline_queue');
  }
  return queue;
}
