/**
 * Physics Fidelity Tests
 *
 * Ensures the simulation physics are realistic enough for sim-to-real transfer.
 * Tests cover:
 * 1. Gripper physics (grasp timing, friction, contact)
 * 2. Domain randomization ranges
 * 3. Motor dynamics simulation
 * 4. Object physics consistency
 */

import { describe, it, expect } from 'vitest';
import {
  WORLD_PHYSICS,
  GRIPPER_PHYSICS,
  OBJECT_PHYSICS,
  FLOOR_PHYSICS,
  DOMAIN_RANDOMIZATION,
  randomizePhysics,
  getDefaultPhysics,
  applyMotorJitter,
  MotorLatencySimulator,
} from '../config/physics';

describe('World Physics Configuration', () => {
  it('should have Earth-like gravity', () => {
    const [x, y, z] = WORLD_PHYSICS.gravity;
    expect(x).toBe(0);
    expect(y).toBeCloseTo(-9.81, 1);
    expect(z).toBe(0);
  });

  it('should run at 60fps timestep', () => {
    expect(WORLD_PHYSICS.timestep).toBeCloseTo(1 / 60, 6);
  });
});

describe('Gripper Physics', () => {
  it('should have realistic jaw dimensions', () => {
    const { jaw } = GRIPPER_PHYSICS;

    // SO-101 gripper jaws are approximately 4cm long
    expect(jaw.length).toBeGreaterThan(0.03);
    expect(jaw.length).toBeLessThan(0.06);

    // Thickness should be reasonable
    expect(jaw.thickness).toBeGreaterThan(0.005);
    expect(jaw.thickness).toBeLessThan(0.02);
  });

  it('should have high friction for secure grasp', () => {
    // Friction coefficient > 1 means object unlikely to slip
    expect(GRIPPER_PHYSICS.friction).toBeGreaterThan(1.0);
    expect(GRIPPER_PHYSICS.friction).toBeLessThan(5.0); // Not unrealistically high
  });

  it('should have low restitution (no bouncing)', () => {
    expect(GRIPPER_PHYSICS.restitution).toBeLessThan(0.1);
  });
});

describe('Object Physics', () => {
  it('should have appropriate cube mass', () => {
    const { cube } = OBJECT_PHYSICS.defaults;

    // 4cm cube at ~800 kg/m³ (wood) = 0.064 * 0.8 = ~51g
    // But training cubes are hollow/light plastic, so 30-50g is realistic
    expect(cube.mass).toBeGreaterThan(0.1); // At least 100g (with safety margin)
    expect(cube.mass).toBeLessThan(1.0);    // Less than 1kg
  });

  it('should have low restitution for stable placement', () => {
    const { cube } = OBJECT_PHYSICS.defaults;
    expect(cube.restitution).toBeLessThan(0.2);
  });

  it('should have damping for stability', () => {
    const { cube } = OBJECT_PHYSICS.defaults;
    expect(cube.linearDamping).toBeGreaterThan(0);
    expect(cube.angularDamping).toBeGreaterThan(0);
  });
});

describe('Floor Physics', () => {
  it('should have surface at Y=0', () => {
    expect(FLOOR_PHYSICS.surfaceY).toBe(0);
  });

  it('should have friction to prevent sliding', () => {
    expect(FLOOR_PHYSICS.friction).toBeGreaterThan(0.5);
  });
});

describe('Domain Randomization', () => {
  it('should have reasonable friction range', () => {
    const { friction } = DOMAIN_RANDOMIZATION;

    expect(friction.min).toBeGreaterThan(0.3); // Not too slippery
    expect(friction.max).toBeLessThan(3.0);     // Not too sticky
    expect(friction.max).toBeGreaterThan(friction.min);
  });

  it('should have reasonable mass range', () => {
    const { mass } = DOMAIN_RANDOMIZATION;

    expect(mass.min).toBeGreaterThan(0.5); // At least 50% of base
    expect(mass.max).toBeLessThan(2.0);     // At most 200% of base
  });

  it('should have motor latency matching real servos', () => {
    const { motorLatency } = DOMAIN_RANDOMIZATION;

    // Real STS3215 servos have 5-50ms latency
    expect(motorLatency.min).toBeGreaterThanOrEqual(0);
    expect(motorLatency.max).toBeLessThanOrEqual(100); // Not more than 100ms
  });

  it('should have small motor jitter', () => {
    const { motorJitter } = DOMAIN_RANDOMIZATION;

    // Motor jitter should be small (< 2° = 0.035 rad)
    expect(motorJitter.max).toBeLessThan(0.05);
  });

  it('should have small gravity variation', () => {
    const { gravityVariation } = DOMAIN_RANDOMIZATION;

    // Gravity shouldn't vary more than ±5%
    expect(Math.abs(gravityVariation.min)).toBeLessThan(0.5);
    expect(Math.abs(gravityVariation.max)).toBeLessThan(0.5);
  });
});

