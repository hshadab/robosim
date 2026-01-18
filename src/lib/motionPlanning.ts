/**
 * Motion Planning Module
 *
 * Provides collision-aware path planning and trajectory optimization
 * for robot arm movements.
 */

import type { JointState, Vector3D } from '../types';
import { calculateGripperPositionURDF, type JointAngles } from '../components/simulation/SO101KinematicsURDF';
import { createLogger } from './logger';

const log = createLogger('MotionPlanning');

// ============================================================================
// Types
// ============================================================================

/**
 * A waypoint in a trajectory
 */
export interface TrajectoryWaypoint {
  joints: JointState;
  position: [number, number, number];  // Gripper position
  velocity?: number;                    // Velocity multiplier (0-1)
  timestamp?: number;                   // Time offset in ms
}

/**
 * Complete trajectory
 */
export interface Trajectory {
  waypoints: TrajectoryWaypoint[];
  totalDuration: number;
  hasCollision: boolean;
  collisionPoints: CollisionPoint[];
}

/**
 * Collision detection result
 */
export interface CollisionPoint {
  waypointIndex: number;
  position: [number, number, number];
  type: 'table' | 'self' | 'object' | 'boundary';
  severity: 'warning' | 'collision';
}

/**
 * Obstacle in the scene
 */
export interface Obstacle {
  id: string;
  type: 'box' | 'sphere' | 'cylinder';
  position: [number, number, number];
  size: [number, number, number];  // width, height, depth or radius
}

/**
 * Planning configuration
 */
export interface PlanningConfig {
  tableHeight: number;          // Height of table surface
  safetyMargin: number;         // Minimum distance from obstacles
  maxVelocity: number;          // Maximum joint velocity (deg/s)
  numInterpolationPoints: number;
  checkSelfCollision: boolean;
}

const DEFAULT_CONFIG: PlanningConfig = {
  tableHeight: 0.0,
  safetyMargin: 0.02,           // 2cm safety margin
  maxVelocity: 180,             // 180 deg/s max
  numInterpolationPoints: 10,
  checkSelfCollision: true,
};

// ============================================================================
// Collision Detection
// ============================================================================

/**
 * Check if a point is below the table
 */
function checkTableCollision(
  position: [number, number, number],
  tableHeight: number,
  safetyMargin: number
): boolean {
  return position[1] < tableHeight + safetyMargin;
}

/**
 * Check if position is within robot workspace boundaries
 */
function checkBoundaryCollision(position: [number, number, number]): boolean {
  const [x, y, z] = position;

  // Check if too close to base (risk of self-collision)
  const distFromBase = Math.sqrt(x * x + z * z);
  if (distFromBase < 0.05) {
    return true;
  }

  // Check if too far (beyond reach)
  if (distFromBase > 0.28) {
    return true;
  }

  // Check height bounds
  if (y < -0.05 || y > 0.35) {
    return true;
  }

  return false;
}

/**
 * Simple self-collision check based on joint angles
 */
function checkSelfCollision(joints: JointState): boolean {
  // Check for extreme configurations that could cause self-collision
  const { shoulder, elbow, wrist } = joints;

  // Arm folded back on itself
  if (shoulder > 60 && elbow < -60) {
    return true;
  }

  // Wrist bent back into arm
  if (elbow > 80 && wrist < -80) {
    return true;
  }

  return false;
}

/**
 * Check collision with an obstacle
 */
function checkObstacleCollision(
  position: [number, number, number],
  obstacle: Obstacle,
  safetyMargin: number
): boolean {
  const [px, py, pz] = position;
  const [ox, oy, oz] = obstacle.position;

  switch (obstacle.type) {
    case 'sphere': {
      const radius = obstacle.size[0] + safetyMargin;
      const dist = Math.sqrt(
        (px - ox) ** 2 + (py - oy) ** 2 + (pz - oz) ** 2
      );
      return dist < radius;
    }

    case 'box': {
      const [hw, hh, hd] = obstacle.size.map(s => s / 2 + safetyMargin);
      return (
        Math.abs(px - ox) < hw &&
        Math.abs(py - oy) < hh &&
        Math.abs(pz - oz) < hd
      );
    }

    case 'cylinder': {
      const radius = obstacle.size[0] + safetyMargin;
      const height = obstacle.size[1] / 2 + safetyMargin;
      const distXZ = Math.sqrt((px - ox) ** 2 + (pz - oz) ** 2);
      return distXZ < radius && Math.abs(py - oy) < height;
    }
  }

  return false;
}

/**
 * Check all collisions for a joint configuration
 */
