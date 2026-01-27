/**
 * Resilient Fetch
 *
 * Composes rate limiting, circuit breaker, and retry logic
 * into a single fetch wrapper for API calls.
 */

import { withRetry, type RetryOptions } from './retry';
import { getCircuitBreaker, type CircuitBreakerOptions } from './circuitBreaker';

export interface ResilientFetchOptions {
  serviceName: string;
  retry?: RetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
}

/**
 * Fetch with retry + circuit breaker composition.
 *
 * Pipeline: circuit breaker → retry → fetch
 */
export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: ResilientFetchOptions
): Promise<Response> {
  const serviceName = options?.serviceName ?? 'default';
  const breaker = getCircuitBreaker(serviceName, options?.circuitBreaker);

  return breaker.execute(() =>
    withRetry(async () => {
      const response = await fetch(input, init);
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as Error & { status: number }).status = response.status;
        throw error;
      }
      return response;
    }, options?.retry)
  );
}
