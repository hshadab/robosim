/**
 * Multi-Robot Management
 *
 * Support for multiple robot instances in the same simulation.
 * Enables swarm robotics, multi-agent scenarios, and collaborative tasks.
 */

import type {
  JointState,
  WheeledRobotState,
  DroneState,
  HumanoidState,
  ActiveRobotType,
  Vector3D,
} from '../types';
import {
  DEFAULT_DRONE_STATE,
  DEFAULT_HUMANOID_STATE,
} from '../components/simulation/defaults';

// Default state for wheeled robots
const DEFAULT_WHEELED_STATE: WheeledRobotState = {
  leftWheelSpeed: 0,
  rightWheelSpeed: 0,
  position: { x: 0, y: 0, z: 0 },
  heading: 0,
  velocity: 0,
  angularVelocity: 0,
  servoHead: 90,
};

// Robot instance interface
export interface RobotInstance {
  id: string;
  name: string;
  type: ActiveRobotType;
  profileId: string;
  position: Vector3D;
  rotation: number; // Y-axis rotation in degrees
  color: string; // Accent color for visualization
  enabled: boolean;

  // Type-specific state
  joints?: JointState;
  wheeledState?: WheeledRobotState;
  droneState?: DroneState;
  humanoidState?: HumanoidState;
}

// Multi-robot configuration
export interface MultiRobotConfig {
  maxRobots: number;
  allowMixedTypes: boolean;
  collisionDetection: boolean;
  syncMode: 'independent' | 'leader-follower' | 'coordinated';
}

// Default configuration
export const DEFAULT_MULTI_ROBOT_CONFIG: MultiRobotConfig = {
  maxRobots: 8,
  allowMixedTypes: true,
  collisionDetection: true,
  syncMode: 'independent',
};

// Color palette for robot instances
export const ROBOT_COLORS = [
  '#3b82f6', // Blue (primary)
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Orange
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
];

// Default joint state for arm robots
const DEFAULT_ARM_JOINTS: JointState = {
  base: 0,
  shoulder: 0,
  elbow: 0,
  wrist: 0,
  wristRoll: 0,
  gripper: 50,
};


/**
 * Generate unique robot instance ID
 */
