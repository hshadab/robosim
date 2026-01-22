/**
 * Multi-Step Command Handler
 *
 * Handles multi-step commands using the primitives system.
 * e.g., "pick up the cube, twist it, and place it on the blue cube"
 * Extracted from claudeApi.ts for better modularity.
 */

import type { JointState, SimObject } from '../../types';
import type { ClaudeResponse } from './types';
import { loggers } from '../logger';

const log = loggers.claude;

/**
 * Handle multi-step commands using the primitives system
 */
export async function handleMultiStepCommand(
  message: string,
  state: JointState,
  objects: SimObject[]
): Promise<ClaudeResponse | null> {
  // Import primitives system dynamically
  const { decomposeCommand, executeSequence } = await import('../primitives');
  const { calculateGripperPositionURDF } = await import('../../components/simulation/SO101KinematicsURDF');

  // Convert SimObject[] to RobotState format
  const gripperPos = calculateGripperPositionURDF(state);
  const heldObject = objects.find(o => o.isGrabbed);

  const robotState = {
    joints: state,
    gripperWorldPosition: gripperPos as [number, number, number],
    objects: objects.map(o => ({
      id: o.id,
      name: o.name || o.id,
      type: (o.type || 'cube') as 'cube' | 'cylinder' | 'ball' | 'custom',
      position: o.position as [number, number, number],
      scale: o.scale || 0.03,
      isGrabbed: o.isGrabbed,
    })),
    heldObject: heldObject?.id,
  };

  // Decompose the command
  const decomposition = decomposeCommand(message, robotState);

  if (!decomposition.success || !decomposition.sequence) {
    log.warn(`Multi-step decomposition failed: ${decomposition.error}`);
    return null;
  }

  const { sequence } = decomposition;
  log.info(`Multi-step command decomposed into ${sequence.steps.length} steps`);

  // Execute the sequence
  const { steps, phases, description } = await executeSequence(sequence, robotState);

  // Build description of all steps
  const stepDescriptions = phases
    .filter(p => p.description && !p.description.includes('Stabilize'))
    .map(p => p.description)
    .slice(0, 5); // Limit to first 5 for readability

  const fullDescription = stepDescriptions.length > 3
    ? `${stepDescriptions.slice(0, 3).join(', ')}... (${phases.length} total phases)`
    : stepDescriptions.join(', then ');

  return {
    action: 'sequence',
    joints: steps,
    description: fullDescription || description,
    code: `// Multi-step command: ${message}\n${sequence.steps.map(s => `// Step: ${s.primitive}`).join('\n')}`,
  };
}
