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

      console.log(`Video recording started: ${mimeType}, ${this.options.fps} fps`);
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

        console.log(`Video recording stopped: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
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
  // In production, we'd use ffmpeg.wasm for true MP4 conversion
  console.log('Note: Video is in WebM format. For MP4, use ffmpeg conversion.');
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