export function checkCollisions(
  joints: JointState,
  obstacles: Obstacle[] = [],
  config: Partial<PlanningConfig> = {}
): CollisionPoint[] {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const collisions: CollisionPoint[] = [];

  // Get gripper position
  const angles: JointAngles = {
    base: joints.base,
    shoulder: joints.shoulder,
    elbow: joints.elbow,
    wrist: joints.wrist,
    wristRoll: joints.wristRoll,
  };
  const position = calculateGripperPositionURDF(angles);

  // Check table collision
  if (checkTableCollision(position, fullConfig.tableHeight, fullConfig.safetyMargin)) {
    collisions.push({
      waypointIndex: 0,
      position,
      type: 'table',
      severity: position[1] < fullConfig.tableHeight ? 'collision' : 'warning',
    });
  }

  // Check boundary
  if (checkBoundaryCollision(position)) {
    collisions.push({
      waypointIndex: 0,
      position,
      type: 'boundary',
      severity: 'warning',
    });
  }

  // Check self-collision
  if (fullConfig.checkSelfCollision && checkSelfCollision(joints)) {
    collisions.push({
      waypointIndex: 0,
      position,
      type: 'self',
      severity: 'collision',
    });
  }

  // Check obstacle collisions
  for (const obstacle of obstacles) {
    if (checkObstacleCollision(position, obstacle, fullConfig.safetyMargin)) {
      collisions.push({
        waypointIndex: 0,
        position,
        type: 'object',
        severity: 'collision',
      });
    }
  }

  return collisions;
}

// ============================================================================
// Trajectory Generation
// ============================================================================

/**
 * Interpolate between two joint configurations
 */
function interpolateJoints(
  from: JointState,
  to: JointState,
  t: number
): JointState {
  return {
    base: from.base + t * (to.base - from.base),
    shoulder: from.shoulder + t * (to.shoulder - from.shoulder),
    elbow: from.elbow + t * (to.elbow - from.elbow),
    wrist: from.wrist + t * (to.wrist - from.wrist),
    wristRoll: from.wristRoll + t * (to.wristRoll - from.wristRoll),
    gripper: from.gripper + t * (to.gripper - from.gripper),
  };
}

/**
 * Generate a linear trajectory between two configurations
 */
export function generateLinearTrajectory(
  from: JointState,
  to: JointState,
  numPoints: number = 10,
  obstacles: Obstacle[] = [],
  config: Partial<PlanningConfig> = {}
): Trajectory {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const waypoints: TrajectoryWaypoint[] = [];
  const collisionPoints: CollisionPoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const joints = interpolateJoints(from, to, t);

    const angles: JointAngles = {
      base: joints.base,
      shoulder: joints.shoulder,
      elbow: joints.elbow,
      wrist: joints.wrist,
      wristRoll: joints.wristRoll,
    };
    const position = calculateGripperPositionURDF(angles);

    waypoints.push({
      joints,
      position,
      velocity: 1.0,
    });

    // Check for collisions
    const collisions = checkCollisions(joints, obstacles, config);
    for (const collision of collisions) {
      collisionPoints.push({ ...collision, waypointIndex: i });
    }
  }

  // Calculate total duration based on max joint change
  const maxJointChange = Math.max(
    Math.abs(to.base - from.base),
    Math.abs(to.shoulder - from.shoulder),
    Math.abs(to.elbow - from.elbow),
    Math.abs(to.wrist - from.wrist)
  );
  const totalDuration = (maxJointChange / fullConfig.maxVelocity) * 1000;

  return {
    waypoints,
    totalDuration,
    hasCollision: collisionPoints.some(c => c.severity === 'collision'),
    collisionPoints,
  };
}

/**
 * Generate a trajectory with raised approach to avoid obstacles
 */
export function generateApproachTrajectory(
  from: JointState,
  to: JointState,
  approachHeight: number = 0.08,
  obstacles: Obstacle[] = [],
  config: Partial<PlanningConfig> = {}
): Trajectory {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Get target position
  const toAngles: JointAngles = {
    base: to.base,
    shoulder: to.shoulder,
    elbow: to.elbow,
    wrist: to.wrist,
    wristRoll: to.wristRoll,
  };
  const targetPos = calculateGripperPositionURDF(toAngles);

  // Create intermediate waypoint above target
  const midJoints: JointState = {
    ...to,
    shoulder: to.shoulder - 20,  // Raise shoulder
    elbow: to.elbow - 10,        // Adjust elbow
    wrist: to.wrist + 10,        // Compensate wrist
  };

  // Generate two-segment trajectory
  const segment1 = generateLinearTrajectory(
    from, midJoints, fullConfig.numInterpolationPoints / 2, obstacles, config
  );
  const segment2 = generateLinearTrajectory(
    midJoints, to, fullConfig.numInterpolationPoints / 2, obstacles, config
  );

  // Combine segments
  const waypoints = [
    ...segment1.waypoints,
    ...segment2.waypoints.slice(1), // Skip duplicate midpoint
  ];

  const collisionPoints = [
    ...segment1.collisionPoints,
    ...segment2.collisionPoints.map(c => ({
      ...c,
      waypointIndex: c.waypointIndex + segment1.waypoints.length - 1,
    })),
  ];

  return {
    waypoints,
    totalDuration: segment1.totalDuration + segment2.totalDuration,
    hasCollision: segment1.hasCollision || segment2.hasCollision,
    collisionPoints,
  };
}

