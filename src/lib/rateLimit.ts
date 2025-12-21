/**
 * Rate Limiting Utility for API Calls
 *
 * Provides configurable rate limiting to prevent API abuse and quota exhaustion.
 * Implements token bucket algorithm for smooth rate limiting.
 */

interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional: minimum delay between requests in milliseconds */
  minDelayMs?: number;
}

interface RateLimitState {
  requests: number[];
  lastRequest: number;
}

const rateLimitStates = new Map<string, RateLimitState>();

/**
 * Default rate limit configurations for different APIs
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  claude: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 requests per minute
    minDelayMs: 500,
  },
  huggingface: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 30 requests per minute
    minDelayMs: 100,
  },
  fal: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 5 requests per minute (image generation is slow)
    minDelayMs: 1000,
  },
  default: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    minDelayMs: 100,
  },
};

/**
 * Check if a request should be rate limited
 * @param key Unique identifier for the rate limit bucket (e.g., 'claude', 'huggingface')
 * @param config Optional custom rate limit configuration
 * @returns Object with allowed status and wait time if rate limited
 */
export function checkRateLimit(
  key: string,
  config?: Partial<RateLimitConfig>
): { allowed: boolean; waitMs: number; remainingRequests: number } {
  const now = Date.now();
  const effectiveConfig = {
    ...RATE_LIMIT_CONFIGS[key] || RATE_LIMIT_CONFIGS.default,
    ...config,
  };

  // Get or create state for this key
  let state = rateLimitStates.get(key);
  if (!state) {
    state = { requests: [], lastRequest: 0 };
    rateLimitStates.set(key, state);
  }

  // Remove requests outside the time window
  state.requests = state.requests.filter(
    (timestamp) => now - timestamp < effectiveConfig.windowMs
  );

  // Check if we've exceeded the max requests
  if (state.requests.length >= effectiveConfig.maxRequests) {
    const oldestRequest = state.requests[0];
    const waitMs = effectiveConfig.windowMs - (now - oldestRequest);
    return {
      allowed: false,
      waitMs: Math.max(0, waitMs),
      remainingRequests: 0,
    };
  }

  // Check minimum delay between requests
  if (effectiveConfig.minDelayMs && state.lastRequest > 0) {
    const timeSinceLastRequest = now - state.lastRequest;
    if (timeSinceLastRequest < effectiveConfig.minDelayMs) {
      return {
        allowed: false,
        waitMs: effectiveConfig.minDelayMs - timeSinceLastRequest,
        remainingRequests: effectiveConfig.maxRequests - state.requests.length,
      };
    }
  }

  return {
    allowed: true,
    waitMs: 0,
    remainingRequests: effectiveConfig.maxRequests - state.requests.length,
  };
}

/**
 * Record a request for rate limiting purposes
 * @param key Unique identifier for the rate limit bucket
 */
export function recordRequest(key: string): void {
  const now = Date.now();
  let state = rateLimitStates.get(key);
  if (!state) {
    state = { requests: [], lastRequest: 0 };
    rateLimitStates.set(key, state);
  }
  state.requests.push(now);
  state.lastRequest = now;
}

/**
 * Wrap a function with rate limiting
 * @param key Unique identifier for the rate limit bucket
 * @param fn The async function to wrap
 * @param config Optional custom rate limit configuration
 * @returns Wrapped function that respects rate limits
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  key: string,
  fn: T,
  config?: Partial<RateLimitConfig>
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const check = checkRateLimit(key, config);

    if (!check.allowed) {
      // Wait for the required time
      await new Promise((resolve) => setTimeout(resolve, check.waitMs));
    }

    recordRequest(key);
    return fn(...args) as Promise<ReturnType<T>>;
  };
}

/**
 * Clear rate limit state for a specific key or all keys
 * @param key Optional key to clear; if not provided, clears all
 */
export function clearRateLimit(key?: string): void {
  if (key) {
    rateLimitStates.delete(key);
  } else {
    rateLimitStates.clear();
  }
}

/**
 * Get current rate limit status for a key
 * @param key Unique identifier for the rate limit bucket
 * @returns Current state or null if not tracked
 */
export function getRateLimitStatus(key: string): {
  requestsInWindow: number;
  remainingRequests: number;
  resetInMs: number;
} | null {
  const state = rateLimitStates.get(key);
  if (!state) return null;

  const now = Date.now();
  const config = RATE_LIMIT_CONFIGS[key] || RATE_LIMIT_CONFIGS.default;

  // Filter to current window
  const activeRequests = state.requests.filter(
    (timestamp) => now - timestamp < config.windowMs
  );

  const oldestRequest = activeRequests[0] || now;
  const resetInMs = Math.max(0, config.windowMs - (now - oldestRequest));

  return {
    requestsInWindow: activeRequests.length,
    remainingRequests: Math.max(0, config.maxRequests - activeRequests.length),
    resetInMs,
  };
}
