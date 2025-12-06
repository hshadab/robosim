/**
 * Policy Runner - ONNX Runtime Integration
 *
 * Runs trained LeRobot policies in the browser using ONNX Runtime Web.
 * Supports ACT (Action Chunking Transformer) and other policy architectures.
 */

import * as ort from 'onnxruntime-web';
import type { PolicyConfig, LeRobotPolicyMeta } from './huggingfaceHub';

// Configure ONNX Runtime
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

// Policy execution state
export interface PolicyState {
  isLoaded: boolean;
  isRunning: boolean;
  modelId: string | null;
  policyType: LeRobotPolicyMeta['policyType'];
  actionBuffer: number[][];
  actionIndex: number;
  observationHistory: number[][];
  config: PolicyConfig | null;
}

// Policy inference result
export interface PolicyInferenceResult {
  actions: number[][];
  confidence?: number;
  latencyMs: number;
}

// SO-101 joint configuration
export const SO101_JOINTS = [
  'shoulder_pan',
  'shoulder_lift',
  'elbow_flex',
  'wrist_flex',
  'wrist_roll',
  'gripper',
] as const;

export const SO101_JOINT_LIMITS = {
  shoulder_pan: [-180, 180],
  shoulder_lift: [-90, 90],
  elbow_flex: [-135, 45],
  wrist_flex: [-90, 90],
  wrist_roll: [-180, 180],
  gripper: [0, 100],
};

export type JointPositions = Record<typeof SO101_JOINTS[number], number>;

/**
 * Policy Runner class - manages ONNX model loading and inference
 */
export class PolicyRunner {
  private session: ort.InferenceSession | null = null;
  private state: PolicyState = {
    isLoaded: false,
    isRunning: false,
    modelId: null,
    policyType: 'unknown',
    actionBuffer: [],
    actionIndex: 0,
    observationHistory: [],
    config: null,
  };

  // Default ACT policy parameters
  private chunkSize = 100; // Action chunk size
  private nActionSteps = 10; // Steps to execute per inference
  private historyLength = 1; // Observation history length

  /**
   * Load an ONNX model from ArrayBuffer
   */
  async loadModel(
    modelBuffer: ArrayBuffer,
    config?: PolicyConfig,
    meta?: LeRobotPolicyMeta
  ): Promise<void> {
    // Close existing session
    if (this.session) {
      await this.session.release();
      this.session = null;
    }

    try {
      // Create session from buffer
      this.session = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      // Update config from policy config
      if (config?.policy) {
        this.chunkSize = config.policy.chunk_size || this.chunkSize;
        this.nActionSteps = config.policy.n_action_steps || this.nActionSteps;
      }

      this.state = {
        isLoaded: true,
        isRunning: false,
        modelId: meta?.modelId || null,
        policyType: meta?.policyType || 'unknown',
        actionBuffer: [],
        actionIndex: 0,
        observationHistory: [],
        config: config || null,
      };

      console.log('[PolicyRunner] Model loaded successfully');
      console.log('[PolicyRunner] Input names:', this.session.inputNames);
      console.log('[PolicyRunner] Output names:', this.session.outputNames);
    } catch (error) {
      console.error('[PolicyRunner] Failed to load model:', error);
      throw error;
    }
  }

  /**
   * Get current state
   */
  getState(): PolicyState {
    return { ...this.state };
  }

  /**
   * Check if model is loaded
   */
  isReady(): boolean {
    return this.state.isLoaded && this.session !== null;
  }

  /**
   * Run inference to get actions from observations
   */
  async infer(
    jointPositions: number[],
    imageObservation?: ImageData | Float32Array
  ): Promise<PolicyInferenceResult> {
    if (!this.session) {
      throw new Error('Model not loaded');
    }

    const startTime = performance.now();

    // Add to observation history
    this.state.observationHistory.push(jointPositions);
    if (this.state.observationHistory.length > this.historyLength) {
      this.state.observationHistory.shift();
    }

    // Check if we need new actions
    if (
      this.state.actionBuffer.length === 0 ||
      this.state.actionIndex >= this.nActionSteps
    ) {
      // Run inference
      const actions = await this.runInference(jointPositions, imageObservation);
      this.state.actionBuffer = actions;
      this.state.actionIndex = 0;
    }

    // Get next action from buffer
    const currentActions = this.state.actionBuffer.slice(
      this.state.actionIndex,
      this.state.actionIndex + 1
    );
    this.state.actionIndex++;

    const latencyMs = performance.now() - startTime;

    return {
      actions: currentActions,
      latencyMs,
    };
  }

