/**
 * RoboSim Code Runner
 *
 * Safely executes user-written JavaScript code with the robot API injected.
 * Includes timeout protection, error handling, and stop functionality.
 */

import { createRobotAPI, type ConsoleMessage, type RobotAPI } from './robotAPI';

export interface CodeRunnerOptions {
  timeout?: number; // Maximum execution time in ms (default: 30000)
  onConsoleMessage: (msg: ConsoleMessage) => void;
  onStart?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  onStop?: () => void;
}

export interface CodeRunnerResult {
  success: boolean;
  error?: string;
  executionTime: number;
}

// Global reference to current running program for stop functionality
let currentRobotAPI: RobotAPI | null = null;
let isRunning = false;

/**
 * Stop the currently running program
 */
export const stopProgram = (): void => {
  if (currentRobotAPI && isRunning) {
    currentRobotAPI._stop();
    currentRobotAPI = null;
    isRunning = false;
  }
};

/**
 * Check if a program is currently running
 */
export const isProgramRunning = (): boolean => {
  return isRunning;
};

/**
 * Run user code with the robot API
 */
export const runCode = async (
  code: string,
  options: CodeRunnerOptions
): Promise<CodeRunnerResult> => {
  const {
    timeout = 30000,
    onConsoleMessage,
    onStart,
    onComplete,
    onError,
    onStop,
  } = options;

  const startTime = Date.now();

  // Stop any existing program
  if (isRunning) {
    stopProgram();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Create the robot API instance
  const robotAPI = createRobotAPI(onConsoleMessage, onStop);
  currentRobotAPI = robotAPI;
  isRunning = true;

  if (onStart) onStart();

  try {
    // Create a safe execution context with the robot API
    // We wrap the user code in an async function to support await
    const wrappedCode = `
      return (async function(robot, wait, print, printError, printWarn) {
        // Expose commonly used functions directly
        const moveJoint = robot.moveJoint.bind(robot);
        const moveJoints = robot.moveJoints.bind(robot);
        const goHome = robot.goHome.bind(robot);
        const openGripper = robot.openGripper.bind(robot);
        const closeGripper = robot.closeGripper.bind(robot);
        const setGripper = robot.setGripper.bind(robot);
        const readUltrasonic = robot.readUltrasonic.bind(robot);
        const readIR = robot.readIR.bind(robot);
        const readAllIR = robot.readAllIR.bind(robot);
        const readGyro = robot.readGyro.bind(robot);
        const readAccelerometer = robot.readAccelerometer.bind(robot);
        const getPosition = robot.getPosition.bind(robot);
        const getJointPosition = robot.getJointPosition.bind(robot);
        const getAllJoints = robot.getAllJoints.bind(robot);
        const getBattery = robot.getBattery.bind(robot);

        try {
          ${code}
        } catch (e) {
          if (e.message === 'Program stopped') {
            // Expected when stopped, don't rethrow
            return;
          }
          throw e;
        }
      })
    `;

    // Create the async function
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const userFunction = new AsyncFunction(wrappedCode)();

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Program timed out after ${timeout / 1000} seconds`));
      }, timeout);
    });

    // Race between user code and timeout
    await Promise.race([
      userFunction(
        robotAPI,
        robotAPI.wait.bind(robotAPI),
        robotAPI.print.bind(robotAPI),
        robotAPI.printError.bind(robotAPI),
        robotAPI.printWarn.bind(robotAPI)
      ),
      timeoutPromise,
    ]);

    const executionTime = Date.now() - startTime;

    if (!robotAPI.isStopped()) {
      onConsoleMessage({
        type: 'info',
        message: `Program completed in ${executionTime}ms`,
        timestamp: new Date(),
      });
    }

    if (onComplete) onComplete();

    return {
      success: true,
      executionTime,
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Don't report "Program stopped" as an error
    if (errorMessage === 'Program stopped') {
      onConsoleMessage({
        type: 'info',
        message: 'Program stopped by user',
        timestamp: new Date(),
      });

      if (onStop) onStop();

      return {
        success: true,
        executionTime,
      };
    }

    onConsoleMessage({
      type: 'error',
      message: `Error: ${errorMessage}`,
      timestamp: new Date(),
    });

    if (onError) onError(error instanceof Error ? error : new Error(errorMessage));

    return {
      success: false,
      error: errorMessage,
      executionTime,
    };

  } finally {
    isRunning = false;
    currentRobotAPI = null;
  }
};

/**
 * Validate code syntax before running
 */
export const validateCode = (code: string): { valid: boolean; error?: string } => {
  try {
    // Try to parse the code as a function body
    new Function(code);
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Syntax error';
    return { valid: false, error: message };
  }
};

/**
 * Format code for display (basic formatting)
 */
export const formatCode = (code: string): string => {
  // Basic formatting - could be enhanced with prettier
  return code
    .replace(/\s*{\s*/g, ' {\n  ')
    .replace(/\s*}\s*/g, '\n}\n')
    .replace(/;\s*/g, ';\n')
    .replace(/\n\s*\n\s*\n/g, '\n\n');
};
