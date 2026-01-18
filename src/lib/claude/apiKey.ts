/**
 * Claude API key management
 *
 * @deprecated This module is deprecated. Use `src/lib/apiKeys.ts` instead.
 * Import: `import { getClaudeApiKey, setClaudeApiKey, clearClaudeApiKey } from '../apiKeys'`
 *
 * This file now re-exports from apiKeys.ts for backwards compatibility.
 */

import {
  getClaudeApiKey as _getClaudeApiKey,
  setClaudeApiKey as _setClaudeApiKey,
  clearClaudeApiKey as _clearClaudeApiKey,
} from '../apiKeys';

/**
 * Set Claude API key
 * @deprecated Use `setApiKey('claude', key)` from `../apiKeys.ts` instead
 */
export function setClaudeApiKey(key: string | null, _persistToStorage = false): void {
  // persistToStorage is ignored - apiKeys.ts always persists to localStorage
  _setClaudeApiKey(key);
}

/**
 * Get Claude API key from localStorage
 * @deprecated Use `getApiKey('claude')` from `../apiKeys.ts` instead
 */
export function getClaudeApiKey(): string | null {
  return _getClaudeApiKey();
}

/**
 * Clear stored API key
 * @deprecated Use `clearApiKey('claude')` from `../apiKeys.ts` instead
 */
export function clearClaudeApiKey(): void {
  _clearClaudeApiKey();
}
