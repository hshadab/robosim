/**
 * Physics-Based Episode Generator
 *
 * Generates training episodes by actually running the simulation with physics.
 * Unlike the synthetic generator, this:
 * - Actually moves the robot through the simulation
 * - Captures camera frames at each step
 * - Records real physics interactions with objects
 * - Supports language-conditioned demonstrations
 *
 * This creates high-quality training data for vision-language-action models.
 */

import { useAppStore } from '../stores/useAppStore';
import type { JointState, SimObject } from '../types';
import type { Episode, Frame, EpisodeMetadata } from './datasetExporter';
import { createSceneFromPreset, SCENE_PRESETS } from './objectLibrary';
import { CanvasVideoRecorder } from './videoRecorder';

export interface PhysicsGenerationConfig {
  // Language instruction for the task
  languageInstruction: string;
  // Scene preset to load (from objectLibrary)
  scenePreset?: string;
  // Custom objects to spawn (overrides preset)
  customObjects?: Omit<SimObject, 'id'>[];
  // Robot ID
  robotId: string;
  // Frame rate for recording
  frameRate: number;
  // Maximum episode duration (ms)
  maxDuration: number;
  // Whether to capture images
  captureImages: boolean;
}

export interface PhysicsGenerationProgress {
  phase: 'setup' | 'executing' | 'recording' | 'complete' | 'error';
  currentFrame: number;
  elapsedTime: number;
  message: string;
}

export interface PhysicsEpisodeResult {
  episode: Episode;
  videoBlob?: Blob;
  success: boolean;
  error?: string;
}

/**
 * Motion plan step - a target joint state with timing
 */
export interface MotionStep {
  joints: Partial<JointState>;
  duration: number; // ms
  description?: string;
}

/**
 * A complete motion plan for a task
 */
export interface MotionPlan {
  steps: MotionStep[];
  totalDuration: number;
  description: string;
}

/**
 * Interpolate between two joint states
 */
function interpolateJoints(from: JointState, to: Partial<JointState>, t: number): JointState {
  const result = { ...from };
  for (const key of Object.keys(to) as (keyof JointState)[]) {
    if (to[key] !== undefined) {
      result[key] = from[key] + ((to[key] as number) - from[key]) * t;
    }
  }
  return result;
}

/**
 * Ease-in-out interpolation for smooth motion
 */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Convert JointState to array format for dataset
 */
