/**
 * MediaPipe Vision Integration
 * Provides hand and pose tracking for gesture-based robot control
 */

import {
  HandLandmarker,
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from '@mediapipe/tasks-vision';
import type { HandLandmarkerResult, PoseLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

export type { HandLandmarkerResult, PoseLandmarkerResult, NormalizedLandmark };

export interface HandTrackingResult {
  landmarks: NormalizedLandmark[][];
  handedness: { index: number; score: number; categoryName: string }[];
  worldLandmarks: NormalizedLandmark[][];
}

export interface PoseTrackingResult {
  landmarks: NormalizedLandmark[];
  worldLandmarks: NormalizedLandmark[];
}

export interface MediaPipeConfig {
  numHands?: number;
  minHandDetectionConfidence?: number;
  minHandPresenceConfidence?: number;
  minTrackingConfidence?: number;
  minPoseDetectionConfidence?: number;
  minPosePresenceConfidence?: number;
  runningMode?: 'IMAGE' | 'VIDEO';
}

const DEFAULT_CONFIG: MediaPipeConfig = {
  numHands: 2,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  runningMode: 'VIDEO',
};

// Hand landmark indices for common gestures
export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
};

// Pose landmark indices
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

export class MediaPipeVision {
  private handLandmarker: HandLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private drawingUtils: DrawingUtils | null = null;
  private config: MediaPipeConfig;
  private isInitialized = false;

  constructor(config: MediaPipeConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the MediaPipe vision models
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      // Initialize hand landmarker - try GPU first, fall back to CPU
      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: this.config.runningMode,
          numHands: this.config.numHands,
          minHandDetectionConfidence: this.config.minHandDetectionConfidence,
          minHandPresenceConfidence: this.config.minHandPresenceConfidence,
          minTrackingConfidence: this.config.minTrackingConfidence,
        });
        console.log('[MediaPipe] Hand landmarker initialized with GPU');
      } catch (gpuError) {
        console.warn('[MediaPipe] GPU delegate failed, falling back to CPU:', gpuError);
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: this.config.runningMode,
          numHands: this.config.numHands,
          minHandDetectionConfidence: this.config.minHandDetectionConfidence,
          minHandPresenceConfidence: this.config.minHandPresenceConfidence,
          minTrackingConfidence: this.config.minTrackingConfidence,
        });
        console.log('[MediaPipe] Hand landmarker initialized with CPU fallback');
      }

      // Initialize pose landmarker - try GPU first, fall back to CPU
      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: this.config.runningMode,
          minPoseDetectionConfidence: this.config.minPoseDetectionConfidence,
          minPosePresenceConfidence: this.config.minPosePresenceConfidence,
          minTrackingConfidence: this.config.minTrackingConfidence,
        });
        console.log('[MediaPipe] Pose landmarker initialized with GPU');
      } catch (gpuError) {
        console.warn('[MediaPipe] Pose GPU delegate failed, falling back to CPU:', gpuError);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU',
          },
          runningMode: this.config.runningMode,
          minPoseDetectionConfidence: this.config.minPoseDetectionConfidence,
          minPosePresenceConfidence: this.config.minPosePresenceConfidence,
          minTrackingConfidence: this.config.minTrackingConfidence,
        });
        console.log('[MediaPipe] Pose landmarker initialized with CPU fallback');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      throw error;
    }
  }

  /**
   * Process video frame for hand tracking
   */
  detectHands(
    video: HTMLVideoElement,
    timestamp: number
  ): HandLandmarkerResult | null {
    if (!this.handLandmarker) return null;
    return this.handLandmarker.detectForVideo(video, timestamp);
  }

  /**
   * Process video frame for pose tracking
   */
  detectPose(
    video: HTMLVideoElement,
    timestamp: number
  ): PoseLandmarkerResult | null {
    if (!this.poseLandmarker) return null;
    return this.poseLandmarker.detectForVideo(video, timestamp);
  }

  /**
   * Draw hand landmarks on a canvas
   */
  drawHandLandmarks(
    canvas: HTMLCanvasElement,
    results: HandLandmarkerResult
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!this.drawingUtils) {
      this.drawingUtils = new DrawingUtils(ctx);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.landmarks) {
      for (const landmarks of results.landmarks) {
        this.drawingUtils.drawConnectors(
          landmarks,
          HandLandmarker.HAND_CONNECTIONS,
          { color: '#00FF00', lineWidth: 3 }
        );
        this.drawingUtils.drawLandmarks(landmarks, {
          color: '#FF0000',
          lineWidth: 1,
          radius: 3,
        });
      }
    }
  }

  /**
   * Draw pose landmarks on a canvas
   */
  drawPoseLandmarks(
    canvas: HTMLCanvasElement,
    results: PoseLandmarkerResult
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!this.drawingUtils) {
      this.drawingUtils = new DrawingUtils(ctx);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.landmarks && results.landmarks.length > 0) {
      for (const landmarks of results.landmarks) {
        this.drawingUtils.drawConnectors(
          landmarks,
          PoseLandmarker.POSE_CONNECTIONS,
          { color: '#00FFFF', lineWidth: 3 }
        );
        this.drawingUtils.drawLandmarks(landmarks, {
          color: '#FF00FF',
          lineWidth: 1,
          radius: 3,
        });
      }
    }
  }

  /**
   * Detect if a pinch gesture is being made (thumb + index finger close)
   */
  detectPinch(landmarks: NormalizedLandmark[]): { isPinching: boolean; position: { x: number; y: number } } {
    const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];
    const indexTip = landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP];

    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) +
      Math.pow(thumbTip.y - indexTip.y, 2) +
      Math.pow(thumbTip.z - indexTip.z, 2)
    );

    // Pinch threshold (normalized coordinates)
    const isPinching = distance < 0.05;

    // Midpoint between thumb and index for position
    const position = {
      x: (thumbTip.x + indexTip.x) / 2,
      y: (thumbTip.y + indexTip.y) / 2,
    };

    return { isPinching, position };
  }

  /**
   * Detect pointing direction (index finger extended, others curled)
   */
  detectPointing(landmarks: NormalizedLandmark[]): { isPointing: boolean; direction: { x: number; y: number } } {
    const wrist = landmarks[HAND_LANDMARKS.WRIST];
    const indexTip = landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP];
    const indexMcp = landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP];

    // Check if index finger is extended
    const indexExtended = indexTip.y < indexMcp.y;

    // Check if other fingers are curled
    const middleCurled = landmarks[HAND_LANDMARKS.MIDDLE_FINGER_TIP].y > landmarks[HAND_LANDMARKS.MIDDLE_FINGER_MCP].y;
    const ringCurled = landmarks[HAND_LANDMARKS.RING_FINGER_TIP].y > landmarks[HAND_LANDMARKS.RING_FINGER_MCP].y;
    const pinkyCurled = landmarks[HAND_LANDMARKS.PINKY_TIP].y > landmarks[HAND_LANDMARKS.PINKY_MCP].y;

    const isPointing = indexExtended && middleCurled && ringCurled && pinkyCurled;

    // Calculate pointing direction
    const direction = {
      x: indexTip.x - wrist.x,
      y: indexTip.y - wrist.y,
    };

    return { isPointing, direction };
  }

  /**
   * Detect open hand (all fingers extended)
   */
  detectOpenHand(landmarks: NormalizedLandmark[]): boolean {
    const fingerTips = [
      HAND_LANDMARKS.INDEX_FINGER_TIP,
      HAND_LANDMARKS.MIDDLE_FINGER_TIP,
      HAND_LANDMARKS.RING_FINGER_TIP,
      HAND_LANDMARKS.PINKY_TIP,
    ];

    const fingerMcps = [
      HAND_LANDMARKS.INDEX_FINGER_MCP,
      HAND_LANDMARKS.MIDDLE_FINGER_MCP,
      HAND_LANDMARKS.RING_FINGER_MCP,
      HAND_LANDMARKS.PINKY_MCP,
    ];

    // Check if all fingers are extended (tip above MCP)
    for (let i = 0; i < fingerTips.length; i++) {
      if (landmarks[fingerTips[i]].y > landmarks[fingerMcps[i]].y) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detect closed fist (all fingers curled)
   */
  detectFist(landmarks: NormalizedLandmark[]): boolean {
    const fingerTips = [
      HAND_LANDMARKS.INDEX_FINGER_TIP,
      HAND_LANDMARKS.MIDDLE_FINGER_TIP,
      HAND_LANDMARKS.RING_FINGER_TIP,
      HAND_LANDMARKS.PINKY_TIP,
    ];

    const fingerMcps = [
      HAND_LANDMARKS.INDEX_FINGER_MCP,
      HAND_LANDMARKS.MIDDLE_FINGER_MCP,
      HAND_LANDMARKS.RING_FINGER_MCP,
      HAND_LANDMARKS.PINKY_MCP,
    ];

    // Check if all fingers are curled (tip below MCP)
    for (let i = 0; i < fingerTips.length; i++) {
      if (landmarks[fingerTips[i]].y < landmarks[fingerMcps[i]].y) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert hand landmarks to robot arm joint angles
   */
  handToArmAngles(landmarks: NormalizedLandmark[]): {
    base: number;
    shoulder: number;
    elbow: number;
    wrist: number;
    gripper: number;
  } {
    const wrist = landmarks[HAND_LANDMARKS.WRIST];
    const indexMcp = landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP];
    const indexTip = landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP];
    const thumbTip = landmarks[HAND_LANDMARKS.THUMB_TIP];

    // Map hand position to base rotation (-135 to 135 degrees)
    const base = (wrist.x - 0.5) * 270;

    // Map wrist height to shoulder angle (-90 to 90 degrees)
    const shoulder = (0.5 - wrist.y) * 180;

    // Calculate elbow angle based on finger extension
    const fingerLength = Math.sqrt(
      Math.pow(indexTip.x - indexMcp.x, 2) +
      Math.pow(indexTip.y - indexMcp.y, 2)
    );
    const elbow = -135 + fingerLength * 360;

    // Calculate wrist angle based on hand tilt
    const handAngle = Math.atan2(
      indexMcp.y - wrist.y,
      indexMcp.x - wrist.x
    );
    const wristAngle = (handAngle * 180) / Math.PI;

    // Calculate gripper based on pinch
    const pinchDistance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) +
      Math.pow(thumbTip.y - indexTip.y, 2)
    );
    const gripper = Math.min(100, pinchDistance * 1000);

    return {
      base: Math.max(-135, Math.min(135, base)),
      shoulder: Math.max(-90, Math.min(90, shoulder)),
      elbow: Math.max(-135, Math.min(45, elbow)),
      wrist: Math.max(-90, Math.min(90, wristAngle)),
      gripper: Math.max(0, Math.min(100, gripper)),
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
let visionInstance: MediaPipeVision | null = null;

export function getMediaPipeVision(config?: MediaPipeConfig): MediaPipeVision {
  if (!visionInstance) {
    visionInstance = new MediaPipeVision(config);
  }
  return visionInstance;
}
