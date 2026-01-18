/**
 * Performance Metrics Tracking
 *
 * Tracks and reports performance metrics for the LLM robot control system.
 */

import { createLogger } from './logger';

const log = createLogger('PerformanceMetrics');

// ============================================================================
// Types
// ============================================================================

/**
 * Timing metrics for a single operation
 */
export interface TimingMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
}

/**
 * System performance snapshot
 */
export interface PerformanceSnapshot {
  timestamp: number;
  metrics: {
    ikSolve: AggregatedMetrics;
    llmResponse: AggregatedMetrics;
    animation: AggregatedMetrics;
    physics: AggregatedMetrics;
    pickup: AggregatedMetrics;
  };
  successRates: {
    pickup: number;
    place: number;
    ikConvergence: number;
  };
  resourceUsage: {
    memoryMB?: number;
    cpuPercent?: number;
  };
}

/**
 * Metric categories
 */
export type MetricCategory =
  | 'ikSolve'
  | 'llmResponse'
  | 'animation'
  | 'physics'
  | 'pickup'
  | 'place'
  | 'custom';

// ============================================================================
// Storage
// ============================================================================

// Store individual metrics by category
const metricsStore = new Map<MetricCategory, TimingMetric[]>();

// Store active timers
const activeTimers = new Map<string, TimingMetric>();

// Configuration
const MAX_METRICS_PER_CATEGORY = 1000;

// ============================================================================
// Timer Functions
// ============================================================================

/**
 * Start a timer for an operation
 */
