/**
 * RoboSim Robot API
 *
 * This module provides the JavaScript API that users can call from their code
 * to control the robot in the simulation.
 */

import { useAppStore } from '../stores/useAppStore';
import type { JointState } from '../types';
import { scheduleFrame } from './animationUtils';

// Types for the API
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SensorData {
  ultrasonic: number;
  ir: { left: boolean; center: boolean; right: boolean };
  gps: Vector3;
  accelerometer: Vector3;
  gyroscope: Vector3;
  imu: { roll: number; pitch: number; yaw: number };
  touch: { front: boolean; left: boolean; right: boolean; back: boolean };
}

export interface ConsoleMessage {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

// Animation helper - smoothly animate to target joints
const animateToJoints = (
  targetJoints: Partial<JointState>,
  duration = 500
): Promise<void> => {
  return new Promise((resolve) => {
    const store = useAppStore.getState();
    const startJoints = { ...store.joints };
    const startTime = Date.now();

    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      const newJoints: Partial<JointState> = {};
      for (const joint of Object.keys(startJoints) as (keyof JointState)[]) {
        if (targetJoints[joint] !== undefined) {
          newJoints[joint] =
            startJoints[joint] +
            ((targetJoints[joint] as number) - startJoints[joint]) * eased;
        }
      }

      useAppStore.getState().setJoints(newJoints);

      if (progress < 1) {
        scheduleFrame(animate);
      } else {
        resolve();
      }
    };

    animate();
  });
};

// Calculate animation duration based on movement amount
const calculateDuration = (
  current: number,
  target: number,
  speed = 1
): number => {
  const distance = Math.abs(target - current);
  const baseDuration = 300; // minimum duration
  const perDegree = 5; // ms per degree
  return Math.max(baseDuration, (distance * perDegree) / speed);
};

/**
 * Robot API object - this is what users interact with in their code
 */
