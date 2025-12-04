/**
 * Wheeled Robot API
 * API for controlling differential drive robots from user code
 */

import { useAppStore } from '../stores/useAppStore';
import type { WheeledRobotState, ConsoleMessage } from '../types';

// Track running state
let isRunning = false;
let shouldStop = false;

// Default initial state
export const DEFAULT_WHEELED_STATE: WheeledRobotState = {
  leftWheelSpeed: 0,
  rightWheelSpeed: 0,
  position: { x: 0, y: 0, z: 0 },
  heading: 0,
  velocity: 0,
  angularVelocity: 0,
  servoHead: 0,
};

export const createWheeledRobotAPI = (
  addConsoleMessage: (msg: ConsoleMessage) => void,
  onStop?: () => void
) => {
  const print = (...args: unknown[]) => {
    const message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    addConsoleMessage({
      id: `msg-${Date.now()}-${Math.random()}`,
      type: 'log',
      message,
      timestamp: new Date(),
    });
  };

  const wait = (ms: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const checkStop = setInterval(() => {
        if (shouldStop) {
          clearInterval(checkStop);
          reject(new Error('Program stopped'));
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkStop);
        if (shouldStop) {
          reject(new Error('Program stopped'));
        } else {
          resolve();
        }
      }, ms);
    });
  };

  // Get current state
  const getState = (): WheeledRobotState => {
    return useAppStore.getState().wheeledRobot || DEFAULT_WHEELED_STATE;
  };

  // Set wheel speeds
  const setWheels = (leftSpeed: number, rightSpeed: number): void => {
    const clamp = (v: number) => Math.max(-255, Math.min(255, v));
    useAppStore.getState().setWheeledRobot({
      leftWheelSpeed: clamp(leftSpeed),
      rightWheelSpeed: clamp(rightSpeed),
    });
  };

  return {
    // === Movement Commands ===

    /**
     * Move forward at specified speed
     * @param speed Speed 0-255 (default 150)
     */
    forward(speed: number = 150): void {
      const s = Math.abs(speed);
      setWheels(s, s);
    },

    /**
     * Move backward at specified speed
     * @param speed Speed 0-255 (default 150)
     */
    backward(speed: number = 150): void {
      const s = -Math.abs(speed);
      setWheels(s, s);
    },

    /**
     * Turn left (pivot)
     * @param speed Speed 0-255 (default 150)
     */
    turnLeft(speed: number = 150): void {
      const s = Math.abs(speed);
      setWheels(-s, s);
    },

    /**
     * Turn right (pivot)
     * @param speed Speed 0-255 (default 150)
     */
    turnRight(speed: number = 150): void {
      const s = Math.abs(speed);
      setWheels(s, -s);
    },

    /**
     * Curve left while moving forward
     * @param speed Base speed
     * @param ratio Turn ratio 0-1 (0 = straight, 1 = pivot)
     */
    curveLeft(speed: number = 150, ratio: number = 0.5): void {
      const s = Math.abs(speed);
      const r = Math.max(0, Math.min(1, ratio));
      setWheels(s * (1 - r), s);
    },

    /**
     * Curve right while moving forward
     * @param speed Base speed
     * @param ratio Turn ratio 0-1
     */
    curveRight(speed: number = 150, ratio: number = 0.5): void {
      const s = Math.abs(speed);
      const r = Math.max(0, Math.min(1, ratio));
      setWheels(s, s * (1 - r));
    },

    /**
     * Stop all motors
     */
    stop(): void {
      setWheels(0, 0);
    },

    /**
     * Set individual wheel speeds
     * @param left Left wheel speed -255 to 255
     * @param right Right wheel speed -255 to 255
     */
    setWheels(left: number, right: number): void {
      setWheels(left, right);
    },

    /**
     * Move forward for a duration then stop
     * @param speed Speed
     * @param ms Duration in milliseconds
     */
    async forwardFor(speed: number, ms: number): Promise<void> {
      this.forward(speed);
      await wait(ms);
      this.stop();
    },

    /**
     * Move backward for a duration then stop
     */
    async backwardFor(speed: number, ms: number): Promise<void> {
      this.backward(speed);
      await wait(ms);
      this.stop();
    },

    /**
     * Turn left for a duration then stop
     */
    async turnLeftFor(speed: number, ms: number): Promise<void> {
      this.turnLeft(speed);
      await wait(ms);
      this.stop();
    },

    /**
     * Turn right for a duration then stop
     */
    async turnRightFor(speed: number, ms: number): Promise<void> {
      this.turnRight(speed);
      await wait(ms);
      this.stop();
    },

    // === Servo Commands ===

    /**
     * Set ultrasonic servo angle
     * @param angle Angle in degrees (-90 to 90)
     */
    setServo(angle: number): void {
      const clampedAngle = Math.max(-90, Math.min(90, angle));
      useAppStore.getState().setWheeledRobot({ servoHead: clampedAngle });
    },

    /**
     * Sweep servo and return readings
     * @param startAngle Starting angle
     * @param endAngle Ending angle
     * @param steps Number of steps
     */
    async servoSweep(
      startAngle: number = -90,
      endAngle: number = 90,
      steps: number = 9
    ): Promise<Array<{ angle: number; distance: number }>> {
      const readings: Array<{ angle: number; distance: number }> = [];
      const angleStep = (endAngle - startAngle) / (steps - 1);

      for (let i = 0; i < steps; i++) {
        const angle = startAngle + angleStep * i;
        this.setServo(angle);
        await wait(100);
        const distance = this.readUltrasonic();
        readings.push({ angle, distance });
      }

      this.setServo(0);
      return readings;
    },

    // === Sensor Commands ===

    /**
     * Read ultrasonic distance
     * @returns Distance in cm
     */
    readUltrasonic(): number {
      const sensors = useAppStore.getState().sensors;
      return sensors.ultrasonic ?? 100;
    },

    /**
     * Read IR sensors
     * @returns Object with left, center, right boolean values
     */
    readIR(): { left: boolean; center: boolean; right: boolean } {
      const sensors = useAppStore.getState().sensors;
      return {
        left: sensors.leftIR ?? false,
        center: sensors.centerIR ?? false,
        right: sensors.rightIR ?? false,
      };
    },

    /**
     * Check if path ahead is clear
     * @param threshold Distance threshold in cm
     */
    isPathClear(threshold: number = 20): boolean {
      return this.readUltrasonic() > threshold;
    },

    /**
     * Read battery level
     */
    readBattery(): number {
      const sensors = useAppStore.getState().sensors;
      return sensors.battery ?? 100;
    },

    // === Position/State Commands ===

    /**
     * Get current position
     */
    getPosition(): { x: number; y: number; z: number } {
      const state = getState();
      return { ...state.position };
    },

    /**
     * Get current heading
     */
    getHeading(): number {
      return getState().heading;
    },

    /**
     * Get current velocity
     */
    getVelocity(): number {
      return getState().velocity;
    },

    // === Utility Commands ===

    /**
     * Wait for specified time
     * @param ms Time in milliseconds
     */
    async wait(ms: number): Promise<void> {
      await wait(ms);
    },

    /**
     * Print message to console
     */
    print,

    /**
     * Log message (alias for print)
     */
    log: print,
  };
};

