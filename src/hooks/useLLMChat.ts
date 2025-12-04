import { useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { JointState, LLMResponse, ActiveRobotType, WheeledRobotState, DroneState, HumanoidState } from '../types';

// System prompts for different robot types
export const SYSTEM_PROMPTS: Record<ActiveRobotType, string> = {
  arm: `You are a robot arm controller for the Hiwonder xArm 1S, a 6-servo desktop robot arm made of aluminum alloy.

HARDWARE SPECIFICATIONS:
- Base rotation: -135° to +135° (0° = forward)
- Shoulder: -90° to +90° (0° = horizontal, positive = up)
- Elbow: -135° to +45° (0° = straight, negative = fold up)
- Wrist: -90° to +90° (0° = aligned with forearm)
- Gripper: 0 (closed) to 100 (fully open)

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
  } = useAppStore();

  const jointsRef = useRef<JointState>(joints);
  jointsRef.current = joints;

  const wheeledRef = useRef<WheeledRobotState>(wheeledRobot);
  wheeledRef.current = wheeledRobot;

  const droneRef = useRef<DroneState>(drone);
  droneRef.current = drone;

  const humanoidRef = useRef<HumanoidState>(humanoid);
  humanoidRef.current = humanoid;

  const animateToJoints = useCallback(
    (targetJoints: Partial<JointState>, duration = 600): Promise<void> => {
      return new Promise((resolve) => {
        const startJoints = { ...jointsRef.current };
        const startTime = Date.now();

        const animate = () => {
          const progress = Math.min((Date.now() - startTime) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);

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
    async (sequence: Array<Record<string, number | string>>) => {
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
        let response: LLMResponse;

        // Route to appropriate handler based on robot type
        switch (activeRobotType) {
          case 'wheeled':
            response = await simulateWheeledResponse(message, wheeledRef.current);
            break;
          case 'drone':
            response = await simulateDroneResponse(message, droneRef.current);
            break;
          case 'humanoid':
            response = await simulateHumanoidResponse(message, humanoidRef.current);
            break;
          default:
            response = await simulateArmResponse(message, jointsRef.current);
        }

        if (response.action === 'error') {
          addMessage({
            role: 'assistant',
            content: response.description || 'I could not understand that command.',
            isError: true,
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
          if (activeRobotType === 'arm' && response.joints) {
            const sequence = Array.isArray(response.joints)
              ? response.joints
              : [response.joints];
            await executeArmSequence(sequence);
          } else if (activeRobotType === 'wheeled' && response.wheeledAction) {
            await executeWheeledAction(response.wheeledAction, response.duration);
          } else if (activeRobotType === 'drone' && response.droneAction) {
            await executeDroneAction(response.droneAction, response.duration);
          } else if (activeRobotType === 'humanoid' && response.humanoidAction) {
            await executeHumanoidAction(response.humanoidAction, response.duration);
          }
        }
      } catch (error) {
        addMessage({
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isError: true,
        });
      } finally {
        setLLMLoading(false);
      }
    },
    [addMessage, setLLMLoading, executeArmSequence, executeWheeledAction, executeDroneAction, executeHumanoidAction, setCode, activeRobotType]
  );

  return { sendMessage };
};

// Parse movement amount from message (e.g., "30 degrees", "a lot", "slightly")
function parseAmount(message: string): number {
  const degreeMatch = message.match(/(\d+)\s*(degrees?|deg|°)/i);
  if (degreeMatch) return parseInt(degreeMatch[1]);

  if (message.includes('little') || message.includes('slight') || message.includes('bit')) return 15;
  if (message.includes('lot') || message.includes('much') || message.includes('far')) return 60;
  if (message.includes('all the way') || message.includes('fully') || message.includes('max')) return 90;

  return 30; // default movement amount
}

// Arm responses - now handles arbitrary natural language commands
async function simulateArmResponse(
  message: string,
  currentJoints: JointState
): Promise<LLMResponse> {
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 300));
  const lowerMessage = message.toLowerCase();
  const amount = parseAmount(lowerMessage);

  // === DIRECTIONAL COMMANDS ===

  // Left/Right = Base rotation
  if (lowerMessage.includes('left') && !lowerMessage.includes('elbow')) {
    const targetBase = Math.min(currentJoints.base + amount, 135);
    return {
      action: 'move',
      joints: { base: targetBase },
      description: `Rotating base left by ${amount}° to ${targetBase.toFixed(0)}°.`,
      code: `setBase(${targetBase.toFixed(0)}); // Rotate left`,
    };
  }

  if (lowerMessage.includes('right') && !lowerMessage.includes('elbow')) {
    const targetBase = Math.max(currentJoints.base - amount, -135);
    return {
      action: 'move',
      joints: { base: targetBase },
      description: `Rotating base right by ${amount}° to ${targetBase.toFixed(0)}°.`,
      code: `setBase(${targetBase.toFixed(0)}); // Rotate right`,
    };
  }

  // Up/Down = Shoulder movement
  if (lowerMessage.includes('up') || lowerMessage.includes('raise') || lowerMessage.includes('lift')) {
    const targetShoulder = Math.min(currentJoints.shoulder + amount, 90);
    return {
      action: 'move',
      joints: { shoulder: targetShoulder },
      description: `Raising shoulder up by ${amount}° to ${targetShoulder.toFixed(0)}°.`,
      code: `setShoulder(${targetShoulder.toFixed(0)}); // Move up`,
    };
  }

  if (lowerMessage.includes('down') || lowerMessage.includes('lower')) {
    const targetShoulder = Math.max(currentJoints.shoulder - amount, -90);
    return {
      action: 'move',
      joints: { shoulder: targetShoulder },
      description: `Lowering shoulder down by ${amount}° to ${targetShoulder.toFixed(0)}°.`,
      code: `setShoulder(${targetShoulder.toFixed(0)}); // Move down`,
    };
  }

  // Forward/Back = Elbow extension/retraction
  if (lowerMessage.includes('forward') || lowerMessage.includes('extend') || lowerMessage.includes('out') || lowerMessage.includes('reach')) {
    const targetElbow = Math.max(currentJoints.elbow - amount, -135);
    return {
      action: 'move',
      joints: { elbow: targetElbow, shoulder: Math.min(currentJoints.shoulder + 10, 90) },
      description: `Extending arm forward. Elbow to ${targetElbow.toFixed(0)}°.`,
      code: `setElbow(${targetElbow.toFixed(0)}); // Extend forward`,
    };
  }

  if (lowerMessage.includes('back') || lowerMessage.includes('retract') || lowerMessage.includes('in')) {
    const targetElbow = Math.min(currentJoints.elbow + amount, 45);
    return {
      action: 'move',
      joints: { elbow: targetElbow },
      description: `Retracting arm back. Elbow to ${targetElbow.toFixed(0)}°.`,
      code: `setElbow(${targetElbow.toFixed(0)}); // Retract back`,
    };
  }

  // === JOINT-SPECIFIC COMMANDS ===

  // Base rotation
  if (lowerMessage.includes('base') || lowerMessage.includes('rotate') || lowerMessage.includes('turn') || lowerMessage.includes('spin')) {
    let targetBase = currentJoints.base;
    if (lowerMessage.includes('clock')) targetBase = currentJoints.base - amount;
    else if (lowerMessage.includes('counter')) targetBase = currentJoints.base + amount;
    else targetBase = currentJoints.base + (Math.random() > 0.5 ? amount : -amount);
    targetBase = Math.max(-135, Math.min(135, targetBase));
    return {
      action: 'move',
      joints: { base: targetBase },
      description: `Rotating base to ${targetBase.toFixed(0)}°.`,
      code: `setBase(${targetBase.toFixed(0)});`,
    };
  }

  // Shoulder
  if (lowerMessage.includes('shoulder')) {
    let targetShoulder = currentJoints.shoulder;
    if (lowerMessage.includes('up')) targetShoulder = Math.min(currentJoints.shoulder + amount, 90);
    else if (lowerMessage.includes('down')) targetShoulder = Math.max(currentJoints.shoulder - amount, -90);
    else targetShoulder = amount; // absolute position
    return {
      action: 'move',
      joints: { shoulder: targetShoulder },
      description: `Moving shoulder to ${targetShoulder.toFixed(0)}°.`,
      code: `setShoulder(${targetShoulder.toFixed(0)});`,
    };
  }

  // Elbow
  if (lowerMessage.includes('elbow')) {
    let targetElbow = currentJoints.elbow;
    if (lowerMessage.includes('bend') || lowerMessage.includes('fold')) {
      targetElbow = Math.min(currentJoints.elbow + amount, 45);
    } else if (lowerMessage.includes('straight') || lowerMessage.includes('extend')) {
      targetElbow = Math.max(currentJoints.elbow - amount, -135);
    } else {
      targetElbow = -amount; // negative for extension
    }
    return {
      action: 'move',
      joints: { elbow: targetElbow },
      description: `Moving elbow to ${targetElbow.toFixed(0)}°.`,
      code: `setElbow(${targetElbow.toFixed(0)});`,
    };
  }

  // Wrist
  if (lowerMessage.includes('wrist') || lowerMessage.includes('tilt')) {
    let targetWrist = currentJoints.wrist;
    if (lowerMessage.includes('up')) targetWrist = Math.min(currentJoints.wrist + amount, 90);
    else if (lowerMessage.includes('down')) targetWrist = Math.max(currentJoints.wrist - amount, -90);
    else targetWrist = 0;
    return {
      action: 'move',
      joints: { wrist: targetWrist },
      description: `Tilting wrist to ${targetWrist.toFixed(0)}°.`,
      code: `setWrist(${targetWrist.toFixed(0)});`,
    };
  }

  // === GRIPPER COMMANDS ===

  if (lowerMessage.includes('open') || lowerMessage.includes('release')) {
    return {
      action: 'move',
      joints: { gripper: 100 },
      description: 'Opening the gripper fully.',
      code: `openGripper();`,
    };
  }

  if (lowerMessage.includes('close') || lowerMessage.includes('grip') || lowerMessage.includes('grab') || lowerMessage.includes('clamp')) {
    return {
      action: 'move',
      joints: { gripper: 0 },
      description: 'Closing the gripper.',
      code: `closeGripper();`,
    };
  }

  // === PRESET ACTIONS ===

  if (lowerMessage.includes('wave') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return {
      action: 'sequence',
      joints: [
        { shoulder: 50, elbow: -60, wrist: 0 },
        { wrist: 45 },
        { wrist: -45 },
        { wrist: 45 },
        { wrist: -45 },
        { wrist: 0 },
      ],
      description: "Waving hello! Raising arm and moving wrist back and forth.",
      code: `// Wave Hello
void waveHello() {
  setShoulder(50);
  setElbow(-60);
  delay(500);
  for (int i = 0; i < 2; i++) {
    setWrist(45);
    delay(300);
    setWrist(-45);
    delay(300);
  }
  setWrist(0);
}`,
    };
  }

  if (lowerMessage.includes('pick') || (lowerMessage.includes('grab') && lowerMessage.includes('object'))) {
    return {
      action: 'sequence',
      joints: [
        { gripper: 100 },
        { shoulder: -25, elbow: -110 },
        { gripper: 0 },
        { shoulder: 20, elbow: -30 },
      ],
      description: "Executing pick up motion. Opening gripper, lowering arm, closing gripper, then lifting.",
      code: `// Pick Up Object
void pickUp() {
  openGripper();
  delay(300);
  setShoulder(-25);
  setElbow(-110);
  delay(500);
  closeGripper();
  delay(300);
  setShoulder(20);
  setElbow(-30);
}`,
    };
  }

  if (lowerMessage.includes('scan') || lowerMessage.includes('look around') || lowerMessage.includes('search')) {
    return {
      action: 'sequence',
      joints: [{ base: -70 }, { base: 70 }, { base: 0 }],
      description: "Scanning the area by rotating the base left, then right, then returning to center.",
      code: `// Scan Area
void scanArea() {
  setBase(-70);
  delay(800);
  setBase(70);
  delay(800);
  setBase(0);
}`,
    };
  }

  if (lowerMessage.includes('home') || lowerMessage.includes('reset') || lowerMessage.includes('center') || lowerMessage.includes('zero')) {
    return {
      action: 'move',
      joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, gripper: 50 },
      description: 'Moving to home position with all joints centered.',
      code: `// Go Home
void goHome() {
  setBase(0);
  setShoulder(0);
  setElbow(0);
  setWrist(0);
  setGripper(50);
}`,
    };
  }

  if (lowerMessage.includes('point') || lowerMessage.includes('aim')) {
    return {
      action: 'move',
      joints: { shoulder: 20, elbow: -90, wrist: 0, gripper: 0 },
      description: 'Pointing forward with the arm extended.',
      code: `// Point Forward
void point() {
  setShoulder(20);
  setElbow(-90);
  setWrist(0);
  closeGripper();
}`,
    };
  }

  if (lowerMessage.includes('nod') || lowerMessage.includes('yes')) {
    return {
      action: 'sequence',
      joints: [
        { wrist: 30 },
        { wrist: -30 },
        { wrist: 30 },
        { wrist: -30 },
        { wrist: 0 },
      ],
      description: 'Nodding the wrist up and down.',
      code: `// Nod
void nod() {
  for (int i = 0; i < 2; i++) {
    setWrist(30);
    delay(300);
    setWrist(-30);
    delay(300);
  }
  setWrist(0);
}`,
    };
  }

  if (lowerMessage.includes('shake') || lowerMessage.includes('no')) {
    return {
      action: 'sequence',
      joints: [
        { base: currentJoints.base - 20 },
        { base: currentJoints.base + 20 },
        { base: currentJoints.base - 20 },
        { base: currentJoints.base + 20 },
        { base: currentJoints.base },
      ],
      description: 'Shaking the base left and right.',
      code: `// Shake No
void shakeNo() {
  int startBase = getBase();
  for (int i = 0; i < 2; i++) {
    setBase(startBase - 20);
    delay(250);
    setBase(startBase + 20);
    delay(250);
  }
  setBase(startBase);
}`,
    };
  }

  if (lowerMessage.includes('flex') || lowerMessage.includes('show off') || lowerMessage.includes('strong')) {
    return {
      action: 'sequence',
      joints: [
        { shoulder: 45, elbow: -100, gripper: 0 },
        { elbow: -30 },
        { elbow: -100 },
        { elbow: -30 },
      ],
      description: 'Flexing the arm!',
      code: `// Flex
void flex() {
  setShoulder(45);
  setElbow(-100);
  closeGripper();
  for (int i = 0; i < 2; i++) {
    setElbow(-30);
    delay(400);
    setElbow(-100);
    delay(400);
  }
}`,
    };
  }

  // === NUMERIC/SPECIFIC VALUE COMMANDS ===

  // Handle "set base to 45" or "move to 30 degrees"
  const numberMatch = lowerMessage.match(/(-?\d+)/);
  if (numberMatch) {
    const value = parseInt(numberMatch[1]);
    // Determine which joint based on context
    if (lowerMessage.includes('base')) {
      return {
        action: 'move',
        joints: { base: Math.max(-135, Math.min(135, value)) },
        description: `Setting base to ${value}°.`,
        code: `setBase(${value});`,
      };
    }
    if (lowerMessage.includes('shoulder')) {
      return {
        action: 'move',
        joints: { shoulder: Math.max(-90, Math.min(90, value)) },
        description: `Setting shoulder to ${value}°.`,
        code: `setShoulder(${value});`,
      };
    }
    if (lowerMessage.includes('elbow')) {
      return {
        action: 'move',
        joints: { elbow: Math.max(-135, Math.min(45, value)) },
        description: `Setting elbow to ${value}°.`,
        code: `setElbow(${value});`,
      };
    }
    if (lowerMessage.includes('wrist')) {
      return {
        action: 'move',
        joints: { wrist: Math.max(-90, Math.min(90, value)) },
        description: `Setting wrist to ${value}°.`,
        code: `setWrist(${value});`,
      };
    }
    if (lowerMessage.includes('gripper')) {
      return {
        action: 'move',
        joints: { gripper: Math.max(0, Math.min(100, value)) },
        description: `Setting gripper to ${value}%.`,
        code: `setGripper(${value});`,
      };
    }
  }

  // === CATCH-ALL: Try to interpret any movement intent ===

  // If the message seems to want movement, try to interpret it
  if (lowerMessage.includes('move') || lowerMessage.includes('go') || lowerMessage.includes('make')) {
    // Default to some movement based on current state
    return {
      action: 'move',
      joints: {
        base: currentJoints.base + (Math.random() > 0.5 ? 20 : -20),
        shoulder: Math.min(currentJoints.shoulder + 15, 60)
      },
      description: `Moving the arm. Current position: Base ${currentJoints.base.toFixed(0)}°, Shoulder ${currentJoints.shoulder.toFixed(0)}°, Elbow ${currentJoints.elbow.toFixed(0)}°. Try "left", "right", "up", "down", "forward", "back" for specific directions.`,
      code: `// Movement
setBase(${(currentJoints.base + 20).toFixed(0)});
setShoulder(${Math.min(currentJoints.shoulder + 15, 60).toFixed(0)});`,
    };
  }

  // Provide helpful feedback for unrecognized commands
  return {
    action: 'move',
    joints: {},
    description: `I can help you control the arm! Try these commands:
• **Directions**: "go left", "move right", "raise up", "lower down", "extend forward", "pull back"
• **Joints**: "rotate base", "shoulder up", "bend elbow", "tilt wrist"
• **Gripper**: "open gripper", "close gripper", "grab", "release"
• **Presets**: "wave hello", "pick up", "scan area", "go home", "point"
• **Specific**: "set base to 45", "shoulder 30 degrees"

Current position: Base ${currentJoints.base.toFixed(0)}°, Shoulder ${currentJoints.shoulder.toFixed(0)}°, Elbow ${currentJoints.elbow.toFixed(0)}°, Wrist ${currentJoints.wrist.toFixed(0)}°`,
  };
}

