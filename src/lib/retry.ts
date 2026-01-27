/**
 * Retry with Exponential Backoff
 *
 * Retries failed async operations with configurable backoff and jitter.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** HTTP status codes that should trigger a retry */
  retryableStatuses?: number[];
  /** If true, adds random jitter to delay */
  jitter?: boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [429, 500, 502, 503],
  jitter: true,
};

/** Non-retryable status codes (client errors that won't change on retry) */
const NON_RETRYABLE_STATUSES = [400, 401, 403, 404];

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Check HTTP status-based errors
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (NON_RETRYABLE_STATUSES.includes(status)) return false;
    if (retryableStatuses.includes(status)) return true;
  }

  // Generic errors are retryable by default
  return true;
}

function computeDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, jitter: boolean): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  if (!jitter) return cappedDelay;
  // Full jitter: random between 0 and cappedDelay
  return Math.random() * cappedDelay;
}

/**
 * Execute an async function with retry logic.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration
 * @returns The result of fn
 * @throws RetryError if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries) break;
      if (!isRetryableError(error, opts.retryableStatuses)) break;

      const delay = computeDelay(attempt, opts.baseDelayMs, opts.maxDelayMs, opts.jitter);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new RetryError(
    `Operation failed after ${opts.maxRetries + 1} attempts`,
    opts.maxRetries + 1,
    lastError
  );
}
