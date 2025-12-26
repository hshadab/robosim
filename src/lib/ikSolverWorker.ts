/**
 * IK Solver Web Worker
 *
 * Offloads heavy Inverse Kinematics calculations from main thread to prevent UI freezes.
 * The IK solver uses gradient descent with ~300,000+ FK calculations per solve,
 * which takes 500ms-2s and would block the UI if run on main thread.
 */

// Worker message types
export interface SolveIKMessage {
  type: 'solveIK';
  id: number;
  targetPos: [number, number, number];
  maxIter?: number;
  fixedBaseAngle?: number;
  preferHorizontalGrasp?: boolean;
}

export interface IKResult {
  type: 'result';
  id: number;
  joints: JointAngles;
  error: number;
}

export interface IKWorkerError {
  type: 'error';
  id: number;
  error: string;
}

export type IKWorkerMessage = SolveIKMessage;
export type IKWorkerResponse = IKResult | IKWorkerError;

interface JointAngles {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
}

// The actual worker code (inlined as blob URL)
const workerCode = `
// URDF joint origins (in meters) - from SO101KinematicsURDF.ts
const URDF_JOINTS = {
  shoulder_pan: {
    xyz: [0.0388353, 0, 0.0624],
    rpy: [Math.PI, 0, -Math.PI],
  },
  shoulder_lift: {
    xyz: [-0.0303992, -0.0182778, -0.0542],
    rpy: [-Math.PI/2, -Math.PI/2, 0],
  },
  elbow_flex: {
    xyz: [-0.11257, -0.028, 0],
    rpy: [0, 0, Math.PI/2],
  },
  wrist_flex: {
    xyz: [-0.1349, 0.0052, 0],
    rpy: [0, 0, -Math.PI/2],
  },
  wrist_roll: {
    xyz: [0, -0.0611, 0.0181],
    rpy: [Math.PI/2, 0.0486795, Math.PI],
  },
  gripper_frame: {
    xyz: [-0.0079, -0.000218121, -0.0981274],
    rpy: [0, Math.PI, 0],
  },
};

const JAW_CENTER_OFFSET_FROM_FRAME = [0.0079, 0, -0.0068];

// Joint limits for SO-101
const JOINT_LIMITS = {
  base: { min: -110, max: 110 },
  shoulder: { min: -100, max: 100 },
  elbow: { min: -97, max: 97 },
  wrist: { min: -95, max: 95 },
  wristRoll: { min: -157, max: 163 },
};

function clampJoint(jointName, value) {
  const limits = JOINT_LIMITS[jointName];
  return Math.max(limits.min, Math.min(limits.max, value));
}

// Matrix utilities
function createIdentityMatrix() {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function createTranslationMatrix(x, y, z) {
  return [
    [1, 0, 0, x],
    [0, 1, 0, y],
    [0, 0, 1, z],
    [0, 0, 0, 1],
  ];
}

function createRotationMatrixX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [1, 0, 0, 0],
    [0, c, -s, 0],
    [0, s, c, 0],
    [0, 0, 0, 1],
  ];
}

function createRotationMatrixY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, 0, s, 0],
    [0, 1, 0, 0],
    [-s, 0, c, 0],
    [0, 0, 0, 1],
  ];
}

function createRotationMatrixZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0, 0],
    [s, c, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function createRPYMatrix(roll, pitch, yaw) {
  const Rz = createRotationMatrixZ(yaw);
  const Ry = createRotationMatrixY(pitch);
  const Rx = createRotationMatrixX(roll);
  return multiplyMatrices(multiplyMatrices(Rz, Ry), Rx);
}

function multiplyMatrices(a, b) {
  const result = createIdentityMatrix();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] = 0;
      for (let k = 0; k < 4; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function getTranslation(matrix) {
  return [matrix[0][3], matrix[1][3], matrix[2][3]];
}

function createJointTransform(xyz, rpy, jointAngle = 0, axis = 'z') {
  const T = createTranslationMatrix(xyz[0], xyz[1], xyz[2]);
  const R = createRPYMatrix(rpy[0], rpy[1], rpy[2]);
  const origin = multiplyMatrices(T, R);

  let jointRot;
  switch (axis) {
    case 'x': jointRot = createRotationMatrixX(jointAngle); break;
    case 'y': jointRot = createRotationMatrixY(jointAngle); break;
    case 'z': jointRot = createRotationMatrixZ(jointAngle); break;
  }

  return multiplyMatrices(origin, jointRot);
}

// Forward Kinematics - calculate jaw position from joint angles
function calculateJawPosition(joints) {
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;
  const wristRollRad = (joints.wristRoll * Math.PI) / 180;

  const T1 = createJointTransform(URDF_JOINTS.shoulder_pan.xyz, URDF_JOINTS.shoulder_pan.rpy, baseRad, 'z');
  const T2 = createJointTransform(URDF_JOINTS.shoulder_lift.xyz, URDF_JOINTS.shoulder_lift.rpy, shoulderRad, 'z');
  const T3 = createJointTransform(URDF_JOINTS.elbow_flex.xyz, URDF_JOINTS.elbow_flex.rpy, elbowRad, 'z');
  const T4 = createJointTransform(URDF_JOINTS.wrist_flex.xyz, URDF_JOINTS.wrist_flex.rpy, wristRad, 'z');
  const T5 = createJointTransform(URDF_JOINTS.wrist_roll.xyz, URDF_JOINTS.wrist_roll.rpy, wristRollRad, 'z');

  const gripperFrameXYZ = [
    URDF_JOINTS.gripper_frame.xyz[0] + JAW_CENTER_OFFSET_FROM_FRAME[0],
    URDF_JOINTS.gripper_frame.xyz[1] + JAW_CENTER_OFFSET_FROM_FRAME[1],
    URDF_JOINTS.gripper_frame.xyz[2] + JAW_CENTER_OFFSET_FROM_FRAME[2],
  ];
  const T6 = createJointTransform(gripperFrameXYZ, URDF_JOINTS.gripper_frame.rpy, 0, 'z');

  let T = T1;
  T = multiplyMatrices(T, T2);
  T = multiplyMatrices(T, T3);
  T = multiplyMatrices(T, T4);
  T = multiplyMatrices(T, T5);
  T = multiplyMatrices(T, T6);

  const posURDF = getTranslation(T);
  return [posURDF[0], posURDF[2], -posURDF[1]]; // URDF to Three.js conversion
}

// IK Solver using gradient descent with multiple starting configurations
function solveIKForTarget(targetPos, maxIter = 1000, fixedBaseAngle, preferHorizontalGrasp = false) {
  let bestJoints = { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 };
  let bestError = Infinity;

  const nominalBaseAngle = fixedBaseAngle !== undefined
    ? clampJoint('base', fixedBaseAngle)
    : clampJoint('base', Math.atan2(targetPos[2], targetPos[0]) * (180 / Math.PI));

  const baseAnglesToTry = fixedBaseAngle !== undefined
    ? [nominalBaseAngle]
    : [
        nominalBaseAngle,
        nominalBaseAngle + 3, nominalBaseAngle - 3,
        nominalBaseAngle + 6, nominalBaseAngle - 6,
        nominalBaseAngle + 9, nominalBaseAngle - 9,
        nominalBaseAngle + 12, nominalBaseAngle - 12,
      ].map(a => clampJoint('base', a));

  for (const baseAngle of baseAnglesToTry) {
    // Starting configurations optimized for SO-101
    const startConfigs = [
      // FAR WORKSPACE POSES - NEGATIVE wrist for low Y
      { base: baseAngle, shoulder: 19, elbow: 75, wrist: -77, wristRoll: 0 },
      { base: baseAngle, shoulder: 20, elbow: 73, wrist: -75, wristRoll: 0 },
      { base: baseAngle, shoulder: 15, elbow: 78, wrist: -80, wristRoll: 0 },
      { base: baseAngle, shoulder: 25, elbow: 70, wrist: -70, wristRoll: 0 },
      { base: baseAngle, shoulder: 30, elbow: 73, wrist: -90, wristRoll: 0 },
      { base: baseAngle, shoulder: 10, elbow: 80, wrist: -85, wristRoll: 0 },
      { base: baseAngle, shoulder: 35, elbow: 65, wrist: -65, wristRoll: 0 },
      { base: baseAngle, shoulder: 40, elbow: 60, wrist: -60, wristRoll: 0 },
      { base: baseAngle, shoulder: 55, elbow: 23, wrist: -80, wristRoll: 0 },
      { base: baseAngle, shoulder: 50, elbow: 30, wrist: -75, wristRoll: 0 },
      { base: baseAngle, shoulder: 5, elbow: 85, wrist: -90, wristRoll: 0 },
      { base: baseAngle, shoulder: 0, elbow: 88, wrist: -65, wristRoll: 0 },
      { base: baseAngle, shoulder: -5, elbow: 90, wrist: -85, wristRoll: 0 },
      { base: baseAngle, shoulder: 0, elbow: 28, wrist: 35, wristRoll: 0 },
      { base: baseAngle, shoulder: 10, elbow: 20, wrist: 45, wristRoll: 0 },
      // HORIZONTAL GRASP POSES - wrist near 0 for cylinders
      { base: baseAngle, shoulder: -50, elbow: 80, wrist: 10, wristRoll: 0 },
      { base: baseAngle, shoulder: -60, elbow: 80, wrist: 20, wristRoll: 0 },
      { base: baseAngle, shoulder: -50, elbow: 90, wrist: -10, wristRoll: 0 },
      { base: baseAngle, shoulder: -40, elbow: 70, wrist: 20, wristRoll: 0 },
      { base: baseAngle, shoulder: -60, elbow: 90, wrist: 0, wristRoll: 0 },
      { base: baseAngle, shoulder: -40, elbow: 90, wrist: -20, wristRoll: 0 },
      { base: baseAngle, shoulder: -70, elbow: 90, wrist: 10, wristRoll: 0 },
      { base: baseAngle, shoulder: -40, elbow: 80, wrist: 0, wristRoll: 0 },
      { base: baseAngle, shoulder: -30, elbow: 60, wrist: 20, wristRoll: 0 },
      { base: baseAngle, shoulder: -45, elbow: 85, wrist: 5, wristRoll: 0 },
      { base: baseAngle, shoulder: -55, elbow: 75, wrist: 15, wristRoll: 0 },
      // CLOSE RANGE POSES
      { base: baseAngle, shoulder: -99, elbow: 97, wrist: 75, wristRoll: 0 },
      { base: baseAngle, shoulder: -95, elbow: 95, wrist: 72, wristRoll: 0 },
      { base: baseAngle, shoulder: -90, elbow: 90, wrist: 70, wristRoll: 0 },
      { base: baseAngle, shoulder: -85, elbow: 85, wrist: 68, wristRoll: 0 },
      { base: baseAngle, shoulder: -80, elbow: 80, wrist: 65, wristRoll: 0 },
      { base: baseAngle, shoulder: -75, elbow: 75, wrist: 60, wristRoll: 0 },
      { base: baseAngle, shoulder: -70, elbow: 70, wrist: 55, wristRoll: 0 },
      { base: baseAngle, shoulder: -60, elbow: 60, wrist: 50, wristRoll: 0 },
      { base: baseAngle, shoulder: -50, elbow: 50, wrist: 40, wristRoll: 0 },
      { base: baseAngle, shoulder: -40, elbow: 40, wrist: 35, wristRoll: 0 },
      { base: baseAngle, shoulder: -30, elbow: 30, wrist: 30, wristRoll: 0 },
      { base: baseAngle, shoulder: -20, elbow: 20, wrist: 25, wristRoll: 0 },
    ];

    for (const startConfig of startConfigs) {
      let joints = { ...startConfig };

      const startPos = calculateJawPosition(joints);
      const startError = Math.sqrt(
        (startPos[0] - targetPos[0]) ** 2 +
        (startPos[1] - targetPos[1]) ** 2 +
        (startPos[2] - targetPos[2]) ** 2
      );

      if (startError < 0.02) {
        if (startError < bestError) {
          bestError = startError;
          bestJoints = { ...joints };
        }
        const fineSteps = [0.5, 0.25, 0.1, 0.05];
        for (const stepSize of fineSteps) {
          for (let iter = 0; iter < 20; iter++) {
            const pos = calculateJawPosition(joints);
            const error = Math.sqrt(
              (pos[0] - targetPos[0]) ** 2 +
              (pos[1] - targetPos[1]) ** 2 +
              (pos[2] - targetPos[2]) ** 2
            );
            if (error < bestError) {
              bestError = error;
              bestJoints = { ...joints };
            }
            if (error < 0.005) break;

            for (const jn of ['shoulder', 'elbow', 'wrist']) {
              const testPlus = { ...joints, [jn]: clampJoint(jn, joints[jn] + stepSize) };
              const testMinus = { ...joints, [jn]: clampJoint(jn, joints[jn] - stepSize) };
              const posPlus = calculateJawPosition(testPlus);
              const posMinus = calculateJawPosition(testMinus);
              const errPlus = Math.sqrt((posPlus[0]-targetPos[0])**2 + (posPlus[1]-targetPos[1])**2 + (posPlus[2]-targetPos[2])**2);
              const errMinus = Math.sqrt((posMinus[0]-targetPos[0])**2 + (posMinus[1]-targetPos[1])**2 + (posMinus[2]-targetPos[2])**2);
              if (errPlus < error && errPlus <= errMinus) joints[jn] = clampJoint(jn, joints[jn] + stepSize);
              else if (errMinus < error) joints[jn] = clampJoint(jn, joints[jn] - stepSize);
            }
          }
        }
        continue;
      }

      const stepSizes = [10.0, 5.0, 2.0, 1.0, 0.5, 0.25, 0.1, 0.05];
      for (const stepSize of stepSizes) {
        const iterations = stepSize < 0.2 ? 50 : 30;
        for (let iter = 0; iter < iterations; iter++) {
          const pos = calculateJawPosition(joints);
          const positionError = Math.sqrt(
            (pos[0] - targetPos[0]) ** 2 +
            (pos[1] - targetPos[1]) ** 2 +
            (pos[2] - targetPos[2]) ** 2
          );

          let wristPenalty = 0;
          if (preferHorizontalGrasp) {
            const wristAbs = Math.abs(joints.wrist);
            if (wristAbs > 20) {
              wristPenalty = (wristAbs - 20) * 0.01 + Math.pow((wristAbs - 20) / 10, 2) * 0.02;
            }
            if (wristAbs > 45) wristPenalty += 1.0;
          }
          const error = positionError + wristPenalty;

          if (error < bestError) {
            bestError = error;
            bestJoints = { ...joints };
          }

          if (positionError < 0.002) break;

          for (const jn of ['shoulder', 'elbow', 'wrist']) {
            const testPlus = { ...joints, [jn]: clampJoint(jn, joints[jn] + stepSize) };
            const testMinus = { ...joints, [jn]: clampJoint(jn, joints[jn] - stepSize) };

            const posPlus = calculateJawPosition(testPlus);
            const posMinus = calculateJawPosition(testMinus);

            const posErrorPlus = Math.sqrt(
              (posPlus[0] - targetPos[0]) ** 2 +
              (posPlus[1] - targetPos[1]) ** 2 +
              (posPlus[2] - targetPos[2]) ** 2
            );
            const posErrorMinus = Math.sqrt(
              (posMinus[0] - targetPos[0]) ** 2 +
              (posMinus[1] - targetPos[1]) ** 2 +
              (posMinus[2] - targetPos[2]) ** 2
            );

            let wristPenaltyPlus = 0;
            let wristPenaltyMinus = 0;
            if (preferHorizontalGrasp) {
              const wristAbsPlus = Math.abs(testPlus.wrist);
              const wristAbsMinus = Math.abs(testMinus.wrist);
              if (wristAbsPlus > 20) {
                wristPenaltyPlus = (wristAbsPlus - 20) * 0.01 + Math.pow((wristAbsPlus - 20) / 10, 2) * 0.02;
              }
              if (wristAbsPlus > 45) wristPenaltyPlus += 1.0;
              if (wristAbsMinus > 20) {
                wristPenaltyMinus = (wristAbsMinus - 20) * 0.01 + Math.pow((wristAbsMinus - 20) / 10, 2) * 0.02;
              }
              if (wristAbsMinus > 45) wristPenaltyMinus += 1.0;
            }
            const errorPlus = posErrorPlus + wristPenaltyPlus;
            const errorMinus = posErrorMinus + wristPenaltyMinus;

            if (errorPlus < error && errorPlus <= errorMinus) {
              joints[jn] = clampJoint(jn, joints[jn] + stepSize);
            } else if (errorMinus < error) {
              joints[jn] = clampJoint(jn, joints[jn] - stepSize);
            }
          }
        }
      }
    }
  }

  return { joints: bestJoints, error: bestError };
}

// Worker message handler
self.onmessage = (e) => {
  const { type, id, targetPos, maxIter, fixedBaseAngle, preferHorizontalGrasp } = e.data;

  if (type !== 'solveIK') return;

  try {
    const result = solveIKForTarget(targetPos, maxIter, fixedBaseAngle, preferHorizontalGrasp);
    self.postMessage({ type: 'result', id, joints: result.joints, error: result.error });
  } catch (error) {
    self.postMessage({ type: 'error', id, error: error.message });
  }
};
`;

