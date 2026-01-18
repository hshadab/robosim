/**
 * API Keys Manager
 *
 * Centralized storage and retrieval of API keys with localStorage persistence.
 * Keys are stored in localStorage for convenience across sessions.
 */

import { STORAGE_CONFIG } from './config';

export type ApiKeyType = 'claude' | 'fal' | 'hf' | 'gemini' | 'csm';

const KEY_MAP: Record<ApiKeyType, string> = {
  claude: STORAGE_CONFIG.KEYS.CLAUDE_API_KEY,
  fal: STORAGE_CONFIG.KEYS.FAL_API_KEY,
  hf: STORAGE_CONFIG.KEYS.HF_TOKEN,
  gemini: STORAGE_CONFIG.KEYS.GEMINI_API_KEY,
  csm: STORAGE_CONFIG.KEYS.CSM_API_KEY,
};

// In-memory cache for quick access
const keyCache: Partial<Record<ApiKeyType, string | null>> = {};

/**
 * Get an API key from localStorage (with in-memory cache)
 */
export function getApiKey(type: ApiKeyType): string | null {
  // Check cache first
  if (keyCache[type] !== undefined) {
    return keyCache[type] ?? null;
  }

  // Load from localStorage
  const storageKey = KEY_MAP[type];
  const value = localStorage.getItem(storageKey);
  keyCache[type] = value;
  return value;
}

/**
 * Set an API key (saves to localStorage)
 */
export function setApiKey(type: ApiKeyType, key: string | null): void {
  const storageKey = KEY_MAP[type];

  if (key) {
    localStorage.setItem(storageKey, key);
    keyCache[type] = key;
  } else {
    localStorage.removeItem(storageKey);
    keyCache[type] = null;
  }
}

/**
 * Check if an API key exists
 */
export function hasApiKey(type: ApiKeyType): boolean {
  return !!getApiKey(type);
}

/**
 * Clear an API key
 */
export function clearApiKey(type: ApiKeyType): void {
  setApiKey(type, null);
}

/**
 * Clear all API keys
 */
export function clearAllApiKeys(): void {
  for (const type of Object.keys(KEY_MAP) as ApiKeyType[]) {
    clearApiKey(type);
  }
}

/**
 * Get all stored API keys (for display/management)
 */
export function getAllApiKeys(): Record<ApiKeyType, { exists: boolean; preview: string }> {
  const result = {} as Record<ApiKeyType, { exists: boolean; preview: string }>;

  for (const type of Object.keys(KEY_MAP) as ApiKeyType[]) {
    const key = getApiKey(type);
    result[type] = {
      exists: !!key,
      preview: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : '',
    };
  }

  return result;
}

// Convenience functions for specific keys
export const getFalApiKey = () => getApiKey('fal');
export const setFalApiKey = (key: string | null) => setApiKey('fal', key);
export const hasFalApiKey = () => hasApiKey('fal');

export const getHfToken = () => getApiKey('hf');
export const setHfToken = (key: string | null) => setApiKey('hf', key);
export const hasHfToken = () => hasApiKey('hf');

export const getCsmApiKey = () => getApiKey('csm');
export const setCsmApiKey = (key: string | null) => setApiKey('csm', key);
export const hasCsmApiKey = () => hasApiKey('csm');

export const getGeminiApiKey = () => getApiKey('gemini');
export const setGeminiApiKey = (key: string | null) => setApiKey('gemini', key);
export const hasGeminiApiKey = () => hasApiKey('gemini');

// Claude API key convenience functions
export const getClaudeApiKey = () => getApiKey('claude');
export const setClaudeApiKey = (key: string | null) => setApiKey('claude', key);
export const hasClaudeApiKey = () => hasApiKey('claude');
export const clearClaudeApiKey = () => clearApiKey('claude');
