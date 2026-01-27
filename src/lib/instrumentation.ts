/**
 * Pipeline Instrumentation
 *
 * Wraps async functions with timing instrumentation.
 * Logs stage durations to console for performance profiling.
 */

import { createLogger } from './logger';

const log = createLogger('Pipeline');

/**
 * Execute an async function and log its wall-clock duration.
 *
 * @param label - Human-readable stage name (e.g. "LLM Call", "Validation")
 * @param fn - The async function to time
 * @returns The result of fn
 */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const elapsed = performance.now() - start;
    log.info(`${label}: ${elapsed.toFixed(1)}ms`);
    return result;
  } catch (error) {
    const elapsed = performance.now() - start;
    log.warn(`${label}: FAILED after ${elapsed.toFixed(1)}ms`);
    throw error;
  }
}
