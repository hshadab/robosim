/**
 * Trajectory Planning Library for SO-101 Robot Arm
 *
 * Provides smooth motion path generation between joint configurations
 * using various interpolation methods.
 *
 * Motion planning approach:
 * - Trajectories are defined as sequences of waypoints with timestamps.
 * - Between waypoints, joints are interpolated using a selected easing function.
 * - Supported profiles: linear, cubic ease-in-out, quintic ease-in-out,
 *   trapezoidal velocity, and minimum-jerk (5th-order polynomial).
 * - Duration is auto-computed from max joint displacement at 60°/s max velocity.
 * - Velocities and accelerations are computed via central-difference numerical
 *   differentiation (dt = 10ms).
 * - The {@link TrajectoryExecutor} drives playback via requestAnimationFrame,
 *   supporting pause/resume/stop.
 */

import type { JointState } from '../types';

// Waypoint in a trajectory
export interface TrajectoryWaypoint {
  joints: JointState;
  time: number; // Time in seconds from trajectory start
}

// Complete trajectory
export interface Trajectory {
  waypoints: TrajectoryWaypoint[];
  totalDuration: number;
  interpolationType: InterpolationType;
}

export type InterpolationType = 'linear' | 'cubic' | 'quintic' | 'trapezoidal' | 'minimum-jerk';

/**
 * Linear interpolation between two values
 */
const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

/**
 * Cubic ease-in-out interpolation (smooth start and end)
 */
const cubicEaseInOut = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * Quintic ease-in-out (even smoother, zero acceleration at endpoints)
 */
const quinticEaseInOut = (t: number): number => {
  return t < 0.5
    ? 16 * t * t * t * t * t
    : 1 - Math.pow(-2 * t + 2, 5) / 2;
};

/**
 * Minimum-jerk trajectory (5th order polynomial)
 * Provides zero velocity, acceleration, AND jerk at endpoints
 * This is the smoothest possible trajectory for point-to-point motion
 * Formula: 10t³ - 15t⁴ + 6t⁵
 */
const minimumJerk = (t: number): number => {
  const t3 = t * t * t;
  const t4 = t3 * t;
  const t5 = t4 * t;
  return 10 * t3 - 15 * t4 + 6 * t5;
};

/**
 * Trapezoidal velocity profile (constant velocity in middle)
 * Acceleration phase: 25%, constant: 50%, deceleration: 25%
 */
const trapezoidalProfile = (t: number): number => {
  const accelPhase = 0.25;
  const decelStart = 0.75;

  if (t < accelPhase) {
    // Acceleration phase (quadratic)
    const normalizedT = t / accelPhase;
    return 0.5 * normalizedT * normalizedT * accelPhase * 4;
  } else if (t < decelStart) {
    // Constant velocity phase (linear)
    return accelPhase + (t - accelPhase);
  } else {
    // Deceleration phase (quadratic)
    const normalizedT = (t - decelStart) / (1 - decelStart);
    const remaining = 1 - decelStart;
    return decelStart + remaining * (2 * normalizedT - normalizedT * normalizedT);
  }
};

/**
 * Apply interpolation function based on type
 */
const applyInterpolation = (t: number, type: InterpolationType): number => {
  switch (type) {
    case 'linear':
      return t;
    case 'cubic':
      return cubicEaseInOut(t);
    case 'quintic':
      return quinticEaseInOut(t);
    case 'trapezoidal':
      return trapezoidalProfile(t);
    case 'minimum-jerk':
      return minimumJerk(t);
    default:
      return t;
  }
};

/**
 * Interpolate between two joint states
 */
export const interpolateJoints = (
  from: JointState,
  to: JointState,
  t: number, // 0 to 1
  type: InterpolationType = 'cubic'
): JointState => {
  const smoothT = applyInterpolation(Math.max(0, Math.min(1, t)), type);

  return {
    base: lerp(from.base, to.base, smoothT),
    shoulder: lerp(from.shoulder, to.shoulder, smoothT),
    elbow: lerp(from.elbow, to.elbow, smoothT),
    wrist: lerp(from.wrist, to.wrist, smoothT),
    wristRoll: lerp(from.wristRoll, to.wristRoll, smoothT),
    gripper: lerp(from.gripper, to.gripper, smoothT),
  };
};

/**
 * Calculate the maximum joint displacement between two states
 */
const maxJointDisplacement = (from: JointState, to: JointState): number => {
  return Math.max(
    Math.abs(to.base - from.base),
    Math.abs(to.shoulder - from.shoulder),
    Math.abs(to.elbow - from.elbow),
    Math.abs(to.wrist - from.wrist),
    Math.abs(to.wristRoll - from.wristRoll),
    Math.abs(to.gripper - from.gripper)
  );
};

/**
 * Calculate recommended duration based on joint displacement
 * Uses max velocity of 60 degrees/second
 */
export const calculateDuration = (
  from: JointState,
  to: JointState,
  maxVelocity = 60 // degrees per second
): number => {
  const displacement = maxJointDisplacement(from, to);
  const minDuration = displacement / maxVelocity;
  // Add some buffer and minimum duration
  return Math.max(0.5, minDuration * 1.2);
};

/**
 * Generate a point-to-point trajectory
 */
export const generatePointToPointTrajectory = (
  from: JointState,
  to: JointState,
  duration?: number,
  interpolationType: InterpolationType = 'cubic'
): Trajectory => {
  const actualDuration = duration ?? calculateDuration(from, to);

  return {
    waypoints: [
      { joints: from, time: 0 },
      { joints: to, time: actualDuration },
    ],
    totalDuration: actualDuration,
    interpolationType,
  };
};

/**
 * Generate a multi-waypoint trajectory
 */
