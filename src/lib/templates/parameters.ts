/**
 * Default task parameters for common operations
 */

import type { TaskParameter } from './types';

export const DEFAULT_PARAMETERS: Record<string, TaskParameter> = {
  pickBaseAngle: {
    name: 'pickBaseAngle',
    description: 'Base rotation angle for pick position',
    defaultValue: 0,
    min: -90,
    max: 90,
    unit: '°',
    randomize: true,
  },
  placeBaseAngle: {
    name: 'placeBaseAngle',
    description: 'Base rotation angle for place position',
    defaultValue: 90,
    min: -90,
    max: 90,
    unit: '°',
    randomize: true,
  },
  pickHeight: {
    name: 'pickHeight',
    description: 'Shoulder angle for pick height (more negative = lower)',
    defaultValue: -50,
    min: -70,
    max: -30,
    unit: '°',
    randomize: true,
  },
  placeHeight: {
    name: 'placeHeight',
    description: 'Shoulder angle for place height',
    defaultValue: -50,
    min: -70,
    max: -30,
    unit: '°',
    randomize: true,
  },
  reachExtension: {
    name: 'reachExtension',
    description: 'Elbow angle for reach distance',
    defaultValue: 70,
    min: 50,
    max: 90,
    unit: '°',
    randomize: true,
  },
  gripperOpenAmount: {
    name: 'gripperOpenAmount',
    description: 'Gripper opening percentage',
    defaultValue: 100,
    min: 80,
    max: 100,
    unit: '%',
    randomize: false,
  },
  gripperCloseAmount: {
    name: 'gripperCloseAmount',
    description: 'Gripper closing percentage',
    defaultValue: 20,
    min: 0,
    max: 40,
    unit: '%',
    randomize: true,
  },
  movementSpeed: {
    name: 'movementSpeed',
    description: 'Overall movement speed multiplier',
    defaultValue: 1.0,
    min: 0.5,
    max: 2.0,
    unit: 'x',
    randomize: true,
  },
};