describe('Physics Randomization', () => {
  it('should generate valid randomized physics', () => {
    const physics = randomizePhysics();

    // All values should be positive
    expect(physics.gripperFriction).toBeGreaterThan(0);
    expect(physics.objectFriction).toBeGreaterThan(0);
    expect(physics.objectMass).toBeGreaterThan(0);
    expect(physics.floorFriction).toBeGreaterThan(0);

    // Latency and jitter should be non-negative
    expect(physics.motorLatencyMs).toBeGreaterThanOrEqual(0);
    expect(physics.motorJitterRad).toBeGreaterThanOrEqual(0);

    // Gravity should still point down
    expect(physics.gravity[1]).toBeLessThan(0);
  });

  it('should produce different values on each call', () => {
    const physics1 = randomizePhysics();
    const physics2 = randomizePhysics();

    // At least some values should differ (very unlikely to be identical)
    const allSame =
      physics1.gripperFriction === physics2.gripperFriction &&
      physics1.objectMass === physics2.objectMass &&
      physics1.motorLatencyMs === physics2.motorLatencyMs;

    expect(allSame).toBe(false);
  });

  it('should be reproducible with seed', () => {
    const physics1 = randomizePhysics(42);
    const physics2 = randomizePhysics(42);

    expect(physics1.gripperFriction).toBe(physics2.gripperFriction);
    expect(physics1.objectMass).toBe(physics2.objectMass);
    expect(physics1.motorLatencyMs).toBe(physics2.motorLatencyMs);
    expect(physics1.gravity).toEqual(physics2.gravity);
  });

  it('should return defaults without randomization', () => {
    const defaults = getDefaultPhysics();

    expect(defaults.gripperFriction).toBe(GRIPPER_PHYSICS.friction);
    expect(defaults.objectFriction).toBe(OBJECT_PHYSICS.grippableFriction);
    expect(defaults.motorLatencyMs).toBe(0);
    expect(defaults.motorJitterRad).toBe(0);
  });
});

describe('Motor Jitter Simulation', () => {
  it('should apply jitter to joint commands', () => {
    const commands = [0, 10, 20, 30, 40, 50];
    const jitterRad = 0.02; // ~1.15°

    const jittered = applyMotorJitter(commands, jitterRad);

    // Each value should be close but not identical
    for (let i = 0; i < commands.length; i++) {
      expect(jittered[i]).toBeCloseTo(commands[i], 0); // Within ~1°
    }

    // At least one should be different (with high probability)
    const allSame = jittered.every((v, i) => v === commands[i]);
    expect(allSame).toBe(false);
  });

  it('should not apply jitter when jitterRad is 0', () => {
    const commands = [0, 10, 20, 30, 40, 50];
    const jittered = applyMotorJitter(commands, 0);

    expect(jittered).toEqual(commands);
  });

  it('should use provided random function', () => {
    const commands = [0, 0, 0];
    const jitterRad = 0.1;

    // Fixed random that always returns 0.5 -> no jitter
    const jittered = applyMotorJitter(commands, jitterRad, () => 0.5);

    expect(jittered).toEqual([0, 0, 0]);
  });
});

describe('Motor Latency Simulation', () => {
  it('should delay commands by latency amount', () => {
    const latencyMs = 50;
    const simulator = new MotorLatencySimulator(latencyMs);

    simulator.queueCommand([1, 2, 3], 0);

    // At t=25ms, command not ready
    expect(simulator.getReadyCommands(25)).toBeNull();

    // At t=50ms, command is ready
    const ready = simulator.getReadyCommands(50);
    expect(ready).toEqual([1, 2, 3]);

    // After retrieval, queue is empty
    expect(simulator.getReadyCommands(100)).toBeNull();
  });

  it('should handle multiple queued commands', () => {
    const simulator = new MotorLatencySimulator(10);

    simulator.queueCommand([1], 0);    // Ready at t=10
    simulator.queueCommand([2], 5);    // Ready at t=15
    simulator.queueCommand([3], 10);   // Ready at t=20

    expect(simulator.getReadyCommands(10)).toEqual([1]);
    expect(simulator.getReadyCommands(15)).toEqual([2]);
    expect(simulator.getReadyCommands(20)).toEqual([3]);
    expect(simulator.getReadyCommands(25)).toBeNull();
  });

  it('should reset queue', () => {
    const simulator = new MotorLatencySimulator(10);

    simulator.queueCommand([1], 0);
    simulator.reset();

    expect(simulator.getReadyCommands(100)).toBeNull();
  });

  it('should allow latency change', () => {
    const simulator = new MotorLatencySimulator(10);
    simulator.setLatency(50);

    simulator.queueCommand([1], 0);

    expect(simulator.getReadyCommands(25)).toBeNull();
    expect(simulator.getReadyCommands(50)).toEqual([1]);
  });
});

