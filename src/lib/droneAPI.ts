/**
 * Drone API
 * API for controlling quadcopter drones from user code
 */

import { useAppStore } from '../stores/useAppStore';
import type { DroneState, ConsoleMessage } from '../types';
import { DEFAULT_DRONE_STATE } from '../components/simulation/defaults';

// Track running state
let isRunning = false;
let shouldStop = false;

export const createDroneAPI = (
  addConsoleMessage: (msg: ConsoleMessage) => void
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
  const getState = (): DroneState => {
    return useAppStore.getState().drone || DEFAULT_DRONE_STATE;
  };

  // Update state
  const setState = (updates: Partial<DroneState>): void => {
    useAppStore.getState().setDrone(updates);
  };

  // Calculate motor RPMs based on throttle and control inputs
  const calculateMotorRPMs = (
    throttle: number,
    roll: number,
    pitch: number,
    yaw: number
  ): [number, number, number, number] => {
    const baseRPM = (throttle / 100) * 8000;

    // Mix for quad X configuration
    // FL, FR, BL, BR
    const rollFactor = roll / 30;
    const pitchFactor = pitch / 30;
    const yawFactor = yaw / 45;

    return [
      Math.max(0, baseRPM + pitchFactor * 1000 + rollFactor * 1000 - yawFactor * 500), // FL
      Math.max(0, baseRPM + pitchFactor * 1000 - rollFactor * 1000 + yawFactor * 500), // FR
      Math.max(0, baseRPM - pitchFactor * 1000 + rollFactor * 1000 + yawFactor * 500), // BL
      Math.max(0, baseRPM - pitchFactor * 1000 - rollFactor * 1000 - yawFactor * 500), // BR
    ];
  };

  return {
    // === Arming/Disarming ===

    /**
     * Arm the drone (enable motors)
     */
    arm(): void {
      setState({
        armed: true,
        motorsRPM: [1000, 1000, 1000, 1000], // Idle RPM
      });
      print('Drone armed');
    },

    /**
     * Disarm the drone (disable motors)
     */
    disarm(): void {
      setState({
        armed: false,
        throttle: 0,
        motorsRPM: [0, 0, 0, 0],
      });
      print('Drone disarmed');
    },

    /**
     * Check if drone is armed
     */
    isArmed(): boolean {
      return getState().armed;
    },

    // === Basic Flight Commands ===

    /**
     * Take off to specified altitude
     * @param altitude Target altitude in meters (default 0.3)
     */
    async takeoff(altitude: number = 0.3): Promise<void> {
      if (!getState().armed) {
        this.arm();
        await wait(500);
      }

      setState({ flightMode: 'altitude_hold' });
      print(`Taking off to ${altitude}m...`);

      // Gradually increase throttle
      for (let t = 0; t <= 60; t += 5) {
        setState({
          throttle: t,
          motorsRPM: calculateMotorRPMs(t, 0, 0, 0),
        });
        await wait(100);

        if (getState().position.y >= altitude) break;
      }

      // Hold altitude
      setState({ throttle: 50 });
      print('Takeoff complete');
    },

    /**
     * Land the drone
     */
    async land(): Promise<void> {
      print('Landing...');
      setState({ flightMode: 'land' });

      // Gradually decrease throttle
      const state = getState();
      for (let t = state.throttle; t >= 0; t -= 2) {
        setState({
          throttle: t,
          motorsRPM: calculateMotorRPMs(t, 0, 0, 0),
        });
        await wait(50);

        if (getState().position.y <= 0.05) break;
      }

      this.disarm();
      print('Landed');
    },

    /**
     * Set throttle (vertical speed)
     * @param value Throttle 0-100
     */
    setThrottle(value: number): void {
      const throttle = Math.max(0, Math.min(100, value));
      const state = getState();
      setState({
        throttle,
        motorsRPM: calculateMotorRPMs(throttle, state.rotation.x, state.rotation.z, 0),
      });
    },

    /**
     * Hover at current position
     */
    hover(): void {
      setState({
        flightMode: 'position_hold',
        throttle: 50,
        rotation: { x: 0, y: getState().rotation.y, z: 0 },
      });
    },

    // === Movement Commands ===

    /**
     * Move forward (pitch forward)
     * @param speed Speed factor 0-100
     */
    forward(speed: number = 30): void {
      const pitch = Math.max(-30, Math.min(30, speed * 0.3));
      const state = getState();
      setState({
        rotation: { ...state.rotation, z: pitch },
        motorsRPM: calculateMotorRPMs(state.throttle, state.rotation.x, pitch, 0),
      });
    },

    /**
     * Move backward (pitch backward)
     */
    backward(speed: number = 30): void {
      const pitch = -Math.max(-30, Math.min(30, speed * 0.3));
      const state = getState();
      setState({
        rotation: { ...state.rotation, z: pitch },
        motorsRPM: calculateMotorRPMs(state.throttle, state.rotation.x, pitch, 0),
      });
    },

    /**
     * Strafe left (roll left)
     */
    left(speed: number = 30): void {
      const roll = -Math.max(-30, Math.min(30, speed * 0.3));
      const state = getState();
      setState({
        rotation: { ...state.rotation, x: roll },
        motorsRPM: calculateMotorRPMs(state.throttle, roll, state.rotation.z, 0),
      });
    },

    /**
     * Strafe right (roll right)
     */
    right(speed: number = 30): void {
      const roll = Math.max(-30, Math.min(30, speed * 0.3));
      const state = getState();
      setState({
        rotation: { ...state.rotation, x: roll },
        motorsRPM: calculateMotorRPMs(state.throttle, roll, state.rotation.z, 0),
      });
    },

    /**
     * Rotate left (yaw)
     */
    rotateLeft(speed: number = 30): void {
      const state = getState();
      const yawSpeed = speed * 0.5;
      setState({
        rotation: { ...state.rotation, y: state.rotation.y - yawSpeed },
        motorsRPM: calculateMotorRPMs(state.throttle, state.rotation.x, state.rotation.z, -yawSpeed),
      });
    },

    /**
     * Rotate right (yaw)
     */
    rotateRight(speed: number = 30): void {
      const state = getState();
      const yawSpeed = speed * 0.5;
      setState({
        rotation: { ...state.rotation, y: state.rotation.y + yawSpeed },
        motorsRPM: calculateMotorRPMs(state.throttle, state.rotation.x, state.rotation.z, yawSpeed),
      });
    },

    /**
     * Go up (increase altitude)
     */
    up(speed: number = 30): void {
      const state = getState();
      const newThrottle = Math.min(100, state.throttle + speed * 0.5);
      setState({
        throttle: newThrottle,
        motorsRPM: calculateMotorRPMs(newThrottle, state.rotation.x, state.rotation.z, 0),
      });
    },

    /**
     * Go down (decrease altitude)
     */
    down(speed: number = 30): void {
      const state = getState();
      const newThrottle = Math.max(0, state.throttle - speed * 0.5);
      setState({
        throttle: newThrottle,
        motorsRPM: calculateMotorRPMs(newThrottle, state.rotation.x, state.rotation.z, 0),
      });
    },

    /**
     * Stop all movement (return to level hover)
     */
    stop(): void {
      const state = getState();
      setState({
        rotation: { x: 0, y: state.rotation.y, z: 0 },
        motorsRPM: calculateMotorRPMs(state.throttle, 0, 0, 0),
      });
    },

    // === Timed Movement Commands ===

    async forwardFor(speed: number, ms: number): Promise<void> {
      this.forward(speed);
      await wait(ms);
      this.stop();
    },

    async backwardFor(speed: number, ms: number): Promise<void> {
      this.backward(speed);
      await wait(ms);
      this.stop();
    },

    async leftFor(speed: number, ms: number): Promise<void> {
      this.left(speed);
      await wait(ms);
      this.stop();
    },

    async rightFor(speed: number, ms: number): Promise<void> {
      this.right(speed);
      await wait(ms);
      this.stop();
    },

    // === State Queries ===

    /**
     * Get current position
     */
    getPosition(): { x: number; y: number; z: number } {
      return { ...getState().position };
    },

    /**
     * Get current altitude
     */
    getAltitude(): number {
      return getState().position.y;
    },

    /**
     * Get current rotation (roll, pitch, yaw)
     */
    getRotation(): { roll: number; pitch: number; yaw: number } {
      const rot = getState().rotation;
      return { roll: rot.x, pitch: rot.z, yaw: rot.y };
    },

    /**
     * Get current velocity
     */
    getVelocity(): { x: number; y: number; z: number } {
      return { ...getState().velocity };
    },

    /**
     * Get current flight mode
     */
    getFlightMode(): string {
      return getState().flightMode;
    },

    /**
     * Get battery level
     */
    getBattery(): number {
      return useAppStore.getState().sensors.battery ?? 100;
    },

    // === Utility Commands ===

    async wait(ms: number): Promise<void> {
      await wait(ms);
    },

    print,
    log: print,
  };
};

// Code runner for drone
export const runDroneCode = async (
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

  const api = createDroneAPI(addConsoleMessage);

  try {
    options.onStart?.();

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const userFunction = new AsyncFunction(
      'drone',
      'arm',
      'disarm',
      'takeoff',
      'land',
      'hover',
      'forward',
      'backward',
      'left',
      'right',
      'up',
      'down',
      'rotateLeft',
      'rotateRight',
      'stop',
      'getAltitude',
      'getPosition',
      'wait',
      'print',
      `
      try {
        ${code}
      } finally {
        if (drone.isArmed()) {
          await drone.land();
        }
      }
      `
    );

    await userFunction(
      api,
      api.arm.bind(api),
      api.disarm.bind(api),
      api.takeoff.bind(api),
      api.land.bind(api),
      api.hover.bind(api),
      api.forward.bind(api),
      api.backward.bind(api),
      api.left.bind(api),
      api.right.bind(api),
      api.up.bind(api),
      api.down.bind(api),
      api.rotateLeft.bind(api),
      api.rotateRight.bind(api),
      api.stop.bind(api),
      api.getAltitude.bind(api),
      api.getPosition.bind(api),
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
  }
};

export const stopDroneProgram = (): void => {
  shouldStop = true;
};