/**
 * Attempt to find a collision-free path using RRT-like sampling
 */
export function planCollisionFreePath(
  from: JointState,
  to: JointState,
  obstacles: Obstacle[] = [],
  config: Partial<PlanningConfig> = {},
  maxAttempts: number = 10
): Trajectory | null {
  // First try direct path
  const directPath = generateLinearTrajectory(from, to, 20, obstacles, config);
  if (!directPath.hasCollision) {
    return directPath;
  }

  // Try approach trajectory
  const approachPath = generateApproachTrajectory(from, to, 0.08, obstacles, config);
  if (!approachPath.hasCollision) {
    return approachPath;
  }

  // Try different approach heights
  for (const height of [0.10, 0.12, 0.15]) {
    const path = generateApproachTrajectory(from, to, height, obstacles, config);
    if (!path.hasCollision) {
      log.info(`Found collision-free path with approach height ${height}m`);
      return path;
    }
  }

  // Try random intermediate waypoints
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const midJoints: JointState = {
      base: from.base + (to.base - from.base) * 0.5 + (Math.random() - 0.5) * 20,
      shoulder: Math.min(from.shoulder, to.shoulder) - 20 - Math.random() * 20,
      elbow: (from.elbow + to.elbow) / 2 + (Math.random() - 0.5) * 20,
      wrist: (from.wrist + to.wrist) / 2 + (Math.random() - 0.5) * 20,
      wristRoll: to.wristRoll,
      gripper: (from.gripper + to.gripper) / 2,
    };

    const segment1 = generateLinearTrajectory(from, midJoints, 10, obstacles, config);
    const segment2 = generateLinearTrajectory(midJoints, to, 10, obstacles, config);

    if (!segment1.hasCollision && !segment2.hasCollision) {
      log.info(`Found collision-free path on attempt ${attempt + 1}`);

      return {
        waypoints: [...segment1.waypoints, ...segment2.waypoints.slice(1)],
        totalDuration: segment1.totalDuration + segment2.totalDuration,
        hasCollision: false,
        collisionPoints: [],
      };
    }
  }

  log.warn('Could not find collision-free path');
  return null;
}

// ============================================================================
// Path Optimization
// ============================================================================

/**
 * Smooth a trajectory using moving average
 */
export function smoothTrajectory(
  trajectory: Trajectory,
  windowSize: number = 3
): Trajectory {
  const smoothedWaypoints: TrajectoryWaypoint[] = [];

  for (let i = 0; i < trajectory.waypoints.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(trajectory.waypoints.length - 1, i + Math.floor(windowSize / 2));

    let sumJoints = {
      base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 0
    };
    let count = 0;

    for (let j = start; j <= end; j++) {
      const wp = trajectory.waypoints[j];
      sumJoints.base += wp.joints.base;
      sumJoints.shoulder += wp.joints.shoulder;
      sumJoints.elbow += wp.joints.elbow;
      sumJoints.wrist += wp.joints.wrist;
      sumJoints.wristRoll += wp.joints.wristRoll;
      sumJoints.gripper += wp.joints.gripper;
      count++;
    }

    const avgJoints: JointState = {
      base: sumJoints.base / count,
      shoulder: sumJoints.shoulder / count,
      elbow: sumJoints.elbow / count,
      wrist: sumJoints.wrist / count,
      wristRoll: sumJoints.wristRoll / count,
      gripper: sumJoints.gripper / count,
    };

    const angles: JointAngles = {
      base: avgJoints.base,
      shoulder: avgJoints.shoulder,
      elbow: avgJoints.elbow,
      wrist: avgJoints.wrist,
      wristRoll: avgJoints.wristRoll,
    };

    smoothedWaypoints.push({
      joints: avgJoints,
      position: calculateGripperPositionURDF(angles),
      velocity: trajectory.waypoints[i].velocity,
    });
  }

  return {
    ...trajectory,
    waypoints: smoothedWaypoints,
  };
}

/**
 * Apply velocity scaling based on proximity to obstacles
 */
export function applyVelocityScaling(
  trajectory: Trajectory,
  obstacles: Obstacle[] = [],
  minVelocity: number = 0.3
): Trajectory {
  const scaledWaypoints = trajectory.waypoints.map((wp, i) => {
    let minDist = Infinity;

    // Find minimum distance to any obstacle
    for (const obstacle of obstacles) {
      const [ox, oy, oz] = obstacle.position;
      const [px, py, pz] = wp.position;
      const dist = Math.sqrt((px-ox)**2 + (py-oy)**2 + (pz-oz)**2);
      minDist = Math.min(minDist, dist);
    }

    // Scale velocity based on distance (slower when close)
    const proximityScale = Math.min(1, Math.max(minVelocity, minDist / 0.1));

    return {
      ...wp,
      velocity: (wp.velocity ?? 1) * proximityScale,
    };
  });

  return {
    ...trajectory,
    waypoints: scaledWaypoints,
  };
}