export function startTimer(
  name: string,
  category: MetricCategory = 'custom',
  metadata?: Record<string, unknown>
): string {
  const timerId = `${category}_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  activeTimers.set(timerId, {
    name,
    startTime: performance.now(),
    metadata,
  });

  return timerId;
}

/**
 * Stop a timer and record the metric
 */
export function stopTimer(timerId: string, category: MetricCategory = 'custom'): number {
  const timer = activeTimers.get(timerId);
  if (!timer) {
    log.warn(`Timer not found: ${timerId}`);
    return 0;
  }

  timer.endTime = performance.now();
  timer.duration = timer.endTime - timer.startTime;

  activeTimers.delete(timerId);

  // Store the metric
  recordMetric(category, timer);

  return timer.duration;
}

/**
 * Record a metric directly (without using timer)
 */
export function recordMetric(
  category: MetricCategory,
  metric: TimingMetric
): void {
  if (!metricsStore.has(category)) {
    metricsStore.set(category, []);
  }

  const categoryMetrics = metricsStore.get(category)!;
  categoryMetrics.push(metric);

  // Trim if too many metrics
  if (categoryMetrics.length > MAX_METRICS_PER_CATEGORY) {
    categoryMetrics.shift();
  }
}

/**
 * Record a simple duration metric
 */
export function recordDuration(
  category: MetricCategory,
  name: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  const now = performance.now();
  recordMetric(category, {
    name,
    startTime: now - durationMs,
    endTime: now,
    duration: durationMs,
    metadata,
  });
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Aggregate metrics for a category
 */
export function aggregateMetrics(category: MetricCategory): AggregatedMetrics {
  const metrics = metricsStore.get(category) || [];
  const durations = metrics
    .filter(m => m.duration !== undefined)
    .map(m => m.duration!);

  if (durations.length === 0) {
    return {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
    };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const total = durations.reduce((sum, d) => sum + d, 0);

  return {
    count: durations.length,
    totalDuration: total,
    avgDuration: total / durations.length,
    minDuration: sorted[0],
    maxDuration: sorted[sorted.length - 1],
    p50Duration: percentile(sorted, 50),
    p95Duration: percentile(sorted, 95),
    p99Duration: percentile(sorted, 99),
  };
}

/**
 * Get metrics for a time window
 */
export function getMetricsInWindow(
  category: MetricCategory,
  windowMs: number = 60000
): TimingMetric[] {
  const metrics = metricsStore.get(category) || [];
  const cutoff = performance.now() - windowMs;

  return metrics.filter(m => m.startTime >= cutoff);
}

// ============================================================================
// Success Rate Tracking
// ============================================================================

interface SuccessRecord {
  success: boolean;
  timestamp: number;
}

const successRecords = new Map<string, SuccessRecord[]>();
const MAX_SUCCESS_RECORDS = 100;

/**
 * Record a success/failure for an operation type
 */
export function recordSuccess(operationType: string, success: boolean): void {
  if (!successRecords.has(operationType)) {
    successRecords.set(operationType, []);
  }

  const records = successRecords.get(operationType)!;
  records.push({ success, timestamp: Date.now() });

  // Trim if too many
  if (records.length > MAX_SUCCESS_RECORDS) {
    records.shift();
  }
}

/**
 * Get success rate for an operation type
 */
export function getSuccessRate(operationType: string, windowMs?: number): number {
  let records = successRecords.get(operationType) || [];

  if (windowMs) {
    const cutoff = Date.now() - windowMs;
    records = records.filter(r => r.timestamp >= cutoff);
  }

  if (records.length === 0) return 0;

  const successes = records.filter(r => r.success).length;
  return successes / records.length;
}

// ============================================================================
// Snapshot Generation
// ============================================================================

/**
 * Generate a complete performance snapshot
 */
export function generateSnapshot(): PerformanceSnapshot {
  return {
    timestamp: Date.now(),
    metrics: {
      ikSolve: aggregateMetrics('ikSolve'),
      llmResponse: aggregateMetrics('llmResponse'),
      animation: aggregateMetrics('animation'),
      physics: aggregateMetrics('physics'),
      pickup: aggregateMetrics('pickup'),
    },
    successRates: {
      pickup: getSuccessRate('pickup'),
      place: getSuccessRate('place'),
      ikConvergence: getSuccessRate('ikConvergence'),
    },
    resourceUsage: {
      memoryMB: getMemoryUsage(),
    },
  };
}

/**
 * Get memory usage if available
 */
function getMemoryUsage(): number | undefined {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
    return memory.usedJSHeapSize / (1024 * 1024);
  }
  return undefined;
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Generate a human-readable performance report
 */
export function generateReport(): string {
  const snapshot = generateSnapshot();
  const lines: string[] = [
    '=== Performance Report ===',
    `Generated: ${new Date(snapshot.timestamp).toISOString()}`,
    '',
  ];

  // Timing metrics
  for (const [name, metrics] of Object.entries(snapshot.metrics)) {
    if (metrics.count === 0) continue;

    lines.push(`${name}:`);
    lines.push(`  Count: ${metrics.count}`);
    lines.push(`  Avg: ${metrics.avgDuration.toFixed(1)}ms`);
    lines.push(`  Min/Max: ${metrics.minDuration.toFixed(1)}ms / ${metrics.maxDuration.toFixed(1)}ms`);
    lines.push(`  P50/P95: ${metrics.p50Duration.toFixed(1)}ms / ${metrics.p95Duration.toFixed(1)}ms`);
    lines.push('');
  }

  // Success rates
  lines.push('Success Rates:');
  lines.push(`  Pickup: ${(snapshot.successRates.pickup * 100).toFixed(1)}%`);
  lines.push(`  Place: ${(snapshot.successRates.place * 100).toFixed(1)}%`);
  lines.push(`  IK Convergence: ${(snapshot.successRates.ikConvergence * 100).toFixed(1)}%`);

  // Resource usage
  if (snapshot.resourceUsage.memoryMB) {
    lines.push('');
    lines.push('Resource Usage:');
    lines.push(`  Memory: ${snapshot.resourceUsage.memoryMB.toFixed(1)} MB`);
  }

  return lines.join('\n');
}

/**
 * Log performance summary
 */
export function logPerformanceSummary(): void {
  const snapshot = generateSnapshot();

  log.info('Performance Summary', {
    ikSolveAvg: snapshot.metrics.ikSolve.avgDuration.toFixed(1),
    llmResponseAvg: snapshot.metrics.llmResponse.avgDuration.toFixed(1),
    pickupSuccessRate: (snapshot.successRates.pickup * 100).toFixed(1),
  });
}

// ============================================================================
// Convenience Wrappers
// ============================================================================

/**
 * Time an async function and record metrics
 */
export async function timeAsync<T>(
  category: MetricCategory,
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const timerId = startTimer(name, category, metadata);
  try {
    const result = await fn();
    stopTimer(timerId, category);
    return result;
  } catch (error) {
    stopTimer(timerId, category);
    throw error;
  }
}

/**
 * Time a sync function and record metrics
 */
export function timeSync<T>(
  category: MetricCategory,
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  const timerId = startTimer(name, category, metadata);
  try {
    const result = fn();
    stopTimer(timerId, category);
    return result;
  } catch (error) {
    stopTimer(timerId, category);
    throw error;
  }
}

/**
 * Record IK solve timing
 */
export function recordIKSolve(durationMs: number, converged: boolean, error: number): void {
  recordDuration('ikSolve', 'solve', durationMs, { converged, error });
  recordSuccess('ikConvergence', converged);
}

/**
 * Record LLM response timing
 */
export function recordLLMResponse(durationMs: number, action: string): void {
  recordDuration('llmResponse', 'response', durationMs, { action });
}

/**
 * Record pickup attempt
 */
export function recordPickupAttempt(durationMs: number, success: boolean, objectType?: string): void {
  recordDuration('pickup', 'attempt', durationMs, { success, objectType });
  recordSuccess('pickup', success);
}

/**
 * Record place attempt
 */
export function recordPlaceAttempt(durationMs: number, success: boolean): void {
  recordDuration('place', 'attempt', durationMs, { success });
  recordSuccess('place', success);
}

// ============================================================================
// Reset and Export
// ============================================================================

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  metricsStore.clear();
  successRecords.clear();
  activeTimers.clear();
  log.info('All metrics cleared');
}

/**
 * Export all metrics as JSON
 */
export function exportMetrics(): {
  metrics: Record<string, TimingMetric[]>;
  successRates: Record<string, SuccessRecord[]>;
  snapshot: PerformanceSnapshot;
} {
  const metricsObj: Record<string, TimingMetric[]> = {};
  for (const [key, value] of metricsStore) {
    metricsObj[key] = value;
  }

  const successObj: Record<string, SuccessRecord[]> = {};
  for (const [key, value] of successRecords) {
    successObj[key] = value;
  }

  return {
    metrics: metricsObj,
    successRates: successObj,
    snapshot: generateSnapshot(),
  };
}