export const generateMultiWaypointTrajectory = (
  waypoints: JointState[],
  durations?: number[],
  interpolationType: InterpolationType = 'cubic'
): Trajectory => {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints required');
  }

  const trajectoryWaypoints: TrajectoryWaypoint[] = [];
  let currentTime = 0;

  for (let i = 0; i < waypoints.length; i++) {
    trajectoryWaypoints.push({
      joints: waypoints[i],
      time: currentTime,
    });

    if (i < waypoints.length - 1) {
      const duration =
        durations?.[i] ?? calculateDuration(waypoints[i], waypoints[i + 1]);
      currentTime += duration;
    }
  }

  return {
    waypoints: trajectoryWaypoints,
    totalDuration: currentTime,
    interpolationType,
  };
};

/**
 * Sample a trajectory at a specific time
 */
export const sampleTrajectory = (
  trajectory: Trajectory,
  time: number
): JointState => {
  const { waypoints, totalDuration, interpolationType } = trajectory;

  // Clamp time to trajectory bounds
  const clampedTime = Math.max(0, Math.min(totalDuration, time));

  // Find the segment we're in
  let segmentIndex = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (clampedTime >= waypoints[i].time && clampedTime <= waypoints[i + 1].time) {
      segmentIndex = i;
      break;
    }
    segmentIndex = i;
  }

  const startWaypoint = waypoints[segmentIndex];
  const endWaypoint = waypoints[segmentIndex + 1] || startWaypoint;

  // Calculate local time within segment
  const segmentDuration = endWaypoint.time - startWaypoint.time;
  const localTime = segmentDuration > 0
    ? (clampedTime - startWaypoint.time) / segmentDuration
    : 0;

  return interpolateJoints(
    startWaypoint.joints,
    endWaypoint.joints,
    localTime,
    interpolationType
  );
};

/**
 * Calculate joint velocities at a point in the trajectory
 * Uses numerical differentiation
 */
export const calculateVelocities = (
  trajectory: Trajectory,
  time: number,
  dt = 0.01
): JointState => {
  const before = sampleTrajectory(trajectory, time - dt / 2);
  const after = sampleTrajectory(trajectory, time + dt / 2);

  return {
    base: (after.base - before.base) / dt,
    shoulder: (after.shoulder - before.shoulder) / dt,
    elbow: (after.elbow - before.elbow) / dt,
    wrist: (after.wrist - before.wrist) / dt,
    wristRoll: (after.wristRoll - before.wristRoll) / dt,
    gripper: (after.gripper - before.gripper) / dt,
  };
};

/**
 * Calculate joint accelerations at a point in the trajectory
 */
export const calculateAccelerations = (
  trajectory: Trajectory,
  time: number,
  dt = 0.01
): JointState => {
  const velBefore = calculateVelocities(trajectory, time - dt / 2, dt);
  const velAfter = calculateVelocities(trajectory, time + dt / 2, dt);

  return {
    base: (velAfter.base - velBefore.base) / dt,
    shoulder: (velAfter.shoulder - velBefore.shoulder) / dt,
    elbow: (velAfter.elbow - velBefore.elbow) / dt,
    wrist: (velAfter.wrist - velBefore.wrist) / dt,
    wristRoll: (velAfter.wristRoll - velBefore.wristRoll) / dt,
    gripper: (velAfter.gripper - velBefore.gripper) / dt,
  };
};

/**
 * Trajectory executor that can be used with requestAnimationFrame
 */
export class TrajectoryExecutor {
  private trajectory: Trajectory | null = null;
  private startTime = 0;
  private onUpdate: ((joints: JointState) => void) | null = null;
  private onComplete: (() => void) | null = null;
  private animationFrameId: number | null = null;
  private isPaused = false;
  private pausedTime = 0;

  /**
   * Start executing a trajectory
   */
  execute(
    trajectory: Trajectory,
    onUpdate: (joints: JointState) => void,
    onComplete?: () => void
  ): void {
    this.stop(); // Stop any existing execution

    this.trajectory = trajectory;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete ?? null;
    this.startTime = performance.now();
    this.isPaused = false;
    this.pausedTime = 0;

    this.tick();
  }

  /**
   * Main animation loop
   */
  private tick = (): void => {
    if (!this.trajectory || !this.onUpdate || this.isPaused) return;

    const currentTime = (performance.now() - this.startTime) / 1000;
    const joints = sampleTrajectory(this.trajectory, currentTime);

    this.onUpdate(joints);

    if (currentTime >= this.trajectory.totalDuration) {
      // Trajectory complete
      this.onComplete?.();
      this.trajectory = null;
    } else {
      this.animationFrameId = requestAnimationFrame(this.tick);
    }
  };

  /**
   * Pause execution
   */
  pause(): void {
    if (this.isPaused || !this.trajectory) return;

    this.isPaused = true;
    this.pausedTime = performance.now() - this.startTime;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (!this.isPaused || !this.trajectory) return;

    this.isPaused = false;
    this.startTime = performance.now() - this.pausedTime;
    this.tick();
  }

  /**
   * Stop execution
   */
  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.trajectory = null;
    this.onUpdate = null;
    this.onComplete = null;
    this.isPaused = false;
  }

  /**
   * Check if currently executing
   */
  isExecuting(): boolean {
    return this.trajectory !== null && !this.isPaused;
  }

  /**
   * Check if paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Get current progress (0 to 1)
   */
  getProgress(): number {
    if (!this.trajectory) return 0;

    const currentTime = this.isPaused
      ? this.pausedTime / 1000
      : (performance.now() - this.startTime) / 1000;

    return Math.min(1, currentTime / this.trajectory.totalDuration);
  }
}

// Default executor instance
export const trajectoryExecutor = new TrajectoryExecutor();
