/**
 * Multi-Turn Task Planner
 *
 * Decomposes complex tasks into step-by-step plans
 * and tracks execution progress.
 */

import type { JointState, SimObject } from '../types';
import { createLogger } from './logger';

const log = createLogger('TaskPlanner');

// ============================================================================
// Types
// ============================================================================

/**
 * A single step in a task plan
 */
export interface PlanStep {
  id: string;
  action: TaskAction;
  description: string;
  targetObject?: string;
  targetPosition?: [number, number, number];
  parameters?: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
}

/**
 * Task action types
 */
export type TaskAction =
  | 'pickup'
  | 'place'
  | 'move_to'
  | 'move_home'
  | 'open_gripper'
  | 'close_gripper'
  | 'wait'
  | 'verify'
  | 'custom';

/**
 * A complete task plan
 */
export interface TaskPlan {
  id: string;
  description: string;
  steps: PlanStep[];
  currentStepIndex: number;
  status: 'planning' | 'ready' | 'executing' | 'completed' | 'failed' | 'paused';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Task planning context
 */
export interface PlanningContext {
  currentJoints: JointState;
  objects: SimObject[];
  heldObject?: SimObject;
  completedActions: string[];
}

// ============================================================================
// Plan Generation
// ============================================================================

/**
 * Generate a unique step ID
 */
function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate a unique plan ID
 */
function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a pickup plan for an object
 */
export function createPickupPlan(
  objectName: string,
  objectPosition: [number, number, number],
  objectType: string = 'cube'
): TaskPlan {
  const graspType = objectType === 'cylinder' ? 'horizontal' : 'vertical';

  return {
    id: generatePlanId(),
    description: `Pick up ${objectName}`,
    steps: [
      {
        id: generateStepId(),
        action: 'open_gripper',
        description: 'Open gripper to prepare for grasping',
        status: 'pending',
      },
      {
        id: generateStepId(),
        action: 'move_to',
        description: `Move above ${objectName}`,
        targetPosition: [objectPosition[0], objectPosition[1] + 0.05, objectPosition[2]],
        parameters: { approachHeight: 0.05 },
        status: 'pending',
      },
      {
        id: generateStepId(),
        action: 'move_to',
        description: `Lower to ${objectName}`,
        targetPosition: objectPosition,
        parameters: { graspType },
        status: 'pending',
      },
      {
        id: generateStepId(),
        action: 'close_gripper',
        description: `Grasp ${objectName}`,
        targetObject: objectName,
        parameters: { duration: 800 },
        status: 'pending',
      },
      {
        id: generateStepId(),
        action: 'verify',
        description: 'Verify object is grasped',
        targetObject: objectName,
        status: 'pending',
      },
      {
        id: generateStepId(),
        action: 'move_to',
        description: `Lift ${objectName}`,
        targetPosition: [objectPosition[0], objectPosition[1] + 0.08, objectPosition[2]],
        status: 'pending',
      },
    ],
    currentStepIndex: 0,
    status: 'ready',
    createdAt: Date.now(),
  };
}

/**
 * Create a place plan
 */
export function createPlacePlan(
  objectName: string,
  targetPosition: [number, number, number]
): TaskPlan {
  return {
    id: generatePlanId(),
    description: `Place ${objectName}`,
    steps: [
      {
        id: generateStepId(),
        action: 'move_to',
        description: 'Move above target position',
        targetPosition: [targetPosition[0], targetPosition[1] + 0.05, targetPosition[2]],
        status: 'pending',
      },
      {
        id: generateStepId(),
        action: 'move_to',
        description: 'Lower to place position',
        targetPosition: [targetPosition[0], targetPosition[1] + 0.02, targetPosition[2]],
        status: 'pending',
      },
      {
        id: generateStepId(),
        action: 'open_gripper',
        description: `Release ${objectName}`,
        status: 'pending',
      },
      {
        id: generateStepId(),
        action: 'wait',
        description: 'Wait for object to settle',
        parameters: { duration: 300 },
        status: 'pending',
      },
      {
        id: generateStepId(),
        action: 'move_to',
        description: 'Retract from placed object',
        targetPosition: [targetPosition[0], targetPosition[1] + 0.08, targetPosition[2]],
        status: 'pending',
      },
    ],
    currentStepIndex: 0,
    status: 'ready',
    createdAt: Date.now(),
  };
}

/**
 * Create a stack plan (pick up A, place on B)
 */
export function createStackPlan(
  topObject: { name: string; position: [number, number, number]; type?: string },
  bottomObject: { name: string; position: [number, number, number]; height: number }
): TaskPlan {
  const pickupPlan = createPickupPlan(topObject.name, topObject.position, topObject.type);
  const placePosition: [number, number, number] = [
    bottomObject.position[0],
    bottomObject.position[1] + bottomObject.height,
    bottomObject.position[2],
  ];
  const placePlan = createPlacePlan(topObject.name, placePosition);

  return {
    id: generatePlanId(),
    description: `Stack ${topObject.name} on ${bottomObject.name}`,
    steps: [
      ...pickupPlan.steps,
      ...placePlan.steps,
      {
        id: generateStepId(),
        action: 'verify',
        description: `Verify ${topObject.name} is stacked on ${bottomObject.name}`,
        parameters: { stackCheck: true, topObject: topObject.name, bottomObject: bottomObject.name },
        status: 'pending',
      },
    ],
    currentStepIndex: 0,
    status: 'ready',
    createdAt: Date.now(),
    metadata: { taskType: 'stack', topObject: topObject.name, bottomObject: bottomObject.name },
  };
}

/**
 * Create a sort plan (arrange objects by type/color)
 */
export function createSortPlan(
  objects: Array<{ name: string; position: [number, number, number]; type: string }>,
  sortPositions: Record<string, [number, number, number]>
): TaskPlan {
  const steps: PlanStep[] = [];

  for (const obj of objects) {
    const targetPos = sortPositions[obj.type];
    if (!targetPos) continue;

    // Add pickup steps
    steps.push({
      id: generateStepId(),
      action: 'pickup',
      description: `Pick up ${obj.name}`,
      targetObject: obj.name,
      targetPosition: obj.position,
      status: 'pending',
    });

    // Add place steps
    steps.push({
      id: generateStepId(),
      action: 'place',
      description: `Place ${obj.name} in ${obj.type} area`,
      targetObject: obj.name,
      targetPosition: targetPos,
      status: 'pending',
    });
  }

  return {
    id: generatePlanId(),
    description: `Sort ${objects.length} objects by type`,
    steps,
    currentStepIndex: 0,
    status: 'ready',
    createdAt: Date.now(),
    metadata: { taskType: 'sort', objectCount: objects.length },
  };
}

// ============================================================================
// Plan Execution
// ============================================================================

/**
 * Get the current step in a plan
 */
export function getCurrentStep(plan: TaskPlan): PlanStep | null {
  if (plan.currentStepIndex >= plan.steps.length) {
    return null;
  }
  return plan.steps[plan.currentStepIndex];
}

/**
 * Mark current step as completed and advance
 */
export function advancePlan(plan: TaskPlan, result?: string): TaskPlan {
  const currentStep = plan.steps[plan.currentStepIndex];
  if (currentStep) {
    currentStep.status = 'completed';
    currentStep.result = result;
  }

  const newIndex = plan.currentStepIndex + 1;
  const isComplete = newIndex >= plan.steps.length;

  return {
    ...plan,
    currentStepIndex: newIndex,
    status: isComplete ? 'completed' : plan.status,
    completedAt: isComplete ? Date.now() : undefined,
  };
}

/**
 * Mark current step as failed
 */
export function failStep(plan: TaskPlan, error: string): TaskPlan {
  const currentStep = plan.steps[plan.currentStepIndex];
  if (currentStep) {
    currentStep.status = 'failed';
    currentStep.error = error;
  }

  return {
    ...plan,
    status: 'failed',
  };
}

/**
 * Skip current step and continue
 */
export function skipStep(plan: TaskPlan, reason: string): TaskPlan {
  const currentStep = plan.steps[plan.currentStepIndex];
  if (currentStep) {
    currentStep.status = 'skipped';
    currentStep.result = reason;
  }

  return advancePlan(plan);
}

/**
 * Pause plan execution
 */
export function pausePlan(plan: TaskPlan): TaskPlan {
  return {
    ...plan,
    status: 'paused',
  };
}

/**
 * Resume plan execution
 */
export function resumePlan(plan: TaskPlan): TaskPlan {
  return {
    ...plan,
    status: 'executing',
  };
}

/**
 * Reset plan to beginning
 */
export function resetPlan(plan: TaskPlan): TaskPlan {
  return {
    ...plan,
    steps: plan.steps.map(step => ({ ...step, status: 'pending' as const, result: undefined, error: undefined })),
    currentStepIndex: 0,
    status: 'ready',
    startedAt: undefined,
    completedAt: undefined,
  };
}

// ============================================================================
// Plan Analysis
// ============================================================================

/**
 * Get plan progress
 */
export function getPlanProgress(plan: TaskPlan): {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  remaining: number;
  percentage: number;
} {
  const completed = plan.steps.filter(s => s.status === 'completed').length;
  const failed = plan.steps.filter(s => s.status === 'failed').length;
  const skipped = plan.steps.filter(s => s.status === 'skipped').length;
  const total = plan.steps.length;

  return {
    total,
    completed,
    failed,
    skipped,
    remaining: total - completed - failed - skipped,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Generate plan summary for LLM context
 */
export function getPlanSummary(plan: TaskPlan): string {
  const progress = getPlanProgress(plan);
  const currentStep = getCurrentStep(plan);

  let summary = `Plan: ${plan.description}\n`;
  summary += `Status: ${plan.status} (${progress.percentage}% complete)\n`;

  if (currentStep) {
    summary += `Current step: ${currentStep.description}\n`;
  }

  summary += `Steps: ${progress.completed}/${progress.total} completed`;

  if (progress.failed > 0) {
    summary += `, ${progress.failed} failed`;
  }

  return summary;
}

/**
 * Get next action description for LLM
 */
export function getNextActionPrompt(plan: TaskPlan): string | null {
  const currentStep = getCurrentStep(plan);
  if (!currentStep) return null;

  let prompt = `Execute: ${currentStep.description}`;

  if (currentStep.targetObject) {
    prompt += ` (target: ${currentStep.targetObject})`;
  }

  if (currentStep.targetPosition) {
    const pos = currentStep.targetPosition;
    prompt += ` (position: [${pos.map(p => (p * 100).toFixed(1)).join(', ')}]cm)`;
  }

  return prompt;
}

// ============================================================================
// Plan State Management
// ============================================================================

// Current active plan
let activePlan: TaskPlan | null = null;

/**
 * Set the active plan
 */
export function setActivePlan(plan: TaskPlan | null): void {
  activePlan = plan;
  if (plan) {
    log.info(`Active plan set: ${plan.description}`);
  } else {
    log.info('Active plan cleared');
  }
}

/**
 * Get the active plan
 */
export function getActivePlan(): TaskPlan | null {
  return activePlan;
}

/**
 * Check if there is an active plan
 */
export function hasActivePlan(): boolean {
  return activePlan !== null && activePlan.status !== 'completed' && activePlan.status !== 'failed';
}

/**
 * Get plan state for persistence
 */
export function exportPlanState(): TaskPlan | null {
  return activePlan;
}

/**
 * Restore plan state
 */
export function importPlanState(plan: TaskPlan): void {
  activePlan = plan;
}