// Wheeled robot responses
async function simulateWheeledResponse(
  message: string,
  currentState: WheeledRobotState
): Promise<LLMResponse> {
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
  const lowerMessage = message.toLowerCase();
  const stateSummary = `Current heading ${currentState.heading.toFixed(0)}°, wheel speeds L${currentState.leftWheelSpeed} R${currentState.rightWheelSpeed}.`;

  if (lowerMessage.includes('forward') || lowerMessage.includes('drive')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 150, rightWheelSpeed: 150 },
      duration: 2000,
      description: "Driving forward at moderate speed.",
      code: `// Drive Forward
void driveForward() {
  setMotors(150, 150);
  delay(2000);
  stopMotors();
}`,
    };
  }

  if (lowerMessage.includes('backward') || lowerMessage.includes('reverse')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: -150, rightWheelSpeed: -150 },
      duration: 2000,
      description: "Reversing at moderate speed.",
      code: `// Drive Backward
void driveBackward() {
  setMotors(-150, -150);
  delay(2000);
  stopMotors();
}`,
    };
  }

  if (lowerMessage.includes('turn around') || lowerMessage.includes('180')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 150, rightWheelSpeed: -150 },
      duration: 1500,
      description: "Turning around 180 degrees by spinning in place.",
      code: `// Turn Around
void turnAround() {
  setMotors(150, -150);
  delay(1500);
  stopMotors();
}`,
    };
  }

  if (lowerMessage.includes('turn left') || lowerMessage.includes('left')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: -100, rightWheelSpeed: 100 },
      duration: 800,
      description: "Turning left 90 degrees.",
      code: `// Turn Left
void turnLeft() {
  setMotors(-100, 100);
  delay(800);
  stopMotors();
}`,
    };
  }

  if (lowerMessage.includes('turn right') || lowerMessage.includes('right')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 100, rightWheelSpeed: -100 },
      duration: 800,
      description: "Turning right 90 degrees.",
      code: `// Turn Right
void turnRight() {
  setMotors(100, -100);
  delay(800);
  stopMotors();
}`,
    };
  }

  if (lowerMessage.includes('spin') || lowerMessage.includes('circle')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 200, rightWheelSpeed: -200 },
      duration: 3000,
      description: "Spinning in a full circle!",
      code: `// Spin in Circle
void spinCircle() {
  setMotors(200, -200);
  delay(3000);
  stopMotors();
}`,
    };
  }

  if (lowerMessage.includes('stop')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 0, rightWheelSpeed: 0 },
      duration: 100,
      description: "Stopping all motors.",
      code: `stopMotors();`,
    };
  }

  if (lowerMessage.includes('follow line') || lowerMessage.includes('line')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 100, rightWheelSpeed: 100 },
      duration: 2000,
      description: "Starting line following mode. The robot will use IR sensors to follow a line.",
      code: `// Line Following
void followLine() {
  while (true) {
    bool left = readIR(LEFT);
    bool center = readIR(CENTER);
    bool right = readIR(RIGHT);

    if (center) {
      setMotors(100, 100);
    } else if (left) {
      setMotors(50, 100);
    } else if (right) {
      setMotors(100, 50);
    } else {
      stopMotors();
      break;
    }
    delay(10);
  }
}`,
    };
  }

  if (lowerMessage.includes('avoid') || lowerMessage.includes('obstacle')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 100, rightWheelSpeed: 100, servoHead: 0 },
      duration: 2000,
      description: "Starting obstacle avoidance mode. Using ultrasonic to detect and avoid obstacles.",
      code: `// Obstacle Avoidance
void avoidObstacles() {
  int dist = readUltrasonic();

  if (dist < 30) {
    stopMotors();
    delay(200);

    setServo(90);
    delay(300);
    int leftDist = readUltrasonic();

    setServo(-90);
    delay(300);
    int rightDist = readUltrasonic();

    setServo(0);

    if (leftDist > rightDist) {
      turnLeft();
    } else {
      turnRight();
    }
  } else {
    setMotors(100, 100);
  }
}`,
    };
  }

  return {
    action: 'error',
    description: `I'm not sure how to "${message}". Try commands like "drive forward", "turn around", "follow line", "avoid obstacles", or "stop". ${stateSummary}`,
  };
}