  /**
   * Run actual model inference
   */
  private async runInference(
    jointPositions: number[],
    _imageObservation?: ImageData | Float32Array
  ): Promise<number[][]> {
    if (!this.session) {
      throw new Error('Model not loaded');
    }

    try {
      // Prepare input tensors based on model input names
      const feeds: Record<string, ort.Tensor> = {};

      // Add observation.state input
      const stateInputName = this.session.inputNames.find(
        name => name.includes('state') || name.includes('observation')
      ) || this.session.inputNames[0];

      // Normalize joint positions to [-1, 1] range
      const normalizedPositions = jointPositions.map((pos, i) => {
        const jointName = SO101_JOINTS[i];
        const [min, max] = SO101_JOINT_LIMITS[jointName];
        return ((pos - min) / (max - min)) * 2 - 1;
      });

      // Create state tensor - shape depends on policy
      // ACT typically expects [batch, history, state_dim]
      const stateTensor = new ort.Tensor(
        'float32',
        new Float32Array(normalizedPositions),
        [1, normalizedPositions.length]
      );
      feeds[stateInputName] = stateTensor;

      // Add image observation if model expects it
      // This would need to be implemented based on specific model architecture
      // For now, we only support state-based policies

      // Run inference
      const results = await this.session.run(feeds);

      // Get action output
      const actionOutputName = this.session.outputNames.find(
        name => name.includes('action')
      ) || this.session.outputNames[0];

      const actionOutput = results[actionOutputName];
      if (!actionOutput) {
        throw new Error('No action output from model');
      }

      // Parse actions from tensor
      const actionData = actionOutput.data as Float32Array;
      const actionDim = jointPositions.length;

      // Denormalize actions
      const actions: number[][] = [];
      for (let i = 0; i < this.chunkSize && i * actionDim < actionData.length; i++) {
        const action = Array.from(actionData.slice(i * actionDim, (i + 1) * actionDim))
          .map((val, j) => {
            const jointName = SO101_JOINTS[j];
            const [min, max] = SO101_JOINT_LIMITS[jointName];
            // Denormalize from [-1, 1] to joint range
            return ((val + 1) / 2) * (max - min) + min;
          });
        actions.push(action);
      }

      return actions.length > 0 ? actions : [[...jointPositions]];
    } catch (error) {
      console.error('[PolicyRunner] Inference error:', error);
      // Return current position as fallback
      return [[...jointPositions]];
    }
  }

  /**
   * Start continuous policy execution
   */
  start(): void {
    this.state.isRunning = true;
  }

  /**
   * Stop policy execution
   */
  stop(): void {
    this.state.isRunning = false;
  }

  /**
   * Reset policy state (clear action buffer, history)
   */
  reset(): void {
    this.state.actionBuffer = [];
    this.state.actionIndex = 0;
    this.state.observationHistory = [];
  }

  /**
   * Unload model and release resources
   */
  async unload(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }

    this.state = {
      isLoaded: false,
      isRunning: false,
      modelId: null,
      policyType: 'unknown',
      actionBuffer: [],
      actionIndex: 0,
      observationHistory: [],
      config: null,
    };
  }

  /**
   * Get model info
   */
  getModelInfo(): { inputNames: string[]; outputNames: string[] } | null {
    if (!this.session) return null;

    return {
      inputNames: [...this.session.inputNames],
      outputNames: [...this.session.outputNames],
    };
  }
}

// Singleton instance
let policyRunnerInstance: PolicyRunner | null = null;

/**
 * Get the policy runner singleton
 */
export function getPolicyRunner(): PolicyRunner {
  if (!policyRunnerInstance) {
    policyRunnerInstance = new PolicyRunner();
  }
  return policyRunnerInstance;
}

/**
 * Convert JointState to array format for policy input
 */
export function jointStateToArray(joints: {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
  gripper: number;
}): number[] {
  return [
    joints.base,
    joints.shoulder,
    joints.elbow,
    joints.wrist,
    joints.wristRoll,
    joints.gripper,
  ];
}

/**
 * Convert array format back to JointState
 */
export function arrayToJointState(arr: number[]): {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
  gripper: number;
} {
  return {
    base: arr[0] || 0,
    shoulder: arr[1] || 0,
    elbow: arr[2] || 0,
    wrist: arr[3] || 0,
    wristRoll: arr[4] || 0,
    gripper: arr[5] || 0,
  };
}

/**
 * Clamp joint values to valid ranges
 */
export function clampJoints(joints: number[]): number[] {
  return joints.map((val, i) => {
    const jointName = SO101_JOINTS[i];
    const [min, max] = SO101_JOINT_LIMITS[jointName];
    return Math.max(min, Math.min(max, val));
  });
}