export function generateRobotId(): string {
  return `robot_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Create a new robot instance with default state
 */
export function createRobotInstance(
  type: ActiveRobotType,
  profileId: string,
  name?: string,
  position?: Vector3D
): RobotInstance {
  const id = generateRobotId();
  const colorIndex = Math.floor(Math.random() * ROBOT_COLORS.length);

  const instance: RobotInstance = {
    id,
    name: name || `Robot ${id.slice(-4)}`,
    type,
    profileId,
    position: position || { x: 0, y: 0, z: 0 },
    rotation: 0,
    color: ROBOT_COLORS[colorIndex],
    enabled: true,
  };

  // Add type-specific default state
  switch (type) {
    case 'arm':
      instance.joints = { ...DEFAULT_ARM_JOINTS };
      break;
    case 'wheeled':
      instance.wheeledState = { ...DEFAULT_WHEELED_STATE };
      break;
    case 'drone':
      instance.droneState = { ...DEFAULT_DRONE_STATE };
      break;
    case 'humanoid':
      // Humanoid state is more complex - initialize with defaults
      instance.humanoidState = { ...DEFAULT_HUMANOID_STATE };
      break;
  }

  return instance;
}

/**
 * Clone a robot instance with new ID
 */
export function cloneRobotInstance(
  source: RobotInstance,
  offset?: Vector3D
): RobotInstance {
  const clone: RobotInstance = {
    ...JSON.parse(JSON.stringify(source)),
    id: generateRobotId(),
    name: `${source.name} (copy)`,
    position: {
      x: source.position.x + (offset?.x ?? 0.3),
      y: source.position.y + (offset?.y ?? 0),
      z: source.position.z + (offset?.z ?? 0),
    },
  };

  // Assign new color
  const currentColorIndex = ROBOT_COLORS.indexOf(source.color);
  clone.color = ROBOT_COLORS[(currentColorIndex + 1) % ROBOT_COLORS.length];

  return clone;
}

/**
 * Calculate formation positions for multiple robots
 */
export function calculateFormation(
  count: number,
  pattern: 'line' | 'grid' | 'circle' | 'v-formation',
  center: Vector3D = { x: 0, y: 0, z: 0 },
  spacing: number = 0.3
): Vector3D[] {
  const positions: Vector3D[] = [];

  switch (pattern) {
    case 'line':
      for (let i = 0; i < count; i++) {
        positions.push({
          x: center.x + (i - (count - 1) / 2) * spacing,
          y: center.y,
          z: center.z,
        });
      }
      break;

    case 'grid': {
      const cols = Math.ceil(Math.sqrt(count));
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        positions.push({
          x: center.x + (col - (cols - 1) / 2) * spacing,
          y: center.y,
          z: center.z + row * spacing,
        });
      }
      break;
    }

    case 'circle':
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        const radius = (count * spacing) / (2 * Math.PI);
        positions.push({
          x: center.x + radius * Math.cos(angle),
          y: center.y,
          z: center.z + radius * Math.sin(angle),
        });
      }
      break;

    case 'v-formation':
      for (let i = 0; i < count; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const depth = Math.ceil(i / 2);
        positions.push({
          x: center.x + side * depth * spacing * 0.7,
          y: center.y,
          z: center.z - depth * spacing,
        });
      }
      break;
  }

  return positions;
}

/**
 * Calculate distance between two robot positions
 */
export function calculateDistance(a: Vector3D, b: Vector3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Check for potential collisions between robots
 */
export function checkCollisions(
  robots: RobotInstance[],
  minDistance: number = 0.15
): Array<{ robot1: string; robot2: string; distance: number }> {
  const collisions: Array<{ robot1: string; robot2: string; distance: number }> = [];

  for (let i = 0; i < robots.length; i++) {
    for (let j = i + 1; j < robots.length; j++) {
      const dist = calculateDistance(robots[i].position, robots[j].position);
      if (dist < minDistance) {
        collisions.push({
          robot1: robots[i].id,
          robot2: robots[j].id,
          distance: dist,
        });
      }
    }
  }

  return collisions;
}

/**
 * Multi-robot state manager
 */
export class MultiRobotManager {
  private robots: Map<string, RobotInstance> = new Map();
  private config: MultiRobotConfig;
  private activeRobotId: string | null = null;
  private listeners: Set<(robots: RobotInstance[]) => void> = new Set();

  constructor(config: Partial<MultiRobotConfig> = {}) {
    this.config = { ...DEFAULT_MULTI_ROBOT_CONFIG, ...config };
  }

  /**
   * Add a new robot instance
   */
  addRobot(robot: RobotInstance): boolean {
    if (this.robots.size >= this.config.maxRobots) {
      console.warn('Maximum robot count reached');
      return false;
    }

    if (!this.config.allowMixedTypes && this.robots.size > 0) {
      const firstRobot = this.robots.values().next().value as RobotInstance;
      if (firstRobot.type !== robot.type) {
        console.warn('Mixed robot types not allowed');
        return false;
      }
    }

    this.robots.set(robot.id, robot);

    if (!this.activeRobotId) {
      this.activeRobotId = robot.id;
    }

    this.notifyListeners();
    return true;
  }

  /**
   * Remove a robot instance
   */
  removeRobot(robotId: string): boolean {
    const removed = this.robots.delete(robotId);

    if (removed && this.activeRobotId === robotId) {
      const remaining = this.robots.keys().next().value;
      this.activeRobotId = remaining || null;
    }

    this.notifyListeners();
    return removed;
  }

  /**
   * Update robot state
   */
  updateRobot(robotId: string, updates: Partial<RobotInstance>): boolean {
    const robot = this.robots.get(robotId);
    if (!robot) return false;

    Object.assign(robot, updates);
    this.notifyListeners();
    return true;
  }

  /**
   * Get all robots
   */
  getRobots(): RobotInstance[] {
    return Array.from(this.robots.values());
  }

  /**
   * Get robot by ID
   */
  getRobot(robotId: string): RobotInstance | undefined {
    return this.robots.get(robotId);
  }

  /**
   * Get active robot
   */
  getActiveRobot(): RobotInstance | undefined {
    return this.activeRobotId ? this.robots.get(this.activeRobotId) : undefined;
  }

  /**
   * Set active robot
   */
  setActiveRobot(robotId: string): boolean {
    if (!this.robots.has(robotId)) return false;
    this.activeRobotId = robotId;
    this.notifyListeners();
    return true;
  }

  /**
   * Get active robot ID
   */
  getActiveRobotId(): string | null {
    return this.activeRobotId;
  }

  /**
   * Get robot count
   */
  getCount(): number {
    return this.robots.size;
  }

  /**
   * Check for collisions
   */
  checkCollisions(): Array<{ robot1: string; robot2: string; distance: number }> {
    if (!this.config.collisionDetection) return [];
    return checkCollisions(this.getRobots());
  }

  /**
   * Clear all robots
   */
  clear(): void {
    this.robots.clear();
    this.activeRobotId = null;
    this.notifyListeners();
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: (robots: RobotInstance[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const robots = this.getRobots();
    this.listeners.forEach(listener => listener(robots));
  }

  /**
   * Apply command to all robots
   */
  broadcastCommand<T>(command: (robot: RobotInstance) => T): Map<string, T> {
    const results = new Map<string, T>();
    for (const [id, robot] of this.robots) {
      if (robot.enabled) {
        results.set(id, command(robot));
      }
    }
    return results;
  }

  /**
   * Get configuration
   */
  getConfig(): MultiRobotConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<MultiRobotConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Global multi-robot manager instance
let globalMultiRobotManager: MultiRobotManager | null = null;

export function getMultiRobotManager(): MultiRobotManager {
  if (!globalMultiRobotManager) {
    globalMultiRobotManager = new MultiRobotManager();
  }
  return globalMultiRobotManager;
}

export function resetMultiRobotManager(): void {
  if (globalMultiRobotManager) {
    globalMultiRobotManager.clear();
  }
  globalMultiRobotManager = null;
}