// Drone responses
async function simulateDroneResponse(
  message: string,
  currentState: DroneState
): Promise<LLMResponse> {
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('take off') || lowerMessage.includes('takeoff')) {
    return {
      action: 'move',
      droneAction: { armed: true, throttle: 60, flightMode: 'altitude_hold', position: { x: 0, y: 0.5, z: 0 } },
      duration: 2000,
      description: "Taking off! Arming motors and ascending to 50cm altitude.",
      code: `// Takeoff
void takeoff() {
  arm();
  setFlightMode(ALTITUDE_HOLD);
  setThrottle(60);
  delay(2000);
  setThrottle(50);
}`,
    };
  }

  if (lowerMessage.includes('land')) {
    return {
      action: 'move',
      droneAction: { throttle: 20, flightMode: 'land', position: { x: currentState.position.x, y: 0.05, z: currentState.position.z } },
      duration: 3000,
      description: "Landing safely. Reducing throttle and descending.",
      code: `// Land
void land() {
  setFlightMode(LAND);
  while (getAltitude() > 0.05) {
    delay(100);
  }
  disarm();
}`,
    };
  }

  if (lowerMessage.includes('hover')) {
    return {
      action: 'move',
      droneAction: { throttle: 50, flightMode: 'position_hold', rotation: { x: 0, y: currentState.rotation.y, z: 0 } },
      duration: 1000,
      description: "Hovering in place with position hold enabled.",
      code: `// Hover
void hover() {
  setFlightMode(POSITION_HOLD);
  setThrottle(50);
  setRoll(0);
  setPitch(0);
}`,
    };
  }

  if (lowerMessage.includes('fly forward') || lowerMessage.includes('forward')) {
    return {
      action: 'move',
      droneAction: { rotation: { x: 0, y: currentState.rotation.y, z: -15 } },
      duration: 1500,
      description: "Flying forward by pitching the drone.",
      code: `// Fly Forward
void flyForward() {
  setPitch(-15);
  delay(1500);
  setPitch(0);
}`,
    };
  }

  if (lowerMessage.includes('fly backward') || lowerMessage.includes('backward')) {
    return {
      action: 'move',
      droneAction: { rotation: { x: 0, y: currentState.rotation.y, z: 15 } },
      duration: 1500,
      description: "Flying backward by pitching up.",
      code: `// Fly Backward
void flyBackward() {
  setPitch(15);
  delay(1500);
  setPitch(0);
}`,
    };
  }

  if (lowerMessage.includes('left')) {
    return {
      action: 'move',
      droneAction: { rotation: { x: -15, y: currentState.rotation.y, z: 0 } },
      duration: 1500,
      description: "Flying left by rolling.",
      code: `// Fly Left
void flyLeft() {
  setRoll(-15);
  delay(1500);
  setRoll(0);
}`,
    };
  }

  if (lowerMessage.includes('right')) {
    return {
      action: 'move',
      droneAction: { rotation: { x: 15, y: currentState.rotation.y, z: 0 } },
      duration: 1500,
      description: "Flying right by rolling.",
      code: `// Fly Right
void flyRight() {
  setRoll(15);
  delay(1500);
  setRoll(0);
}`,
    };
  }

  if (lowerMessage.includes('rotate') || lowerMessage.includes('360') || lowerMessage.includes('yaw')) {
    return {
      action: 'move',
      droneAction: { rotation: { x: 0, y: (currentState.rotation.y + 180) % 360, z: 0 } },
      duration: 2000,
      description: "Rotating 180 degrees using yaw control.",
      code: `// Rotate 360
void rotate360() {
  for (int i = 0; i < 4; i++) {
    setYaw(currentYaw + 90);
    delay(500);
  }
}`,
    };
  }

  if (lowerMessage.includes('flip')) {
    return {
      action: 'sequence',
      droneAction: { rotation: { x: 0, y: currentState.rotation.y, z: 0 } },
      duration: 500,
      description: "Performing a flip! (Simulated - real flips require special hardware)",
      code: `// Flip (requires acro mode)
void doFlip() {
  setFlightMode(ACRO);
  setRoll(360);
  delay(500);
  setFlightMode(STABILIZE);
}`,
    };
  }

  if (lowerMessage.includes('up') || lowerMessage.includes('ascend') || lowerMessage.includes('higher')) {
    return {
      action: 'move',
      droneAction: { throttle: Math.min(currentState.throttle + 20, 100) },
      duration: 1000,
      description: "Ascending by increasing throttle.",
      code: `// Ascend
void ascend() {
  setThrottle(getThrottle() + 20);
  delay(1000);
}`,
    };
  }

  if (lowerMessage.includes('down') || lowerMessage.includes('descend') || lowerMessage.includes('lower')) {
    return {
      action: 'move',
      droneAction: { throttle: Math.max(currentState.throttle - 20, 0) },
      duration: 1000,
      description: "Descending by reducing throttle.",
      code: `// Descend
void descend() {
  setThrottle(getThrottle() - 20);
  delay(1000);
}`,
    };
  }

  return {
    action: 'error',
    description: `I'm not sure how to "${message}". Try commands like "take off", "land", "hover", "fly forward", "rotate 360", or "do a flip".`,
  };
}

