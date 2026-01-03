/**
 * Parameterized Task Templates
 *
 * Provides configurable task templates with randomizable parameters
 * for generating diverse training data.
 *
 * NOTE: This module is being refactored into smaller modules in ./templates/
 * New code should import from './templates' where possible.
 */

// Re-export types from modular structure
export type {
  TaskParameter,
  ParameterizedWaypoint,
  ParameterizedTaskTemplate,
  ResolvedTaskTemplate,
} from './templates/types';

// Re-export utilities from modular structure
export {
  randomizeParameter,
  safeEvaluateExpression,
  resolveParameterValue,
  resolveWaypoint,
  resolveTaskTemplate,
  generateTaskVariations,
  getDefaultParameterValues,
  validateTemplate,
} from './templates/utils';

// Re-export default parameters
export { DEFAULT_PARAMETERS } from './templates/parameters';

// Import types for use in this file
import type { ParameterizedTaskTemplate } from './templates/types';

// Import default parameters for use in templates below
import { DEFAULT_PARAMETERS } from './templates/parameters';

/**
 * Predefined parameterized task templates
 */
export const PARAMETERIZED_TEMPLATES: ParameterizedTaskTemplate[] = [
  {
    id: 'stack-objects',
    name: 'Stack Objects',
    description: 'Pick up an object and stack it on top of another',
    category: 'manipulation',
    parameters: [
      {
        name: 'object1BaseAngle',
        description: 'Base angle to first object',
        defaultValue: -45,
        min: -90,
        max: 0,
        unit: '°',
        randomize: true,
      },
      {
        name: 'object2BaseAngle',
        description: 'Base angle to second object (stack target)',
        defaultValue: 45,
        min: 0,
        max: 90,
        unit: '°',
        randomize: true,
      },
      {
        name: 'pickHeight',
        description: 'Height to pick first object',
        defaultValue: -55,
        min: -65,
        max: -45,
        unit: '°',
        randomize: true,
      },
      {
        name: 'stackHeight',
        description: 'Height to place on stack (higher than pick)',
        defaultValue: -40,
        min: -50,
        max: -30,
        unit: '°',
        randomize: true,
      },
      DEFAULT_PARAMETERS.reachExtension,
      DEFAULT_PARAMETERS.gripperOpenAmount,
      DEFAULT_PARAMETERS.gripperCloseAmount,
      DEFAULT_PARAMETERS.movementSpeed,
    ],
    waypoints: [
      {
        name: 'Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.5,
      },
      {
        name: 'Approach Object 1',
        joints: {
          base: '${object1BaseAngle}',
          shoulder: -25,
          elbow: 50,
          wrist: -25,
          wristRoll: 0,
          gripper: '${gripperOpenAmount}',
        },
        duration: 0.6,
      },
      {
        name: 'Lower to Object 1',
        joints: {
          base: '${object1BaseAngle}',
          shoulder: '${pickHeight}',
          elbow: '${reachExtension}',
          wrist: -15,
          wristRoll: 0,
          gripper: '${gripperOpenAmount}',
        },
        duration: 0.4,
      },
      {
        name: 'Grasp Object 1',
        joints: {
          base: '${object1BaseAngle}',
          shoulder: '${pickHeight}',
          elbow: '${reachExtension}',
          wrist: -15,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Lift Object 1',
        joints: {
          base: '${object1BaseAngle}',
          shoulder: -20,
          elbow: 45,
          wrist: -25,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Move to Object 2',
        joints: {
          base: '${object2BaseAngle}',
          shoulder: -20,
          elbow: 45,
          wrist: -25,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.8,
      },
      {
        name: 'Lower to Stack',
        joints: {
          base: '${object2BaseAngle}',
          shoulder: '${stackHeight}',
          elbow: '${reachExtension}',
          wrist: -15,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Release on Stack',
        joints: {
          base: '${object2BaseAngle}',
          shoulder: '${stackHeight}',
          elbow: '${reachExtension}',
          wrist: -15,
          wristRoll: 0,
          gripper: '${gripperOpenAmount}',
        },
        duration: 0.4,
      },
      {
        name: 'Retreat from Stack',
        joints: {
          base: '${object2BaseAngle}',
          shoulder: -20,
          elbow: 45,
          wrist: -25,
          wristRoll: 0,
          gripper: '${gripperOpenAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Return Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.6,
      },
    ],
  },
  {
    id: 'pour-cup',
    name: 'Pour Cup',
    description: 'Pick up a cup and pour its contents into another container',
    category: 'manipulation',
    parameters: [
      {
        name: 'cupBaseAngle',
        description: 'Base angle to cup location',
        defaultValue: -30,
        min: -60,
        max: 0,
        unit: '°',
        randomize: true,
      },
      {
        name: 'targetBaseAngle',
        description: 'Base angle to pour target',
        defaultValue: 30,
        min: 0,
        max: 60,
        unit: '°',
        randomize: true,
      },
      {
        name: 'cupHeight',
        description: 'Height to grasp cup',
        defaultValue: -50,
        min: -60,
        max: -40,
        unit: '°',
        randomize: true,
      },
      {
        name: 'pourTilt',
        description: 'Wrist tilt angle for pouring',
        defaultValue: -80,
        min: -100,
        max: -60,
        unit: '°',
        randomize: true,
      },
      DEFAULT_PARAMETERS.reachExtension,
      DEFAULT_PARAMETERS.gripperCloseAmount,
      DEFAULT_PARAMETERS.movementSpeed,
    ],
    waypoints: [
      {
        name: 'Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.5,
      },
      {
        name: 'Approach Cup',
        joints: {
          base: '${cupBaseAngle}',
          shoulder: -25,
          elbow: 50,
          wrist: 0,
          wristRoll: 0,
          gripper: 100,
        },
        duration: 0.6,
      },
      {
        name: 'Lower to Cup',
        joints: {
          base: '${cupBaseAngle}',
          shoulder: '${cupHeight}',
          elbow: '${reachExtension}',
          wrist: 0,
          wristRoll: 0,
          gripper: 100,
        },
        duration: 0.4,
      },
      {
        name: 'Grasp Cup',
        joints: {
          base: '${cupBaseAngle}',
          shoulder: '${cupHeight}',
          elbow: '${reachExtension}',
          wrist: 0,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Lift Cup',
        joints: {
          base: '${cupBaseAngle}',
          shoulder: -20,
          elbow: 45,
          wrist: 0,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Move to Target',
        joints: {
          base: '${targetBaseAngle}',
          shoulder: -25,
          elbow: 50,
          wrist: 0,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.7,
      },
      {
        name: 'Position for Pour',
        joints: {
          base: '${targetBaseAngle}',
          shoulder: -35,
          elbow: 55,
          wrist: -20,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.4,
      },
      {
        name: 'Pour (Tilt)',
        joints: {
          base: '${targetBaseAngle}',
          shoulder: -35,
          elbow: 55,
          wrist: '${pourTilt}',
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.8,
      },
      {
        name: 'Hold Pour',
        joints: {
          base: '${targetBaseAngle}',
          shoulder: -35,
          elbow: 55,
          wrist: '${pourTilt}',
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 1.0,
      },
      {
        name: 'Upright Cup',
        joints: {
          base: '${targetBaseAngle}',
          shoulder: -30,
          elbow: 50,
          wrist: 0,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Return Cup',
        joints: {
          base: '${cupBaseAngle}',
          shoulder: -25,
          elbow: 50,
          wrist: 0,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.7,
      },
      {
        name: 'Place Cup',
        joints: {
          base: '${cupBaseAngle}',
          shoulder: '${cupHeight}',
          elbow: '${reachExtension}',
          wrist: 0,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.4,
      },
      {
        name: 'Release Cup',
        joints: {
          base: '${cupBaseAngle}',
          shoulder: '${cupHeight}',
          elbow: '${reachExtension}',
          wrist: 0,
          wristRoll: 0,
          gripper: 100,
        },
        duration: 0.4,
      },
      {
        name: 'Retreat',
        joints: {
          base: '${cupBaseAngle}',
          shoulder: -25,
          elbow: 50,
          wrist: 0,
          wristRoll: 0,
          gripper: 80,
        },
        duration: 0.4,
      },
      {
        name: 'Return Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.6,
      },
    ],
  },
  {
    id: 'pick-place-parameterized',
    name: 'Pick & Place (Configurable)',
    description: 'Pick and place with randomizable positions',
    category: 'manipulation',
    parameters: [
      DEFAULT_PARAMETERS.pickBaseAngle,
      DEFAULT_PARAMETERS.placeBaseAngle,
      DEFAULT_PARAMETERS.pickHeight,
      DEFAULT_PARAMETERS.placeHeight,
      DEFAULT_PARAMETERS.reachExtension,
      DEFAULT_PARAMETERS.gripperOpenAmount,
      DEFAULT_PARAMETERS.gripperCloseAmount,
      DEFAULT_PARAMETERS.movementSpeed,
    ],
    waypoints: [
      {
        name: 'Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.8,
      },
      {
        name: 'Pick Ready',
        joints: {
          base: '${pickBaseAngle}',
          shoulder: -30,
          elbow: 60,
          wrist: -30,
          wristRoll: 0,
          gripper: '${gripperOpenAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Pick Down',
        joints: {
          base: '${pickBaseAngle}',
          shoulder: '${pickHeight}',
          elbow: '${reachExtension}',
          wrist: -20,
          wristRoll: 0,
          gripper: '${gripperOpenAmount}',
        },
        duration: 0.3,
      },
      {
        name: 'Grasp',
        joints: {
          base: '${pickBaseAngle}',
          shoulder: '${pickHeight}',
          elbow: '${reachExtension}',
          wrist: -20,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Lift',
        joints: {
          base: '${pickBaseAngle}',
          shoulder: -30,
          elbow: 60,
          wrist: -30,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 1.0,
      },
      {
        name: 'Place Ready',
        joints: {
          base: '${placeBaseAngle}',
          shoulder: -30,
          elbow: 60,
          wrist: -30,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Place Down',
        joints: {
          base: '${placeBaseAngle}',
          shoulder: '${placeHeight}',
          elbow: '${reachExtension}',
          wrist: -20,
          wristRoll: 0,
          gripper: '${gripperCloseAmount}',
        },
        duration: 0.3,
      },
      {
        name: 'Release',
        joints: {
          base: '${placeBaseAngle}',
          shoulder: '${placeHeight}',
          elbow: '${reachExtension}',
          wrist: -20,
          wristRoll: 0,
          gripper: '${gripperOpenAmount}',
        },
        duration: 0.5,
      },
      {
        name: 'Retreat',
        joints: {
          base: '${placeBaseAngle}',
          shoulder: -30,
          elbow: 60,
          wrist: -30,
          wristRoll: 0,
          gripper: '${gripperOpenAmount}',
        },
        duration: 0.8,
      },
      {
        name: 'Return Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.8,
      },
    ],
  },
  {
    id: 'reach-touch-parameterized',
    name: 'Reach & Touch (Configurable)',
    description: 'Reach to a target position',
    category: 'manipulation',
    parameters: [
      {
        name: 'targetBaseAngle',
        description: 'Base rotation to target',
        defaultValue: 45,
        min: -90,
        max: 90,
        unit: '°',
        randomize: true,
      },
      {
        name: 'targetShoulder',
        description: 'Shoulder angle for reach',
        defaultValue: -40,
        min: -60,
        max: -20,
        unit: '°',
        randomize: true,
      },
      {
        name: 'targetElbow',
        description: 'Elbow extension',
        defaultValue: 60,
        min: 40,
        max: 80,
        unit: '°',
        randomize: true,
      },
      DEFAULT_PARAMETERS.movementSpeed,
    ],
    waypoints: [
      {
        name: 'Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.5,
      },
      {
        name: 'Approach',
        joints: {
          base: '${targetBaseAngle}',
          shoulder: -20,
          elbow: 40,
          wrist: -20,
          wristRoll: 0,
          gripper: 50,
        },
        duration: 0.8,
      },
      {
        name: 'Reach',
        joints: {
          base: '${targetBaseAngle}',
          shoulder: '${targetShoulder}',
          elbow: '${targetElbow}',
          wrist: -20,
          wristRoll: 0,
          gripper: 50,
        },
        duration: 0.5,
      },
      {
        name: 'Hold',
        joints: {
          base: '${targetBaseAngle}',
          shoulder: '${targetShoulder}',
          elbow: '${targetElbow}',
          wrist: -20,
          wristRoll: 0,
          gripper: 50,
        },
        duration: 0.3,
      },
      {
        name: 'Retreat',
        joints: {
          base: '${targetBaseAngle}',
          shoulder: -20,
          elbow: 40,
          wrist: -20,
          wristRoll: 0,
          gripper: 50,
        },
        duration: 0.5,
      },
      {
        name: 'Return Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.5,
      },
    ],
  },
  {
    id: 'sweep-scan-parameterized',
    name: 'Sweep Scan (Configurable)',
    description: 'Sweep across workspace for inspection',
    category: 'inspection',
    parameters: [
      {
        name: 'sweepStart',
        description: 'Starting base angle',
        defaultValue: -90,
        min: -120,
        max: -45,
        unit: '°',
        randomize: true,
      },
      {
        name: 'sweepEnd',
        description: 'Ending base angle',
        defaultValue: 90,
        min: 45,
        max: 120,
        unit: '°',
        randomize: true,
      },
      {
        name: 'scanHeight',
        description: 'Height of scan (shoulder angle)',
        defaultValue: -30,
        min: -50,
        max: -15,
        unit: '°',
        randomize: true,
      },
      {
        name: 'scanReach',
        description: 'Reach distance (elbow angle)',
        defaultValue: 50,
        min: 40,
        max: 70,
        unit: '°',
        randomize: true,
      },
      DEFAULT_PARAMETERS.movementSpeed,
    ],
    waypoints: [
      {
        name: 'Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.5,
      },
      {
        name: 'Scan Start',
        joints: {
          base: '${sweepStart}',
          shoulder: '${scanHeight}',
          elbow: '${scanReach}',
          wrist: -20,
          wristRoll: 0,
          gripper: 50,
        },
        duration: 1.0,
      },
      {
        name: 'Mid Point 1',
        joints: {
          base: '${sweepStart * 0.33 + sweepEnd * 0.67}',
          shoulder: '${scanHeight}',
          elbow: '${scanReach}',
          wrist: -20,
          wristRoll: 0,
          gripper: 50,
        },
        duration: 1.5,
      },
      {
        name: 'Mid Point 2',
        joints: {
          base: '${sweepStart * 0.67 + sweepEnd * 0.33}',
          shoulder: '${scanHeight}',
          elbow: '${scanReach}',
          wrist: -20,
          wristRoll: 0,
          gripper: 50,
        },
        duration: 1.5,
      },
      {
        name: 'Scan End',
        joints: {
          base: '${sweepEnd}',
          shoulder: '${scanHeight}',
          elbow: '${scanReach}',
          wrist: -20,
          wristRoll: 0,
          gripper: 50,
        },
        duration: 1.5,
      },
      {
        name: 'Return Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 1.0,
      },
    ],
  },
  // ========================================
  // PUSH/SLIDE TASK - Contact-rich manipulation
  // ========================================
  {
    id: 'push-object',
    name: 'Push Object',
    description: 'Push an object across the table surface with sustained contact',
    category: 'manipulation',
    parameters: [
      {
        name: 'objectBaseAngle',
        description: 'Base angle to object position',
        defaultValue: 0,
        min: -45,
        max: 45,
        unit: '°',
        randomize: true,
      },
      {
        name: 'pushDistance',
        description: 'Distance to push the object',
        defaultValue: 5,
        min: 3,
        max: 10,
        unit: 'cm',
        randomize: true,
      },
      {
        name: 'contactHeight',
        description: 'Shoulder angle for contact height',
        defaultValue: -60,
        min: -70,
        max: -50,
        unit: '°',
        randomize: true,
      },
      {
        name: 'reachExtension',
        description: 'Elbow extension for reach',
        defaultValue: 60,
        min: 50,
        max: 75,
        unit: '°',
        randomize: true,
      },
      {
        name: 'pushSpeed',
        description: 'Speed multiplier for push motion',
        defaultValue: 0.8,
        min: 0.5,
        max: 1.2,
        unit: 'x',
        randomize: true,
      },
    ],
    waypoints: [
      {
        name: 'Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.5,
      },
      {
        name: 'Approach Behind Object',
        joints: {
          base: '${objectBaseAngle}',
          shoulder: -30,
          elbow: 40,
          wrist: -20,
          wristRoll: 0,
          gripper: 0, // Closed for pushing
        },
        duration: 0.6,
      },
      {
        name: 'Lower to Contact',
        joints: {
          base: '${objectBaseAngle}',
          shoulder: '${contactHeight}',
          elbow: '${reachExtension - 15}', // Behind object
          wrist: -10,
          wristRoll: 0,
          gripper: 0,
        },
        duration: 0.4,
      },
      {
        name: 'Push Start',
        joints: {
          base: '${objectBaseAngle}',
          shoulder: '${contactHeight}',
          elbow: '${reachExtension}',
          wrist: -10,
          wristRoll: 0,
          gripper: 0,
        },
        duration: 0.3,
      },
      {
        name: 'Push Mid',
        joints: {
          base: '${objectBaseAngle}',
          shoulder: '${contactHeight + pushDistance * 0.5}',
          elbow: '${reachExtension + pushDistance}',
          wrist: -15,
          wristRoll: 0,
          gripper: 0,
        },
        duration: 0.8,
      },
      {
        name: 'Push End',
        joints: {
          base: '${objectBaseAngle}',
          shoulder: '${contactHeight + pushDistance}',
          elbow: '${reachExtension + pushDistance * 2}',
          wrist: -20,
          wristRoll: 0,
          gripper: 0,
        },
        duration: 0.8,
      },
      {
        name: 'Lift Away',
        joints: {
          base: '${objectBaseAngle}',
          shoulder: -25,
          elbow: 40,
          wrist: -15,
          wristRoll: 0,
          gripper: 0,
        },
        duration: 0.4,
      },
      {
        name: 'Return Home',
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 0.6,
      },
    ],
  },
];

// All utility functions (resolveTaskTemplate, generateTaskVariations, etc.)
// are now imported from ./templates/utils and re-exported at the top of this file.