function jointStateToArray(joints: JointState): number[] {
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
 * Physics Episode Generator class
 * Executes motion plans in the actual simulation and records the results
 */
export class PhysicsEpisodeGenerator {
  private config: PhysicsGenerationConfig;
  private videoRecorder: CanvasVideoRecorder | null = null;
  private frames: Frame[] = [];
  private startTime: number = 0;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(config: PhysicsGenerationConfig) {
    this.config = config;
  }

  /**
   * Setup the scene with objects from preset or custom list
   */
  async setupScene(): Promise<void> {
    const store = useAppStore.getState();

    // Clear existing objects
    store.clearObjects();

    // Load scene preset if specified
    if (this.config.scenePreset) {
      const presetObjects = createSceneFromPreset(this.config.scenePreset);
      presetObjects.forEach(obj => {
        const { id, ...objWithoutId } = obj;
        store.spawnObject(objWithoutId);
      });
    }

    // Or spawn custom objects
    if (this.config.customObjects) {
      this.config.customObjects.forEach(obj => {
        store.spawnObject(obj);
      });
    }

    // Small delay for physics to settle
    await this.wait(100);
  }

  /**
   * Execute a motion plan and record the episode
   */
  async executeMotionPlan(
    plan: MotionPlan,
    onProgress?: (progress: PhysicsGenerationProgress) => void
  ): Promise<PhysicsEpisodeResult> {
    this.isRunning = true;
    this.shouldStop = false;
    this.frames = [];
    this.startTime = Date.now();

    const store = useAppStore.getState();
    let videoBlob: Blob | undefined;

    try {
      // Report setup phase
      onProgress?.({
        phase: 'setup',
        currentFrame: 0,
        elapsedTime: 0,
        message: 'Setting up scene...',
      });

      // Setup scene
      await this.setupScene();

      // Initialize video recorder if capturing images
      if (this.config.captureImages) {
        this.videoRecorder = new CanvasVideoRecorder({ fps: this.config.frameRate });
        const canvas = this.videoRecorder.findThreeCanvas();
        if (canvas) {
          this.videoRecorder.start();
        }
      }

      // Report execution phase
      onProgress?.({
        phase: 'executing',
        currentFrame: 0,
        elapsedTime: 0,
        message: 'Executing motion plan...',
      });

      // Execute each step
      let totalFrames = 0;
      for (let stepIdx = 0; stepIdx < plan.steps.length; stepIdx++) {
        if (this.shouldStop) break;

        const step = plan.steps[stepIdx];
        const stepStartTime = Date.now();
        const frameInterval = 1000 / this.config.frameRate;
        const framesInStep = Math.ceil(step.duration / frameInterval);

        const startJoints = { ...store.joints };

        for (let f = 0; f < framesInStep; f++) {
          if (this.shouldStop) break;

          const t = f / framesInStep;
          const smoothT = easeInOut(t);

          // Interpolate joints
          const targetJoints = interpolateJoints(startJoints, step.joints, smoothT);

          // Apply to simulation
          store.setJoints(targetJoints);

          // Capture frame
          const frameTime = (Date.now() - this.startTime) / 1000;
          const imageDataUrl = this.config.captureImages
            ? this.videoRecorder?.captureFrame()
            : undefined;

          this.frames.push({
            timestamp: frameTime,
            observation: {
              jointPositions: jointStateToArray(store.joints),
              image: imageDataUrl || undefined,
            },
            action: {
              jointTargets: jointStateToArray(targetJoints),
              gripper: targetJoints.gripper / 100,
            },
            done: stepIdx === plan.steps.length - 1 && f === framesInStep - 1,
          });

          totalFrames++;

          // Report progress
          onProgress?.({
            phase: 'recording',
            currentFrame: totalFrames,
            elapsedTime: Date.now() - this.startTime,
            message: step.description || `Step ${stepIdx + 1}/${plan.steps.length}`,
          });

          // Wait for next frame
          const elapsed = Date.now() - stepStartTime;
          const nextFrameTime = (f + 1) * frameInterval;
          if (nextFrameTime > elapsed) {
            await this.wait(nextFrameTime - elapsed);
          }
        }

        // Apply final joint state for step
        store.setJoints(step.joints as JointState);
      }

      // Stop video recording
      if (this.videoRecorder?.recording) {
        const blob = await this.videoRecorder.stop();
        if (blob) {
          videoBlob = blob;
        }
      }

      // Create episode
      const duration = (Date.now() - this.startTime) / 1000;
      const metadata: EpisodeMetadata = {
        robotType: 'arm',
        robotId: this.config.robotId,
        task: plan.description,
        languageInstruction: this.config.languageInstruction,
        success: !this.shouldStop,
        duration,
        frameCount: this.frames.length,
        recordedAt: new Date().toISOString(),
      };

      const episode: Episode = {
        episodeId: Date.now(),
        frames: this.frames,
        metadata,
      };

      onProgress?.({
        phase: 'complete',
        currentFrame: this.frames.length,
        elapsedTime: Date.now() - this.startTime,
        message: `Recorded ${this.frames.length} frames`,
      });

      return {
        episode,
        videoBlob,
        success: true,
      };

    } catch (error) {
      onProgress?.({
        phase: 'error',
        currentFrame: this.frames.length,
        elapsedTime: Date.now() - this.startTime,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        episode: {
          episodeId: Date.now(),
          frames: this.frames,
          metadata: {
            robotType: 'arm',
            robotId: this.config.robotId,
            task: plan.description,
            success: false,
            duration: (Date.now() - this.startTime) / 1000,
            frameCount: this.frames.length,
            recordedAt: new Date().toISOString(),
          },
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop the current recording
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if currently running
   */
  get running(): boolean {
    return this.isRunning;
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Generate a motion plan for stacking blocks
 */
export function generateStackingPlan(
  pickPosition: { x: number; z: number },
  placePosition: { x: number; z: number }
): MotionPlan {
  // Convert XZ positions to approximate joint angles
  // This is a simplified inverse kinematics approximation
  const pickBase = Math.atan2(pickPosition.x, pickPosition.z) * (180 / Math.PI);
  const placeBase = Math.atan2(placePosition.x, placePosition.z) * (180 / Math.PI);

  return {
    description: 'Stack block',
    totalDuration: 6000,
    steps: [
      // Home position with gripper open
      {
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 },
        duration: 500,
        description: 'Starting position',
      },
      // Move above pick location
      {
        joints: { base: pickBase, shoulder: -30, elbow: 45, wrist: 0, gripper: 100 },
        duration: 800,
        description: 'Moving to pick position',
      },
      // Lower to pick
      {
        joints: { base: pickBase, shoulder: -45, elbow: 60, wrist: 15, gripper: 100 },
        duration: 600,
        description: 'Lowering to object',
      },
      // Close gripper
      {
        joints: { base: pickBase, shoulder: -45, elbow: 60, wrist: 15, gripper: 0 },
        duration: 400,
        description: 'Grasping object',
      },
      // Lift
      {
        joints: { base: pickBase, shoulder: -20, elbow: 40, wrist: 0, gripper: 0 },
        duration: 600,
        description: 'Lifting object',
      },
      // Move to place location
      {
        joints: { base: placeBase, shoulder: -20, elbow: 40, wrist: 0, gripper: 0 },
        duration: 800,
        description: 'Moving to place position',
      },
      // Lower to place
      {
        joints: { base: placeBase, shoulder: -40, elbow: 55, wrist: 10, gripper: 0 },
        duration: 600,
        description: 'Lowering to place',
      },
      // Open gripper
      {
        joints: { base: placeBase, shoulder: -40, elbow: 55, wrist: 10, gripper: 100 },
        duration: 400,
        description: 'Releasing object',
      },
      // Retract
      {
        joints: { base: placeBase, shoulder: -20, elbow: 30, wrist: 0, gripper: 100 },
        duration: 600,
        description: 'Retracting',
      },
      // Return home
      {
        joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
        duration: 700,
        description: 'Returning home',
      },
    ],
  };
}

/**
 * Generate a motion plan for pick and place
 */
export function generatePickPlacePlan(
  pickPosition: { x: number; z: number },
  placePosition: { x: number; z: number }
): MotionPlan {
  return generateStackingPlan(pickPosition, placePosition);
}

/**
 * Get available scene presets for generation
 */
export function getAvailableScenePresets(): Array<{
  id: string;
  name: string;
  description: string;
  objectCount: number;
}> {
  return SCENE_PRESETS.map(preset => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    objectCount: preset.objects.length,
  }));
}

/**
 * Parse a natural language instruction into a motion plan
 * This is a simplified parser - in production, this would use an LLM
 */
export function parseInstructionToMotionPlan(instruction: string): MotionPlan | null {
  const lowerInstruction = instruction.toLowerCase();

  // Simple pattern matching for common tasks
  if (lowerInstruction.includes('stack') || lowerInstruction.includes('put') && lowerInstruction.includes('on')) {
    // Extract color mentions to determine which blocks
    const colors = ['red', 'blue', 'green', 'yellow'];
    const mentionedColors = colors.filter(c => lowerInstruction.includes(c));

    if (mentionedColors.length >= 2) {
      // Stack first color on second color
      // Use approximate positions based on typical scene layout
      return generateStackingPlan(
        { x: -0.12, z: 0.08 }, // Left position
        { x: 0.12, z: 0.08 }   // Right position
      );
    }
  }

  if (lowerInstruction.includes('pick') && lowerInstruction.includes('place')) {
    return generatePickPlacePlan(
      { x: -0.1, z: 0.1 },
      { x: 0.1, z: 0.1 }
    );
  }

  // Default pick and place if we can't parse
  return null;
}
