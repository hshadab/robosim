/**
 * Claude API key management
 */

import { STORAGE_CONFIG } from '../config';
import { loggers } from '../logger';

const log = loggers.claude;

// In-memory store for API key (not persisted for security)
let storedApiKey: string | null = null;

/**
 * Validate and clean Claude API key
 */
function cleanApiKey(key: string | null): string | null {
  if (!key) return null;
  // Trim whitespace and newlines
  const cleaned = key.trim().replace(/[\r\n]/g, '');
  if (!cleaned) return null;
  // Log prefix for debugging (never log full key)
  const prefix = cleaned.substring(0, 12);
  log.debug(`API key prefix: ${prefix}...`);
  return cleaned;
}

/**
 * Set Claude API key
 * Note: For security, API keys are only stored in memory by default.
 * Enable localStorage storage only for development convenience.
 */
export function setClaudeApiKey(key: string | null, persistToStorage = false): void {
  storedApiKey = cleanApiKey(key);
  if (persistToStorage) {
    if (storedApiKey) {
      // Warn about security implications
      log.warn('Storing API key in localStorage. This is insecure for production use.');
      localStorage.setItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY, storedApiKey);
    } else {
      localStorage.removeItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY);
    }
  }
}

/**
 * Get Claude API key from memory or localStorage
 */
export function getClaudeApiKey(): string | null {
  if (storedApiKey) return storedApiKey;
  // Check localStorage as fallback (for development convenience)
  const stored = localStorage.getItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY);
  storedApiKey = cleanApiKey(stored);
  // Update storage with cleaned version if needed
  if (stored && storedApiKey && stored !== storedApiKey) {
    localStorage.setItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY, storedApiKey);
  }
  return storedApiKey;
}

/**
 * Clear stored API key from both memory and localStorage
 */
export function clearClaudeApiKey(): void {
  storedApiKey = null;
  localStorage.removeItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY);
}
