/**
 * Physics Configuration
 *
 * Centralized physics constants for the Rapier physics simulation.
 * All physics-related values should be defined here for consistency.
 */

// =============================================================================
// World Physics
// =============================================================================

export const WORLD_PHYSICS = {
  /** Gravity in m/s² (negative Y = downward) */
  gravity: [0, -9.81, 0] as const,
  /** Physics timestep in seconds (60 FPS) */
  timestep: 1 / 60,
} as const;

// =============================================================================
// Gripper Physics
// =============================================================================

export const GRIPPER_PHYSICS = {
  /** Jaw dimensions in meters */
  jaw: {
    length: 0.040,
    thickness: 0.010,
    depth: 0.018,
  },
  /** Friction coefficient for gripper jaws (higher = better grip) */
  friction: 2.5,
  /** Restitution (bounciness) for gripper jaws */
  restitution: 0.0,
  /** Local offset from gripper_frame_link to jaw center (URDF-derived) */
  localOffset: [-0.0079, 0, 0.0068] as const,
} as const;

// =============================================================================
// Object Physics
// =============================================================================

export const OBJECT_PHYSICS = {
  /** Friction coefficient for grippable objects */
  grippableFriction: 1.5,
  /** Default object properties by type */
  defaults: {
    cube: {
      mass: 0.3,
      restitution: 0.05,
      linearDamping: 0.5,
      angularDamping: 0.5,
    },
    ball: {
      mass: 0.3,
      restitution: 0.2,
    },
    cylinder: {
      mass: 0.4,
      restitution: 0.1,
    },
    glb: {
      /** Default density in kg/m³ (wood-like) */
      density: 800,
      restitution: 0.2,
      friction: 0.7,
      /** Min/max mass clamp in kg */
      massClamp: { min: 0.05, max: 5 },
    },
  },
} as const;

// =============================================================================
// Floor Physics
// =============================================================================

export const FLOOR_PHYSICS = {
  /** Floor surface Y position */
  surfaceY: 0,
  /** Floor collider Y position (half-thickness below surface) */
  colliderY: -0.025,
  /** Floor collider half-thickness */
  halfThickness: 0.025,
  /** Floor collider half-width/depth */
  halfExtent: 2,
  /** Floor friction coefficient */
  friction: 1.0,
  /** Floor restitution */
  restitution: 0.05,
} as const;

// =============================================================================
// Collision Detection
// =============================================================================

export const COLLISION_PHYSICS = {
  /** Minimum floor Y to prevent objects falling through */
  minFloorY: 0.02,
  /** Epsilon for collision resolution */
  epsilon: 0.001,
  /** Collision groups (bit masks) */
  groups: {
    robot: 0x0001,
    objects: 0x0002,
    environment: 0x0004,
    sensors: 0x0008,
  },
} as const;

// =============================================================================
// Continuous Collision Detection (CCD)
// =============================================================================

export const CCD_CONFIG = {
  /** Enable CCD by default for fast-moving objects */
  enabled: true,
} as const;

// =============================================================================
// Type exports for use in components
// =============================================================================

export type GripperPhysicsConfig = typeof GRIPPER_PHYSICS;
export type ObjectPhysicsConfig = typeof OBJECT_PHYSICS;
export type FloorPhysicsConfig = typeof FLOOR_PHYSICS;
export type CollisionPhysicsConfig = typeof COLLISION_PHYSICS;

// =============================================================================
// Domain Randomization
// =============================================================================

/**
 * Randomization ranges for sim-to-real transfer.
 * Values are [min, max] multipliers applied to base values.
 */
export const DOMAIN_RANDOMIZATION = {
  /** Friction multiplier range (0.5 = half friction, 2.0 = double) */
  friction: { min: 0.6, max: 1.5 },
  /** Mass multiplier range */
  mass: { min: 0.7, max: 1.4 },
  /** Restitution (bounciness) multiplier range */
  restitution: { min: 0.5, max: 2.0 },
  /** Linear damping multiplier range */
  linearDamping: { min: 0.5, max: 1.5 },
  /** Angular damping multiplier range */
  angularDamping: { min: 0.5, max: 1.5 },
  /** Motor latency simulation in milliseconds */
  motorLatency: { min: 0, max: 50 },
  /** Motor jitter (random noise added to commands) in radians */
  motorJitter: { min: 0, max: 0.02 },
  /** Gravity variation (9.81 +/- this value) */
  gravityVariation: { min: -0.2, max: 0.2 },
} as const;

