/**
 * Video Recorder for 3D Canvas
 *
 * Captures the Three.js canvas as MP4 video during robot demonstrations.
 * Used for LeRobot dataset export with visual observations.
 */

export interface VideoRecorderOptions {
  fps?: number;
  videoBitsPerSecond?: number;
  mimeType?: string;
}

const DEFAULT_OPTIONS: VideoRecorderOptions = {
  fps: 30,
  videoBitsPerSecond: 2500000, // 2.5 Mbps
  mimeType: 'video/webm;codecs=vp9',
};

/**
 * Video recorder that captures a canvas element
 */
export class CanvasVideoRecorder {
  private canvas: HTMLCanvasElement | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private options: VideoRecorderOptions;
  private isRecording = false;
  private frameCount = 0;

  constructor(options: VideoRecorderOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get the best supported MIME type for video recording
   */
  static getBestMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm'; // Fallback
  }

  /**
   * Set the canvas element to record
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * Find and set the Three.js canvas automatically
   */
  findThreeCanvas(): HTMLCanvasElement | null {
    // Try to find the Three.js canvas in the simulation viewport
    const canvas = document.querySelector('canvas[data-engine]') as HTMLCanvasElement;
    if (canvas) {
      this.canvas = canvas;
      return canvas;
    }

    // Fallback: find any canvas
    const anyCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (anyCanvas) {
      this.canvas = anyCanvas;
      return anyCanvas;
    }

    return null;
  }

  /**
   * Start recording the canvas
   */
  start(): boolean {
    if (this.isRecording) {
      console.warn('Already recording');
      return false;
    }

    if (!this.canvas) {
      this.findThreeCanvas();
    }

    if (!this.canvas) {
      console.error('No canvas found to record');
      return false;
    }

    try {
      // Get stream from canvas
      this.stream = this.canvas.captureStream(this.options.fps);

      // Determine best MIME type
      const mimeType = this.options.mimeType || CanvasVideoRecorder.getBestMimeType();

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: this.options.videoBitsPerSecond,
      });

      this.chunks = [];
      this.frameCount = 0;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      // Start recording with timeslice for chunked data
      this.mediaRecorder.start(100); // Get data every 100ms
      this.isRecording = true;

      return true;
    } catch (error) {
      console.error('Failed to start video recording:', error);
      return false;
    }
  }

  /**
   * Stop recording and return the video blob
   */
  async stop(): Promise<Blob | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      return null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
        const blob = new Blob(this.chunks, { type: mimeType });

        // Cleanup
        this.chunks = [];
        this.isRecording = false;

        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }

        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Check if currently recording
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current frame count (approximate)
   */
  get frames(): number {
    if (!this.isRecording) return 0;
    // Approximate based on recording duration
    return this.frameCount;
  }

  /**
   * Capture a single frame as an image
   */
  captureFrame(): string | null {
    if (!this.canvas) {
      this.findThreeCanvas();
    }

    if (!this.canvas) {
      return null;
    }

    try {
      this.frameCount++;
      return this.canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Failed to capture frame:', error);
      return null;
    }
  }

  /**
   * Capture frame as blob (more efficient than base64)
   */
  async captureFrameBlob(): Promise<Blob | null> {
    if (!this.canvas) {
      this.findThreeCanvas();
    }

    if (!this.canvas) {
      return null;
    }

    return new Promise((resolve) => {
      this.canvas!.toBlob(
        (blob) => {
          this.frameCount++;
          resolve(blob);
        },
        'image/jpeg',
        0.8
      );
    });
  }
}

/**
 * Convert WebM to MP4 using browser APIs (if supported)
 * Note: Full conversion requires ffmpeg.wasm or server-side processing
 */
export async function convertWebMToMP4(webmBlob: Blob): Promise<Blob> {
  // For now, return as-is since browser-native MP4 encoding is limited
  // In production, use ffmpeg.wasm for true MP4 conversion
  return webmBlob;
}

/**
 * Download video blob as a file
 */
export function downloadVideo(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Get video duration from blob
 */
export async function getVideoDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      resolve(0);
    };

    video.src = URL.createObjectURL(blob);
  });
}

/**
 * Singleton video recorder instance for easy access
 */
