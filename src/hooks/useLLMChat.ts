import { useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { JointState, ActiveRobotType, WheeledRobotState, DroneState, HumanoidState } from '../types';
import { callClaudeAPI, getClaudeApiKey, type FullRobotState, type ConversationMessage } from '../lib/claudeApi';
import { robotContext } from '../lib/robotContext';
import { createLogger } from '../lib/logger';

const log = createLogger('LLMChat');

// System prompts for different robot types
export const SYSTEM_PROMPTS: Record<ActiveRobotType, string> = {
  arm: `You are a robot arm controller for the SO-101, a 6-DOF open-source desktop robot arm from The Robot Studio.

HARDWARE SPECIFICATIONS:
- Base/Shoulder Pan: -110° to +110° (0° = forward)
- Shoulder Lift: -100° to +100° (0° = horizontal, positive = up)
- Elbow Flex: -97° to +97° (0° = straight, negative = fold up)
- Wrist Flex: -95° to +95° (0° = aligned with forearm)
- Wrist Roll: -157° to +163°
- Gripper: 0 (closed) to 100 (fully open)

This robot uses STS3215 servo motors and is compatible with LeRobot for imitation learning.
Respond with JSON for movements and sequences.`,

  wheeled: `You are a controller for a differential drive wheeled robot with ultrasonic and IR sensors.

HARDWARE SPECIFICATIONS:
- Left/Right motor speed: -255 to +255 (negative = reverse)
- Servo head: -90° to +90° (for ultrasonic sensor pan)
- Ultrasonic range: 2cm to 400cm
- 3 IR line sensors (left, center, right)

Commands: forward, backward, turn left/right, spin, follow line, avoid obstacles.`,

  drone: `You are a controller for a mini quadcopter drone with altitude hold capability.

HARDWARE SPECIFICATIONS:
- Throttle: 0% to 100%
- Roll/Pitch: -45° to +45°
- Yaw: -180° to +180°
- Flight modes: stabilize, altitude_hold, position_hold, land

Commands: takeoff, land, hover, fly direction, rotate, flip.`,

  humanoid: `You are a controller for the Berkeley Humanoid Lite, a 22-DOF bipedal humanoid robot.

HARDWARE SPECIFICATIONS:
- Height: 0.8m, Weight: 16kg
- Legs: 6 DOF each (hip pitch/roll/yaw, knee, ankle pitch/roll)
- Arms: 5 DOF each (shoulder pitch/roll/yaw, elbow, wrist)
- Joint ranges: typically -90° to +90° depending on joint

Commands: walk forward, wave, squat, raise arms, stand on one leg, reset pose.`,
};

export const useLLMChat = () => {
  const {
    joints,
    addMessage,
    messages,
    setLLMLoading,
    setJoints,
    setIsAnimating,
    setCode,
    activeRobotType,
    wheeledRobot,
    setWheeledRobot,
    drone,
    setDrone,
    humanoid,
    setHumanoid,
    sensors,
    isAnimating,
  } = useAppStore();

  const jointsRef = useRef<JointState>(joints);
  jointsRef.current = joints;

  const wheeledRef = useRef<WheeledRobotState>(wheeledRobot);
  wheeledRef.current = wheeledRobot;

  const droneRef = useRef<DroneState>(drone);
  droneRef.current = drone;

  const humanoidRef = useRef<HumanoidState>(humanoid);
  humanoidRef.current = humanoid;

  const sensorsRef = useRef(sensors);
  sensorsRef.current = sensors;

  const isAnimatingRef = useRef(isAnimating);
  isAnimatingRef.current = isAnimating;

  // Motor dynamics constants (based on STS3215 servo specs)
  const MOTOR_DYNAMICS = {
    maxVelocityDegPerSec: 180, // Maximum joint velocity in degrees/second
    riseTimeMs: 150,          // Time for servo to reach 63% of target (first-order response)
    settlingTimeMs: 50,       // Additional settling time after reaching target
    minDurationMs: 200,       // Minimum animation duration
  };

  /**
   * S-curve easing function for more realistic motor motion
   * Provides smooth acceleration and deceleration matching real servo behavior
   */
  const sCurveEase = (t: number): number => {
    // Quintic S-curve: smooth start and end, constant velocity in middle
    if (t < 0.5) {
      return 16 * t * t * t * t * t;
    }
    return 1 - Math.pow(-2 * t + 2, 5) / 2;
  };

  /**
   * Calculate realistic animation duration based on motor constraints
   */
  const calculateMotorDuration = (
    startJoints: JointState,
    targetJoints: Partial<JointState>,
    requestedDuration: number
  ): number => {
    // Find the maximum angle change across all joints
    let maxAngleChange = 0;
    for (const joint of Object.keys(targetJoints) as (keyof JointState)[]) {
      if (targetJoints[joint] !== undefined) {
        const change = Math.abs((targetJoints[joint] as number) - startJoints[joint]);
        maxAngleChange = Math.max(maxAngleChange, change);
      }
    }

    // Calculate minimum duration based on max velocity
    const minDurationFromVelocity = (maxAngleChange / MOTOR_DYNAMICS.maxVelocityDegPerSec) * 1000;

    // Add rise time and settling time for realistic servo response
    const realisticMinDuration = minDurationFromVelocity + MOTOR_DYNAMICS.riseTimeMs + MOTOR_DYNAMICS.settlingTimeMs;

    // Use the larger of requested duration or realistic minimum
    return Math.max(requestedDuration, realisticMinDuration, MOTOR_DYNAMICS.minDurationMs);
  };

  const animateToJoints = useCallback(
    (targetJoints: Partial<JointState>, requestedDuration = 600): Promise<void> => {
      return new Promise((resolve) => {
        const startJoints = { ...jointsRef.current };
        const startTime = Date.now();

        // Calculate realistic duration based on motor constraints
        const duration = calculateMotorDuration(startJoints, targetJoints, requestedDuration);

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Use S-curve easing for realistic motor motion
          const eased = sCurveEase(progress);

          const newJoints: Partial<JointState> = {};
          for (const joint of Object.keys(startJoints) as (keyof JointState)[]) {
            if (targetJoints[joint] !== undefined) {
              newJoints[joint] =
                startJoints[joint] +
                ((targetJoints[joint] as number) - startJoints[joint]) * eased;
            }
          }

          setJoints(newJoints);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            resolve();
          }
        };

        animate();
      });
    },
    [setJoints]
  );

  const executeArmSequence = useCallback(
    async (sequence: Record<string, number | string>[]) => {
      setIsAnimating(true);
      let currentJoints = { ...jointsRef.current };

      for (const step of sequence) {
        const targetJoints: Partial<JointState> = {};

        for (const [joint, value] of Object.entries(step)) {
          const jointKey = joint as keyof JointState;
          if (typeof value === 'string') {
            if (value.startsWith('+') || value.startsWith('-')) {
              targetJoints[jointKey] = currentJoints[jointKey] + parseFloat(value);
            }
          } else if (typeof value === 'number') {
            targetJoints[jointKey] = value;
          }
        }

        await animateToJoints(targetJoints, 500);
        currentJoints = { ...currentJoints, ...targetJoints };
        await new Promise((r) => setTimeout(r, 100));
      }

      setIsAnimating(false);
    },
    [animateToJoints, setIsAnimating]
  );

  const executeWheeledAction = useCallback(
    async (action: Partial<WheeledRobotState>, duration = 1000) => {
      setIsAnimating(true);
      setWheeledRobot(action);
      await new Promise((r) => setTimeout(r, duration));
      setIsAnimating(false);
    },
    [setWheeledRobot, setIsAnimating]
  );

  const executeDroneAction = useCallback(
    async (action: Partial<DroneState>, duration = 1000) => {
      setIsAnimating(true);
      setDrone(action);
      await new Promise((r) => setTimeout(r, duration));
      setIsAnimating(false);
    },
    [setDrone, setIsAnimating]
  );

  const executeHumanoidAction = useCallback(
    async (action: Partial<HumanoidState>, duration = 1000) => {
      setIsAnimating(true);
      setHumanoid(action);
      await new Promise((r) => setTimeout(r, duration));
      setIsAnimating(false);
    },
    [setHumanoid, setIsAnimating]
  );

  const sendMessage = useCallback(
    async (message: string) => {
      addMessage({ role: 'user', content: message });
      setLLMLoading(true);

      try {
        // Build full robot state for semantic context
        const fullState: FullRobotState = {
          joints: jointsRef.current,
          wheeledRobot: wheeledRef.current,
          drone: droneRef.current,
          humanoid: humanoidRef.current,
          sensors: sensorsRef.current,
          isAnimating: isAnimatingRef.current,
          objects: useAppStore.getState().objects,
        };

        // Build conversation history from stored messages
        const conversationHistory: ConversationMessage[] = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

        // Use Claude API (falls back to simulation if no API key)
        const apiKey = getClaudeApiKey();
        log.debug('Calling Claude API', {
          message,
          robotType: activeRobotType,
          hasApiKey: !!apiKey,
          objectCount: fullState.objects?.length || 0,
        });

        const response = await callClaudeAPI(message, activeRobotType, fullState, apiKey || undefined, conversationHistory);

        log.debug('Got response', {
          action: response.action,
          hasJoints: !!response.joints,
        });

        if (response.action === 'error') {
          addMessage({
            role: 'assistant',
            content: response.description || 'I could not understand that command.',
            isError: true,
          });
          robotContext.emit({ type: 'error', timestamp: new Date(), details: response.description });
        } else if (response.action === 'query' && response.clarifyingQuestion) {
          // LLM is asking for clarification
          addMessage({
            role: 'assistant',
            content: response.clarifyingQuestion,
          });
        } else {
          addMessage({
            role: 'assistant',
            content: response.description,
            codeGenerated: response.code,
          });

          if (response.code) {
            setCode({ source: response.code, isGenerated: true });
          }

          // Execute movements based on robot type
          log.debug('Checking for arm movement', {
            activeRobotType,
            hasJoints: !!response.joints,
            isArray: Array.isArray(response.joints)
          });

          if (activeRobotType === 'arm' && response.joints) {
            const sequence = Array.isArray(response.joints)
              ? response.joints
              : [response.joints];

            log.debug(`Executing arm sequence with ${sequence.length} steps`);

            // Record action and start task tracking
            robotContext.startTask(response.description);

            try {
              await executeArmSequence(sequence);
              robotContext.completeTask(response.description);
            } catch (err) {
              robotContext.failTask(err instanceof Error ? err.message : 'Movement failed');
            }
          } else if (activeRobotType === 'wheeled' && response.wheeledAction) {
            robotContext.startTask(response.description);
            await executeWheeledAction(response.wheeledAction, response.duration);
            robotContext.completeTask();
          } else if (activeRobotType === 'drone' && response.droneAction) {
            robotContext.startTask(response.description);
            await executeDroneAction(response.droneAction, response.duration);
            robotContext.completeTask();
          } else if (activeRobotType === 'humanoid' && response.humanoidAction) {
            robotContext.startTask(response.description);
            await executeHumanoidAction(response.humanoidAction, response.duration);
            robotContext.completeTask();
          }
        }
      } catch (error) {
        addMessage({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isError: true,
        });
        robotContext.emit({ type: 'error', timestamp: new Date(), details: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setLLMLoading(false);
      }
    },
    [addMessage, messages, setLLMLoading, executeArmSequence, executeWheeledAction, executeDroneAction, executeHumanoidAction, setCode, activeRobotType]
  );

  return { sendMessage };
};