// Code runner for wheeled robot
export const runWheeledRobotCode = async (
  code: string,
  options: {
    onConsoleMessage?: (msg: ConsoleMessage) => void;
    onStart?: () => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
    onStop?: () => void;
  }
): Promise<void> => {
  if (isRunning) {
    options.onError?.(new Error('Code is already running'));
    return;
  }

  isRunning = true;
  shouldStop = false;

  const addConsoleMessage = (msg: ConsoleMessage) => {
    options.onConsoleMessage?.(msg);
  };

  const api = createWheeledRobotAPI(addConsoleMessage, options.onStop);

  try {
    options.onStart?.();

    // Create async function with robot API
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const userFunction = new AsyncFunction(
      'robot',
      'forward',
      'backward',
      'turnLeft',
      'turnRight',
      'stop',
      'setWheels',
      'setServo',
      'readUltrasonic',
      'readIR',
      'isPathClear',
      'getPosition',
      'getHeading',
      'wait',
      'print',
      `
      try {
        ${code}
      } finally {
        stop();
      }
      `
    );

    await userFunction(
      api,
      api.forward.bind(api),
      api.backward.bind(api),
      api.turnLeft.bind(api),
      api.turnRight.bind(api),
      api.stop.bind(api),
      api.setWheels.bind(api),
      api.setServo.bind(api),
      api.readUltrasonic.bind(api),
      api.readIR.bind(api),
      api.isPathClear.bind(api),
      api.getPosition.bind(api),
      api.getHeading.bind(api),
      api.wait.bind(api),
      api.print.bind(api)
    );

    options.onComplete?.();
  } catch (error) {
    if (error instanceof Error && error.message === 'Program stopped') {
      options.onStop?.();
    } else {
      addConsoleMessage({
        id: `error-${Date.now()}`,
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  } finally {
    isRunning = false;
    api.stop();
  }
};

export const stopWheeledRobotProgram = (): void => {
  shouldStop = true;
};
