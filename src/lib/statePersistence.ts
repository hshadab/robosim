/**
 * State Persistence Library
 *
 * Save and load simulation state using localStorage and IndexedDB.
 * Supports multiple named save slots and auto-save functionality.
 */

import type {
  JointState,
  EnvironmentType,
  SimObject,
  WheeledRobotState,
  DroneState,
  HumanoidState,
  ActiveRobotType,
} from '../types';

// Saved state interface
export interface SavedState {
  id: string;
  name: string;
  timestamp: number;
  version: string;
  robotId: string;
  robotType: ActiveRobotType;
  joints: JointState;
  wheeledRobot?: WheeledRobotState;
  drone?: DroneState;
  humanoid?: HumanoidState;
  environment: EnvironmentType;
  objects: SimObject[];
  codeContent?: string;
}

// Save slot metadata (stored in localStorage)
export interface SaveSlotMeta {
  id: string;
  name: string;
  timestamp: number;
  robotId: string;
  robotType: ActiveRobotType;
  preview?: string; // Screenshot thumbnail base64
}

// Storage constants
const STORAGE_VERSION = '1.0.0';
const DB_NAME = 'robosim-saves';
const DB_STORE = 'states';
const SLOTS_KEY = 'robosim-save-slots';
const AUTOSAVE_KEY = 'robosim-autosave';
const MAX_SLOTS = 10;
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

/**
 * Open IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Get all save slot metadata from localStorage
 */
export function getSaveSlots(): SaveSlotMeta[] {
  try {
    const stored = localStorage.getItem(SLOTS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as SaveSlotMeta[];
  } catch {
    return [];
  }
}

/**
 * Update save slot metadata
 */
function updateSlotMeta(slots: SaveSlotMeta[]): void {
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save state to IndexedDB
 */
export async function saveState(
  state: Omit<SavedState, 'id' | 'timestamp' | 'version' | 'name'>,
  name: string,
  slotId?: string
): Promise<string> {
  const db = await openDatabase();

  const savedState: SavedState = {
    ...state,
    id: slotId || generateId(),
    name,
    timestamp: Date.now(),
    version: STORAGE_VERSION,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DB_STORE], 'readwrite');
    const store = transaction.objectStore(DB_STORE);

    const request = store.put(savedState);

    request.onsuccess = () => {
      // Update metadata
      const slots = getSaveSlots();
      const existingIndex = slots.findIndex(s => s.id === savedState.id);

      const meta: SaveSlotMeta = {
        id: savedState.id,
        name: savedState.name,
        timestamp: savedState.timestamp,
        robotId: savedState.robotId,
        robotType: savedState.robotType,
      };

      if (existingIndex >= 0) {
        slots[existingIndex] = meta;
      } else {
        // Add new slot, remove oldest if over limit
        slots.unshift(meta);
        if (slots.length > MAX_SLOTS) {
          const removed = slots.pop();
          if (removed) {
            deleteState(removed.id).catch(console.error);
          }
        }
      }

      updateSlotMeta(slots);
      resolve(savedState.id);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Load state from IndexedDB
 */
export async function loadState(slotId: string): Promise<SavedState | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DB_STORE], 'readonly');
    const store = transaction.objectStore(DB_STORE);

    const request = store.get(slotId);

    request.onsuccess = () => {
      resolve(request.result as SavedState | null);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete state from IndexedDB
 */
export async function deleteState(slotId: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DB_STORE], 'readwrite');
    const store = transaction.objectStore(DB_STORE);

    const request = store.delete(slotId);

    request.onsuccess = () => {
      // Update metadata
      const slots = getSaveSlots().filter(s => s.id !== slotId);
      updateSlotMeta(slots);
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Auto-save current state (quick save to localStorage)
 */
export function autoSave(state: Omit<SavedState, 'id' | 'timestamp' | 'version' | 'name'>): void {
  try {
    const savedState: SavedState = {
      ...state,
      id: 'autosave',
      name: 'Auto-save',
      timestamp: Date.now(),
      version: STORAGE_VERSION,
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedState));
  } catch (e) {
    console.warn('Auto-save failed:', e);
  }
}

/**
 * Load auto-save state
 */
export function loadAutoSave(): SavedState | null {
  try {
    const stored = localStorage.getItem(AUTOSAVE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as SavedState;
  } catch {
    return null;
  }
}

/**
 * Clear auto-save
 */
export function clearAutoSave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

/**
 * Check if auto-save exists
 */
export function hasAutoSave(): boolean {
  return localStorage.getItem(AUTOSAVE_KEY) !== null;
}

/**
 * Export state as JSON file
 */
export function exportStateToFile(state: SavedState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `robosim-${state.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import state from JSON file
 */
export function importStateFromFile(file: File): Promise<SavedState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const state = JSON.parse(content) as SavedState;

        // Validate required fields
        if (!state.robotId || !state.joints || !state.environment) {
          throw new Error('Invalid save file format');
        }

        // Generate new ID to avoid conflicts
        state.id = generateId();
        state.timestamp = Date.now();

        resolve(state);
      } catch {
        reject(new Error('Failed to parse save file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Auto-save manager class
 */
export class AutoSaveManager {
  private intervalId: number | null = null;
  private getState: () => Omit<SavedState, 'id' | 'timestamp' | 'version' | 'name'>;
  private enabled: boolean = false;

  constructor(
    getState: () => Omit<SavedState, 'id' | 'timestamp' | 'version' | 'name'>
  ) {
    this.getState = getState;
  }

  start(intervalMs: number = AUTOSAVE_INTERVAL): void {
    if (this.intervalId) this.stop();

    this.enabled = true;
    this.intervalId = window.setInterval(() => {
      if (this.enabled) {
        autoSave(this.getState());
      }
    }, intervalMs);

    // Initial save
    autoSave(this.getState());
  }

  stop(): void {
    this.enabled = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  saveNow(): void {
    autoSave(this.getState());
  }

  isRunning(): boolean {
    return this.enabled && this.intervalId !== null;
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

/**
 * Get storage usage info
 */
export function getStorageInfo(): { used: number; available: number } {
  let used = 0;

  // Calculate localStorage usage
  for (const key in localStorage) {
    if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
      used += localStorage.getItem(key)?.length || 0;
    }
  }

  // Rough estimate of available space (5MB typical localStorage limit)
  const available = 5 * 1024 * 1024 - used;

  return { used, available: Math.max(0, available) };
}