let globalRecorder: CanvasVideoRecorder | null = null;

export function getGlobalVideoRecorder(): CanvasVideoRecorder {
  if (!globalRecorder) {
    globalRecorder = new CanvasVideoRecorder();
  }
  return globalRecorder;
}

export function resetGlobalVideoRecorder(): void {
  globalRecorder = null;
}

/**
 * Multi-camera recorder for LeRobot datasets
 * Supports multiple camera views: high (overhead), wrist, side
 */
export type CameraView = 'cam_high' | 'cam_wrist' | 'cam_left' | 'cam_right';

export interface MultiCameraConfig {
  views: CameraView[];
  fps: number;
  resolution: { width: number; height: number };
}

export interface MultiCameraFrame {
  timestamp: number;
  images: Partial<Record<CameraView, string>>; // base64 encoded images
}

export class MultiCameraRecorder {
  private config: MultiCameraConfig;
  private recorders: Map<CameraView, CanvasVideoRecorder> = new Map();
  private frames: MultiCameraFrame[] = [];
  private isRecording = false;
  private startTime = 0;

  constructor(config: Partial<MultiCameraConfig> = {}) {
    this.config = {
      views: config.views || ['cam_high'],
      fps: config.fps || 30,
      resolution: config.resolution || { width: 640, height: 480 },
    };
  }

  /**
   * Initialize recorders for each camera view
   */
  initialize(): void {
    for (const view of this.config.views) {
      const recorder = new CanvasVideoRecorder({ fps: this.config.fps });
      this.recorders.set(view, recorder);
    }
  }

  /**
   * Set canvas for a specific camera view
   */
  setCanvas(view: CameraView, canvas: HTMLCanvasElement): void {
    const recorder = this.recorders.get(view);
    if (recorder) {
      recorder.setCanvas(canvas);
    }
  }

  /**
   * Auto-detect main canvas for cam_high (primary view)
   */
  autoDetectMainCanvas(): boolean {
    const recorder = this.recorders.get('cam_high');
    if (recorder) {
      return recorder.findThreeCanvas() !== null;
    }
    return false;
  }

  /**
   * Start recording all camera views
   */
  start(): boolean {
    if (this.isRecording) return false;

    this.frames = [];
    this.startTime = Date.now();
    this.isRecording = true;

    // Start video recording for each view
    for (const [view, recorder] of this.recorders) {
      if (view === 'cam_high') {
        // Main canvas - always record video
        recorder.findThreeCanvas();
        recorder.start();
      }
      // Other views will capture frames as they become available
    }

    return true;
  }

  /**
   * Capture frame from all cameras
   */
  captureFrame(): MultiCameraFrame {
    const timestamp = Date.now() - this.startTime;
    const images: Partial<Record<CameraView, string>> = {};

    for (const [view, recorder] of this.recorders) {
      const frame = recorder.captureFrame();
      if (frame) {
        images[view] = frame;
      }
    }

    const frameData: MultiCameraFrame = { timestamp, images };
    this.frames.push(frameData);
    return frameData;
  }

  /**
   * Stop recording and return video blobs for each view
   */
  async stop(): Promise<Map<CameraView, Blob | null>> {
    if (!this.isRecording) {
      return new Map();
    }

    this.isRecording = false;
    const videos = new Map<CameraView, Blob | null>();

    for (const [view, recorder] of this.recorders) {
      if (recorder.recording) {
        const blob = await recorder.stop();
        videos.set(view, blob);
      } else {
        videos.set(view, null);
      }
    }

    return videos;
  }

  /**
   * Get all captured frames
   */
  getFrames(): MultiCameraFrame[] {
    return this.frames;
  }

  /**
   * Get frame count
   */
  get frameCount(): number {
    return this.frames.length;
  }

  /**
   * Check if recording
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * Get configured camera views
   */
  get views(): CameraView[] {
    return this.config.views;
  }
}

/**
 * Create a multi-camera recorder with LeRobot-compatible defaults
 */
export function createLeRobotRecorder(views: CameraView[] = ['cam_high']): MultiCameraRecorder {
  const recorder = new MultiCameraRecorder({
    views,
    fps: 30,
    resolution: { width: 640, height: 480 },
  });
  recorder.initialize();
  return recorder;
}