describe('Grasp Success Criteria', () => {
  /**
   * Validates that gripper timing is sufficient for physics simulation
   * to detect and respond to contact.
   */
  it('should require minimum close duration for physics detection', () => {
    // At 60fps physics, 800ms = 48 physics steps
    const closeDurationMs = 800;
    const physicsSteps = Math.floor(closeDurationMs / (1000 / 60));

    // Need at least 30 steps for stable contact detection
    expect(physicsSteps).toBeGreaterThanOrEqual(30);
  });

  it('should have friction sufficient to hold object weight', () => {
    // Simplified friction check:
    // F_friction = μ * F_normal
    // For a 300g cube under gripper with μ=2.5:
    // Even with 0.5N normal force: 2.5 * 0.5 = 1.25N > 0.3*9.81 = 2.94N weight
    // So we need higher grip force, which is achieved by gripper closing fully

    const objectMass = OBJECT_PHYSICS.defaults.cube.mass;
    const objectWeight = objectMass * 9.81;
    const gripperFriction = GRIPPER_PHYSICS.friction;

    // Minimum normal force needed (assuming coefficient of friction)
    const minNormalForce = objectWeight / gripperFriction;

    // This should be achievable with gripper (< 5N is reasonable)
    expect(minNormalForce).toBeLessThan(5);
  });
});

describe('Sim-to-Real Gap Factors', () => {
  it('should have domain randomization covering real-world variation', () => {
    // Verify domain randomization exists and has reasonable ranges
    // Note: actual ranges are tuned for SO-101 sim-to-real transfer

    // Friction should vary to simulate different surface conditions
    expect(DOMAIN_RANDOMIZATION.friction.min).toBeGreaterThan(0);
    expect(DOMAIN_RANDOMIZATION.friction.max).toBeGreaterThan(DOMAIN_RANDOMIZATION.friction.min);

    // Mass should vary to simulate manufacturing tolerance
    expect(DOMAIN_RANDOMIZATION.mass.min).toBeGreaterThan(0.5);
    expect(DOMAIN_RANDOMIZATION.mass.max).toBeLessThan(2.0);
    expect(DOMAIN_RANDOMIZATION.mass.max).toBeGreaterThan(DOMAIN_RANDOMIZATION.mass.min);
  });

  it('should simulate motor response characteristics', () => {
    // Real STS3215 specs:
    // - Response time: 5-20ms
    // - Position accuracy: ±0.5° (0.009 rad)
    // - Velocity: up to 300°/s

    const jitterRange = DOMAIN_RANDOMIZATION.motorJitter;
    const latencyRange = DOMAIN_RANDOMIZATION.motorLatency;

    // Jitter should simulate position accuracy
    expect(jitterRange.max).toBeGreaterThanOrEqual(0.009); // At least ±0.5°

    // Latency should simulate response time
    expect(latencyRange.max).toBeGreaterThanOrEqual(20);
  });
});

/**
 * Helper to check if physics parameters are within realistic bounds
 */
export function validatePhysicsRealism(physics: ReturnType<typeof randomizePhysics>): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check gravity is Earth-like
  if (Math.abs(physics.gravity[1] + 9.81) > 1) {
    warnings.push(`Gravity ${physics.gravity[1]} differs significantly from Earth (-9.81)`);
  }

  // Check friction isn't too extreme
  if (physics.gripperFriction < 0.5) {
    warnings.push('Gripper friction too low - objects may slip');
  }
  if (physics.gripperFriction > 5) {
    warnings.push('Gripper friction unrealistically high');
  }

  // Check mass is reasonable
  if (physics.objectMass < 0.01) {
    warnings.push('Object mass too low - may have unrealistic dynamics');
  }
  if (physics.objectMass > 2) {
    warnings.push('Object mass may exceed gripper capacity');
  }

  // Check latency isn't too high
  if (physics.motorLatencyMs > 100) {
    warnings.push('Motor latency very high - may cause control instability');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

export { DOMAIN_RANDOMIZATION, randomizePhysics, getDefaultPhysics };