export const createRobotAPI = (
  addConsoleMessage: (msg: ConsoleMessage) => void,
  onStop?: () => void
) => {
  let isStopped = false;

  const checkStopped = () => {
    if (isStopped) {
      throw new Error('Program stopped');
    }
  };

  return {
    // ==================== MOVEMENT ====================

    /**
     * Move a single joint to a specific angle
     * @param joint - Joint name: 'base', 'shoulder', 'elbow', 'wrist', or 'gripper'
     * @param angle - Target angle in degrees (or percentage for gripper)
     * @param speed - Movement speed multiplier (default: 1)
     */
    async moveJoint(joint: string, angle: number, speed = 1): Promise<void> {
      checkStopped();
      const store = useAppStore.getState();
      const currentAngle = store.joints[joint as keyof JointState];
      if (currentAngle === undefined) {
        throw new Error(`Unknown joint: ${joint}`);
      }

      const duration = calculateDuration(currentAngle, angle, speed);
      store.setIsAnimating(true);
      await animateToJoints({ [joint]: angle } as Partial<JointState>, duration);
      store.setIsAnimating(false);
    },

    /**
     * Move multiple joints simultaneously
     * @param joints - Object with joint names and target angles
     * @param speed - Movement speed multiplier (default: 1)
     */
    async moveJoints(joints: Partial<JointState>, speed = 1): Promise<void> {
      checkStopped();
      const store = useAppStore.getState();

      // Calculate duration based on largest movement
      let maxDuration = 300;
      for (const [joint, target] of Object.entries(joints)) {
        const current = store.joints[joint as keyof JointState];
        if (current !== undefined && target !== undefined) {
          const duration = calculateDuration(current, target, speed);
          maxDuration = Math.max(maxDuration, duration);
        }
      }

      store.setIsAnimating(true);
      await animateToJoints(joints, maxDuration);
      store.setIsAnimating(false);
    },

    /**
     * Move to home position (all joints centered)
     */
    async goHome(): Promise<void> {
      checkStopped();
      const store = useAppStore.getState();
      const defaultPosition = store.selectedRobot?.defaultPosition || {
        base: 0,
        shoulder: 0,
        elbow: 0,
        wrist: 0,
        wristRoll: 0,
        gripper: 50,
      };

      store.setIsAnimating(true);
      await animateToJoints(defaultPosition, 800);
      store.setIsAnimating(false);
    },

    // ==================== GRIPPER ====================

    /**
     * Open the gripper fully
     */
    async openGripper(): Promise<void> {
      checkStopped();
      const store = useAppStore.getState();
      store.setIsAnimating(true);
      await animateToJoints({ gripper: 100 }, 400);
      store.setIsAnimating(false);
    },

    /**
     * Close the gripper fully
     */
    async closeGripper(): Promise<void> {
      checkStopped();
      const store = useAppStore.getState();
      store.setIsAnimating(true);
      await animateToJoints({ gripper: 0 }, 400);
      store.setIsAnimating(false);
    },

    /**
     * Set gripper to a specific percentage
     * @param percent - 0 (closed) to 100 (fully open)
     */
    async setGripper(percent: number): Promise<void> {
      checkStopped();
      const clamped = Math.max(0, Math.min(100, percent));
      const store = useAppStore.getState();
      store.setIsAnimating(true);
      await animateToJoints({ gripper: clamped }, 400);
      store.setIsAnimating(false);
    },

    // ==================== SENSORS ====================

    /**
     * Read the ultrasonic distance sensor
     * @returns Distance in centimeters
     */
    readUltrasonic(): number {
      checkStopped();
      const { sensors } = useAppStore.getState();
      return sensors.ultrasonic ?? 100;
    },

    /**
     * Read an IR sensor
     * @param sensor - Which sensor: 'left', 'center', or 'right'
     * @returns true if line detected, false otherwise
     */
    readIR(sensor: 'left' | 'center' | 'right'): boolean {
      checkStopped();
      const { sensors } = useAppStore.getState();
      switch (sensor) {
        case 'left': return sensors.leftIR ?? false;
        case 'center': return sensors.centerIR ?? false;
        case 'right': return sensors.rightIR ?? false;
        default: return false;
      }
    },

    /**
     * Read all IR sensors at once
     * @returns Object with left, center, right boolean values
     */
    readAllIR(): { left: boolean; center: boolean; right: boolean } {
      checkStopped();
      const { sensors } = useAppStore.getState();
      return {
        left: sensors.leftIR ?? false,
        center: sensors.centerIR ?? false,
        right: sensors.rightIR ?? false,
      };
    },

    /**
     * Read the gyroscope (angular velocity)
     * @returns Vector3 with x, y, z angular velocities
     */
    readGyro(): Vector3 {
      checkStopped();
      // Simulated based on joint movement rates
      return { x: 0, y: 0, z: 0 };
    },

    /**
     * Read the accelerometer
     * @returns Vector3 with x, y, z accelerations
     */
    readAccelerometer(): Vector3 {
      checkStopped();
      // Simulated - gravity points down
      return { x: 0, y: -9.81, z: 0 };
    },

    /**
     * Get the robot's GPS position
     * @returns Vector3 with x, y, z world coordinates
     */
    getPosition(): Vector3 {
      checkStopped();
      // For arm robot, this is the gripper position
      // Could calculate from forward kinematics
      return { x: 0, y: 0.3, z: 0 };
    },

    // ==================== STATE ====================

    /**
     * Get the current position of a joint
     * @param joint - Joint name
     * @returns Current angle in degrees
     */
    getJointPosition(joint: string): number {
      checkStopped();
      const { joints } = useAppStore.getState();
      const value = joints[joint as keyof JointState];
      if (value === undefined) {
        throw new Error(`Unknown joint: ${joint}`);
      }
      return value;
    },

    /**
     * Get all joint positions
     * @returns Object with all joint angles
     */
    getAllJoints(): JointState {
      checkStopped();
      return { ...useAppStore.getState().joints };
    },

    /**
     * Get the battery level
     * @returns Battery percentage 0-100
     */
    getBattery(): number {
      checkStopped();
      const { sensors } = useAppStore.getState();
      return sensors.battery ?? 100;
    },

    // ==================== UTILITIES ====================

    /**
     * Wait for a specified duration
     * @param ms - Milliseconds to wait
     */
    async wait(ms: number): Promise<void> {
      checkStopped();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (isStopped) {
            reject(new Error('Program stopped'));
          } else {
            resolve();
          }
        }, ms);

        // Allow cleanup if stopped
        if (isStopped) {
          clearTimeout(timeout);
          reject(new Error('Program stopped'));
        }
      });
    },

    /**
     * Print a message to the console
     * @param message - Message to print (will be converted to string)
     */
    print(...args: unknown[]): void {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      addConsoleMessage({
        type: 'log',
        message,
        timestamp: new Date(),
      });
    },

    /**
     * Print an error message to the console
     * @param message - Error message
     */
    printError(...args: unknown[]): void {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      addConsoleMessage({
        type: 'error',
        message,
        timestamp: new Date(),
      });
    },

    /**
     * Print a warning message to the console
     * @param message - Warning message
     */
    printWarn(...args: unknown[]): void {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      addConsoleMessage({
        type: 'warn',
        message,
        timestamp: new Date(),
      });
    },

    // ==================== CONTROL ====================

    /**
     * Stop the current program (called externally)
     */
    _stop(): void {
      isStopped = true;
      useAppStore.getState().setIsAnimating(false);
      if (onStop) onStop();
    },

    /**
     * Check if the program has been stopped
     */
    isStopped(): boolean {
      return isStopped;
    },
  };
};

export type RobotAPI = ReturnType<typeof createRobotAPI>;