/**
 * IK Solver Worker Manager
 *
 * Provides non-blocking IK solving by offloading to a Web Worker.
 */
export class IKSolverWorker {
  private worker: Worker | null = null;
  private pendingRequests = new Map<number, {
    resolve: (result: { joints: JointAngles; error: number }) => void;
    reject: (error: Error) => void;
  }>();
  private nextId = 0;
  private isInitialized = false;

  /**
   * Initialize the worker
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return this.worker !== null;

    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url);
      URL.revokeObjectURL(url);

      this.worker.onmessage = (e: MessageEvent<IKWorkerResponse>) => {
        const { type, id } = e.data;
        const pending = this.pendingRequests.get(id);

        if (!pending) return;
        this.pendingRequests.delete(id);

        if (type === 'result') {
          const result = e.data as IKResult;
          pending.resolve({ joints: result.joints, error: result.error });
        } else if (type === 'error') {
          pending.reject(new Error((e.data as IKWorkerError).error));
        }
      };

      this.worker.onerror = (error) => {
        console.error('IK solver worker error:', error);
      };

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize IK solver worker:', error);
      return false;
    }
  }

  /**
   * Solve IK for a target position (non-blocking)
   */
  async solve(
    targetPos: [number, number, number],
    options: {
      maxIter?: number;
      fixedBaseAngle?: number;
      preferHorizontalGrasp?: boolean;
    } = {}
  ): Promise<{ joints: JointAngles; error: number }> {
    if (!this.worker) {
      throw new Error('IK solver worker not initialized');
    }

    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.worker!.postMessage({
        type: 'solveIK',
        id,
        targetPos,
        maxIter: options.maxIter ?? 1000,
        fixedBaseAngle: options.fixedBaseAngle,
        preferHorizontalGrasp: options.preferHorizontalGrasp ?? false,
      });
    });
  }

  /**
   * Check if worker is available
   */
  get available(): boolean {
    return this.worker !== null;
  }

  /**
   * Get number of pending solve requests
   */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();
    this.isInitialized = false;
  }
}

// Singleton instance
let globalIKSolver: IKSolverWorker | null = null;

/**
 * Get the global IK solver worker instance
 */
export async function getIKSolver(): Promise<IKSolverWorker> {
  if (!globalIKSolver) {
    globalIKSolver = new IKSolverWorker();
    await globalIKSolver.initialize();
  }
  return globalIKSolver;
}

/**
 * Solve IK using the global worker (convenience function)
 */
export async function solveIKAsync(
  targetPos: [number, number, number],
  options: {
    maxIter?: number;
    fixedBaseAngle?: number;
    preferHorizontalGrasp?: boolean;
  } = {}
): Promise<{ joints: JointAngles; error: number }> {
  const solver = await getIKSolver();
  return solver.solve(targetPos, options);
}
