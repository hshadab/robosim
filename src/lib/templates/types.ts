/**
 * Type definitions for parameterized task templates
 */

import type { JointState } from '../../types';

/**
 * A single parameter that can be randomized
 */
export interface TaskParameter {
  name: string;
  description: string;
  defaultValue: number;
  min: number;
  max: number;
  unit: string;
  randomize: boolean;
}

/**
 * A waypoint with parameterized joint values
 * Values can be numbers or parameter references (e.g., "${pickAngle}")
 */
export interface ParameterizedWaypoint {
  name: string;
  joints: {
    base: number | string;
    shoulder: number | string;
    elbow: number | string;
    wrist: number | string;
    wristRoll: number | string;
    gripper: number | string;
  };
  duration?: number;
}

/**
 * A parameterized task template
 */
export interface ParameterizedTaskTemplate {
  id: string;
  name: string;
  description: string;
  category: 'manipulation' | 'navigation' | 'inspection';
  parameters: TaskParameter[];
  waypoints: ParameterizedWaypoint[];
}

/**
 * Resolved task template with concrete joint values
 */
export interface ResolvedTaskTemplate {
  id: string;
  name: string;
  waypoints: JointState[];
  durations: number[];
  parameterValues: Record<string, number>;
}
