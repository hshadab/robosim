/**
 * Example Pruning System
 *
 * Automatically prunes pickup examples to maintain quality,
 * remove stale entries, and merge duplicates.
 */

import type { PickupExample } from './pickupExamples';
import { createLogger } from './logger';

const log = createLogger('ExamplePruning');

// ============================================================================
// Types
// ============================================================================

/**
 * Pruning configuration
 */
export interface PruningConfig {
  maxExamples: number;           // Maximum examples to keep
  maxAgeMs: number;              // Maximum age before pruning
  minSuccessRate: number;        // Minimum success rate for position
  duplicateDistanceThreshold: number;  // Distance to consider duplicates
  recentFailureWeight: number;   // Weight for recent failures
}

/**
 * Pruning result
 */
export interface PruningResult {
  kept: PickupExample[];
  pruned: PickupExample[];
  merged: number;
  reasons: Map<string, string>;  // id -> reason
}

/**
 * Example quality score
 */
export interface ExampleQuality {
  example: PickupExample;
  score: number;
  age: number;
  usageCount: number;
  recentFailures: number;
  isCanonical: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: PruningConfig = {
  maxExamples: 100,
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,  // 7 days
  minSuccessRate: 0.3,
  duplicateDistanceThreshold: 0.03,    // 3cm
  recentFailureWeight: 0.5,
};

// Track usage and failures for each example
const usageTracker = new Map<string, { uses: number; failures: number; lastUsed: number }>();

// ============================================================================
// Quality Scoring
// ============================================================================

/**
 * Calculate quality score for an example
 */
export function calculateQualityScore(
  example: PickupExample,
  config: PruningConfig = DEFAULT_CONFIG
): number {
  let score = 0;

  // Base score for success
  if (example.success) {
    score += 1.0;
  }

  // Bonus for low IK error
  const maxIkError = Math.max(
    example.ikErrors.approach,
    example.ikErrors.grasp,
    example.ikErrors.lift
  );
  score += Math.max(0, 1 - maxIkError / 0.04) * 0.5;

  // Bonus for having language variants (training value)
  if (example.languageVariants && example.languageVariants.length > 0) {
    score += 0.2;
  }

  // Age penalty
  const age = Date.now() - example.timestamp;
  const ageFactor = Math.max(0, 1 - age / config.maxAgeMs);
  score *= (0.5 + 0.5 * ageFactor);

  // Usage bonus/penalty
  const usage = usageTracker.get(example.id);
  if (usage) {
    // More uses = more valuable
    score += Math.min(0.3, usage.uses * 0.05);

    // Recent failures = less valuable
    score -= usage.failures * config.recentFailureWeight;

    // Recency bonus
    const timeSinceUse = Date.now() - usage.lastUsed;
    if (timeSinceUse < 3600000) { // Used in last hour
      score += 0.2;
    }
  }

  return Math.max(0, score);
}

/**
 * Track that an example was used
 */
export function trackExampleUsage(exampleId: string, success: boolean): void {
  const existing = usageTracker.get(exampleId) || { uses: 0, failures: 0, lastUsed: 0 };

  usageTracker.set(exampleId, {
    uses: existing.uses + 1,
    failures: existing.failures + (success ? 0 : 1),
    lastUsed: Date.now(),
  });
}

/**
 * Get usage statistics for an example
 */
export function getExampleUsage(exampleId: string): { uses: number; failures: number; lastUsed: number } | null {
  return usageTracker.get(exampleId) || null;
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Calculate distance between two examples
 */
function exampleDistance(a: PickupExample, b: PickupExample): number {
  // Position distance
  const posDist = Math.sqrt(
    (a.objectPosition[0] - b.objectPosition[0]) ** 2 +
    (a.objectPosition[1] - b.objectPosition[1]) ** 2 +
    (a.objectPosition[2] - b.objectPosition[2]) ** 2
  );

  // Type match (0 if same, 0.05 if different)
  const typeDist = a.objectType === b.objectType ? 0 : 0.05;

  return posDist + typeDist;
}

/**
 * Find duplicate examples
 */
export function findDuplicates(
  examples: PickupExample[],
  threshold: number = DEFAULT_CONFIG.duplicateDistanceThreshold
): Map<string, string[]> {
  const duplicates = new Map<string, string[]>();

  for (let i = 0; i < examples.length; i++) {
    const dupes: string[] = [];
    for (let j = i + 1; j < examples.length; j++) {
      if (exampleDistance(examples[i], examples[j]) < threshold) {
        dupes.push(examples[j].id);
      }
    }
    if (dupes.length > 0) {
      duplicates.set(examples[i].id, dupes);
    }
  }

  return duplicates;
}

/**
 * Merge duplicate examples, keeping the best one
 */
export function mergeDuplicates(
  examples: PickupExample[],
  threshold: number = DEFAULT_CONFIG.duplicateDistanceThreshold
): PickupExample[] {
  const duplicates = findDuplicates(examples, threshold);
  const toRemove = new Set<string>();

  for (const [canonicalId, dupeIds] of duplicates) {
    const canonical = examples.find(e => e.id === canonicalId)!;
    const canonicalScore = calculateQualityScore(canonical);

    for (const dupeId of dupeIds) {
      const dupe = examples.find(e => e.id === dupeId)!;
      const dupeScore = calculateQualityScore(dupe);

      if (dupeScore > canonicalScore) {
        // Dupe is better, remove canonical
        toRemove.add(canonicalId);
      } else {
        // Canonical is better, remove dupe
        toRemove.add(dupeId);
      }
    }
  }

  log.info(`Merged ${toRemove.size} duplicate examples`);
  return examples.filter(e => !toRemove.has(e.id));
}

// ============================================================================
// Pruning
// ============================================================================

/**
 * Prune examples based on quality and configuration
 */
export function pruneExamples(
  examples: PickupExample[],
  config: Partial<PruningConfig> = {}
): PruningResult {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const reasons = new Map<string, string>();

  // First, merge duplicates
  let remaining = mergeDuplicates(examples, fullConfig.duplicateDistanceThreshold);
  const mergedCount = examples.length - remaining.length;

  // Calculate quality scores
  const scored = remaining.map(example => ({
    example,
    score: calculateQualityScore(example, fullConfig),
    age: Date.now() - example.timestamp,
  }));

  // Prune by age
  const beforeAgePrune = scored.length;
  const afterAgePrune = scored.filter(s => {
    if (s.age > fullConfig.maxAgeMs) {
      reasons.set(s.example.id, `Too old (${Math.round(s.age / 86400000)} days)`);
      return false;
    }
    return true;
  });

  // Prune by score
  const sortedByScore = afterAgePrune.sort((a, b) => b.score - a.score);

  // Keep top N by score
  const kept = sortedByScore.slice(0, fullConfig.maxExamples);
  const prunedByScore = sortedByScore.slice(fullConfig.maxExamples);

  for (const item of prunedByScore) {
    reasons.set(item.example.id, `Low quality score (${item.score.toFixed(2)})`);
  }

  // Prune consistent failures
  const finalKept = kept.filter(s => {
    const usage = usageTracker.get(s.example.id);
    if (usage && usage.uses > 3 && usage.failures / usage.uses > (1 - fullConfig.minSuccessRate)) {
      reasons.set(s.example.id, `Low success rate (${((1 - usage.failures / usage.uses) * 100).toFixed(0)}%)`);
      return false;
    }
    return true;
  });

  const pruned = examples.filter(e => !finalKept.some(k => k.example.id === e.id));

  log.info(`Pruned ${pruned.length} examples, kept ${finalKept.length}, merged ${mergedCount}`);

  return {
    kept: finalKept.map(k => k.example),
    pruned,
    merged: mergedCount,
    reasons,
  };
}

// ============================================================================
// Maintenance
// ============================================================================

/**
 * Run periodic maintenance on examples
 */
export function runMaintenance(
  examples: PickupExample[],
  config: Partial<PruningConfig> = {}
): {
  examples: PickupExample[];
  report: string;
} {
  const before = examples.length;
  const result = pruneExamples(examples, config);

  const report = [
    `Example Maintenance Report:`,
    `- Started with: ${before} examples`,
    `- Merged duplicates: ${result.merged}`,
    `- Pruned: ${result.pruned.length}`,
    `- Remaining: ${result.kept.length}`,
    '',
    'Pruned examples:',
    ...Array.from(result.reasons.entries()).slice(0, 10).map(
      ([id, reason]) => `  - ${id.slice(0, 20)}: ${reason}`
    ),
  ].join('\n');

  return {
    examples: result.kept,
    report,
  };
}

/**
 * Get maintenance recommendations
 */
export function getMaintenanceRecommendations(
  examples: PickupExample[]
): string[] {
  const recommendations: string[] = [];

  // Check for old examples
  const oldExamples = examples.filter(
    e => Date.now() - e.timestamp > DEFAULT_CONFIG.maxAgeMs
  );
  if (oldExamples.length > 0) {
    recommendations.push(
      `${oldExamples.length} examples are older than 7 days and may be stale`
    );
  }

  // Check for duplicates
  const duplicates = findDuplicates(examples);
  if (duplicates.size > 0) {
    recommendations.push(
      `${duplicates.size} example groups have duplicates that could be merged`
    );
  }

  // Check for failing examples
  let failingCount = 0;
  for (const example of examples) {
    const usage = usageTracker.get(example.id);
    if (usage && usage.uses > 3 && usage.failures / usage.uses > 0.5) {
      failingCount++;
    }
  }
  if (failingCount > 0) {
    recommendations.push(
      `${failingCount} examples have low success rates and should be reviewed`
    );
  }

  // Check total count
  if (examples.length > DEFAULT_CONFIG.maxExamples * 1.5) {
    recommendations.push(
      `Example count (${examples.length}) exceeds recommended maximum (${DEFAULT_CONFIG.maxExamples})`
    );
  }

  return recommendations;
}

/**
 * Clear usage tracking data
 */
export function clearUsageTracking(): void {
  usageTracker.clear();
  log.info('Cleared usage tracking data');
}

/**
 * Export usage statistics
 */
export function exportUsageStats(): Map<string, { uses: number; failures: number; lastUsed: number }> {
  return new Map(usageTracker);
}