export interface RandomizedPhysics {
  gripperFriction: number;
  objectFriction: number;
  objectMass: number;
  objectRestitution: number;
  linearDamping: number;
  angularDamping: number;
  floorFriction: number;
  motorLatencyMs: number;
  motorJitterRad: number;
  gravity: [number, number, number];
}

/**
 * Generate randomized physics parameters for domain randomization.
 * Call once per episode to vary physical properties.
 */
export function randomizePhysics(seed?: number): RandomizedPhysics {
  // Simple seeded random for reproducibility
  const random = seed !== undefined ? seededRandom(seed) : Math.random;

  const frictionMult = randomInRange(DOMAIN_RANDOMIZATION.friction, random);
  const massMult = randomInRange(DOMAIN_RANDOMIZATION.mass, random);
  const restitutionMult = randomInRange(DOMAIN_RANDOMIZATION.restitution, random);
  const linearDampMult = randomInRange(DOMAIN_RANDOMIZATION.linearDamping, random);
  const angularDampMult = randomInRange(DOMAIN_RANDOMIZATION.angularDamping, random);

  const gravityVar = randomInRange(DOMAIN_RANDOMIZATION.gravityVariation, random);

  return {
    gripperFriction: GRIPPER_PHYSICS.friction * frictionMult,
    objectFriction: OBJECT_PHYSICS.grippableFriction * frictionMult,
    objectMass: OBJECT_PHYSICS.defaults.cube.mass * massMult,
    objectRestitution: OBJECT_PHYSICS.defaults.cube.restitution * restitutionMult,
    linearDamping: OBJECT_PHYSICS.defaults.cube.linearDamping * linearDampMult,
    angularDamping: OBJECT_PHYSICS.defaults.cube.angularDamping * angularDampMult,
    floorFriction: FLOOR_PHYSICS.friction * frictionMult,
    motorLatencyMs: randomInRange(DOMAIN_RANDOMIZATION.motorLatency, random),
    motorJitterRad: randomInRange(DOMAIN_RANDOMIZATION.motorJitter, random),
    gravity: [0, WORLD_PHYSICS.gravity[1] + gravityVar, 0],
  };
}

/**
 * Get default (non-randomized) physics values
 */
export function getDefaultPhysics(): RandomizedPhysics {
  return {
    gripperFriction: GRIPPER_PHYSICS.friction,
    objectFriction: OBJECT_PHYSICS.grippableFriction,
    objectMass: OBJECT_PHYSICS.defaults.cube.mass,
    objectRestitution: OBJECT_PHYSICS.defaults.cube.restitution,
    linearDamping: OBJECT_PHYSICS.defaults.cube.linearDamping,
    angularDamping: OBJECT_PHYSICS.defaults.cube.angularDamping,
    floorFriction: FLOOR_PHYSICS.friction,
    motorLatencyMs: 0,
    motorJitterRad: 0,
    gravity: [...WORLD_PHYSICS.gravity] as [number, number, number],
  };
}

/**
 * Apply motor jitter to joint commands (simulates real servo noise)
 */
export function applyMotorJitter(
  jointCommands: number[],
  jitterRad: number,
  random: () => number = Math.random
): number[] {
  if (jitterRad === 0) return jointCommands;
  return jointCommands.map(cmd => cmd + (random() - 0.5) * 2 * jitterRad);
}

/**
 * Simulate motor latency by delaying command application
 */
export class MotorLatencySimulator {
  private commandQueue: Array<{ commands: number[]; applyAt: number }> = [];
  private latencyMs: number;

  constructor(latencyMs: number) {
    this.latencyMs = latencyMs;
  }

  /** Queue a command for delayed application */
  queueCommand(commands: number[], currentTimeMs: number): void {
    this.commandQueue.push({
      commands,
      applyAt: currentTimeMs + this.latencyMs,
    });
  }

  /** Get commands that should be applied now */
  getReadyCommands(currentTimeMs: number): number[] | null {
    // Remove and return commands whose time has come
    while (this.commandQueue.length > 0 && this.commandQueue[0].applyAt <= currentTimeMs) {
      const ready = this.commandQueue.shift();
      if (ready) return ready.commands;
    }
    return null;
  }

  /** Clear the queue (e.g., on episode reset) */
  reset(): void {
    this.commandQueue = [];
  }

  /** Update latency (e.g., for new episode) */
  setLatency(latencyMs: number): void {
    this.latencyMs = latencyMs;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

function randomInRange(range: { min: number; max: number }, random: () => number): number {
  return range.min + random() * (range.max - range.min);
}

function seededRandom(seed: number): () => number {
  // Simple LCG for reproducible randomness
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