// Humanoid robot responses
async function simulateHumanoidResponse(
  message: string,
  currentState: HumanoidState
): Promise<LLMResponse> {
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 500));
  const lowerMessage = message.toLowerCase();
  const balanceSummary = `Current balance: roll ${currentState.balance.x.toFixed(1)}°, pitch ${currentState.balance.z.toFixed(1)}°.`;

  if (lowerMessage.includes('wave') || lowerMessage.includes('hello')) {
    return {
      action: 'move',
      humanoidAction: {
        rightShoulderPitch: -90,
        rightShoulderRoll: 30,
        rightElbow: 45,
      },
      duration: 2000,
      description: "Waving hello with the right arm!",
      code: `// Wave Hello
void waveHello() {
  setRightShoulderPitch(-90);
  setRightShoulderRoll(30);
  setRightElbow(45);
  delay(500);
  for (int i = 0; i < 3; i++) {
    setRightWrist(30);
    delay(300);
    setRightWrist(-30);
    delay(300);
  }
  resetArms();
}`,
    };
  }

  if (lowerMessage.includes('walk') || lowerMessage.includes('forward')) {
    return {
      action: 'move',
      humanoidAction: {
        isWalking: true,
        walkPhase: 0,
      },
      duration: 3000,
      description: "Walking forward. The humanoid alternates leg movements for bipedal locomotion.",
      code: `// Walk Forward
void walkForward(int steps) {
  for (int i = 0; i < steps; i++) {
    // Shift weight to left leg
    shiftBalance(-0.05, 0);

    // Swing right leg forward
    setRightHipPitch(20);
    setRightKnee(-30);
    delay(200);

    // Plant right foot
    setRightHipPitch(0);
    setRightKnee(0);

    // Shift weight to right leg
    shiftBalance(0.05, 0);

    // Swing left leg forward
    setLeftHipPitch(20);
    setLeftKnee(-30);
    delay(200);

    // Plant left foot
    setLeftHipPitch(0);
    setLeftKnee(0);
  }
}`,
    };
  }

  if (lowerMessage.includes('squat')) {
    return {
      action: 'move',
      humanoidAction: {
        leftKnee: -60,
        rightKnee: -60,
        leftHipPitch: -30,
        rightHipPitch: -30,
      },
      duration: 1500,
      description: "Performing a squat by bending both knees.",
      code: `// Squat
void squat() {
  setLeftKnee(-60);
  setRightKnee(-60);
  setLeftHipPitch(-30);
  setRightHipPitch(-30);
  delay(1000);

  // Return to standing
  setLeftKnee(0);
  setRightKnee(0);
  setLeftHipPitch(0);
  setRightHipPitch(0);
}`,
    };
  }

  if (lowerMessage.includes('raise') && lowerMessage.includes('arm')) {
    return {
      action: 'move',
      humanoidAction: {
        leftShoulderPitch: -90,
        rightShoulderPitch: -90,
        leftElbow: 0,
        rightElbow: 0,
      },
      duration: 1500,
      description: "Raising both arms above the head.",
      code: `// Raise Arms
void raiseArms() {
  setLeftShoulderPitch(-90);
  setRightShoulderPitch(-90);
  setLeftElbow(0);
  setRightElbow(0);
}`,
    };
  }

  if (lowerMessage.includes('one leg') || lowerMessage.includes('balance')) {
    return {
      action: 'move',
      humanoidAction: {
        leftHipRoll: 10,
        leftKnee: -30,
        rightHipPitch: 45,
        rightKnee: -60,
        balance: { x: -0.05, z: 0 },
      },
      duration: 2000,
      description: "Standing on one leg. Shifting balance to the left foot and lifting the right leg.",
      code: `// Stand on One Leg
void standOnOneLeg() {
  // Shift balance to left leg
  shiftBalance(-0.05, 0);
  delay(300);

  // Lift right leg
  setRightHipPitch(45);
  setRightKnee(-60);

  // Use arms for balance
  setLeftShoulderRoll(-20);
  setRightShoulderRoll(20);
}`,
    };
  }

  if (lowerMessage.includes('reset') || lowerMessage.includes('home') || lowerMessage.includes('stand')) {
    return {
      action: 'move',
      humanoidAction: {
        leftHipPitch: 0, leftHipRoll: 0, leftHipYaw: 0,
        leftKnee: 0, leftAnklePitch: 0, leftAnkleRoll: 0,
        rightHipPitch: 0, rightHipRoll: 0, rightHipYaw: 0,
        rightKnee: 0, rightAnklePitch: 0, rightAnkleRoll: 0,
        leftShoulderPitch: 0, leftShoulderRoll: 0, leftShoulderYaw: 0,
        leftElbow: 0, leftWrist: 0,
        rightShoulderPitch: 0, rightShoulderRoll: 0, rightShoulderYaw: 0,
        rightElbow: 0, rightWrist: 0,
        isWalking: false, walkPhase: 0, balance: { x: 0, z: 0 },
      },
      duration: 1000,
      description: "Resetting to neutral standing pose with all joints centered.",
      code: `// Reset Pose
void resetPose() {
  resetLegs();
  resetArms();
  setBalance(0, 0);
  stopWalking();
}`,
    };
  }

  if (lowerMessage.includes('bow') || lowerMessage.includes('nod')) {
    return {
      action: 'move',
      humanoidAction: {
        leftHipPitch: 30,
        rightHipPitch: 30,
      },
      duration: 1500,
      description: "Bowing forward from the hips.",
      code: `// Bow
void bow() {
  setLeftHipPitch(30);
  setRightHipPitch(30);
  delay(1000);
  setLeftHipPitch(0);
  setRightHipPitch(0);
}`,
    };
  }

  return {
    action: 'error',
    description: `I'm not sure how to "${message}". Try commands like "wave hello", "walk forward", "do a squat", "raise arms", "stand on one leg", or "reset pose". ${balanceSummary}`,
  };
}
