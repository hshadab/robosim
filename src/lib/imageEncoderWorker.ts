/**
 * Web Worker for Image Encoding
 *
 * Offloads JPEG encoding from main thread to prevent UI freezes during recording.
 * Uses OffscreenCanvas for GPU-accelerated encoding in the worker.
 */

// Worker message types
export interface EncodeImageMessage {
  type: 'encode';
  id: number;
  imageBitmap: ImageBitmap;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
}

export interface EncodedImageResult {
  type: 'encoded';
  id: number;
  blob: Blob;
  base64?: string;
}

export interface WorkerError {
  type: 'error';
  id: number;
  error: string;
}

export type WorkerMessage = EncodeImageMessage;
export type WorkerResponse = EncodedImageResult | WorkerError;

// The actual worker code (will be inlined as a blob URL)
const workerCode = `
  let canvas = null;
  let ctx = null;

  self.onmessage = async (e) => {
    const { type, id, imageBitmap, quality, format } = e.data;

    if (type !== 'encode') return;

    try {
      // Create or resize OffscreenCanvas
      if (!canvas || canvas.width !== imageBitmap.width || canvas.height !== imageBitmap.height) {
        canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        ctx = canvas.getContext('2d');
      }

      // Draw the image
      ctx.drawImage(imageBitmap, 0, 0);

      // Close the ImageBitmap to free memory
      imageBitmap.close();

      // Encode to blob
      const mimeType = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
      const blob = await canvas.convertToBlob({ type: mimeType, quality });

      // Send back the result
      self.postMessage({ type: 'encoded', id, blob }, []);
    } catch (error) {
      self.postMessage({ type: 'error', id, error: error.message });
    }
  };
`;

/**
 * Image Encoder using Web Worker
 *
 * Provides non-blocking image encoding by offloading to a Web Worker.
 */
export class ImageEncoderWorker {
  private worker: Worker | null = null;
  private pendingRequests = new Map<number, {
    resolve: (blob: Blob) => void;
    reject: (error: Error) => void;
  }>();
  private nextId = 0;
  private isSupported = false;

  constructor() {
    this.isSupported = typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined';
  }

  /**
   * Initialize the worker
   */
  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('OffscreenCanvas not supported, falling back to main thread encoding');
      return false;
    }

    try {
      // Create worker from inline code
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url);
      URL.revokeObjectURL(url);

      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { type, id } = e.data;
        const pending = this.pendingRequests.get(id);

        if (!pending) return;

        this.pendingRequests.delete(id);

        if (type === 'encoded') {
          pending.resolve((e.data as EncodedImageResult).blob);
        } else if (type === 'error') {
          pending.reject(new Error((e.data as WorkerError).error));
        }
      };

      this.worker.onerror = (error) => {
        console.error('Image encoder worker error:', error);
      };

      return true;
    } catch (error) {
      console.error('Failed to initialize image encoder worker:', error);
      return false;
    }
  }

  /**
   * Encode an ImageBitmap to JPEG blob (non-blocking)
   */
  async encode(
    imageBitmap: ImageBitmap,
    quality = 0.8,
    format: 'jpeg' | 'png' | 'webp' = 'jpeg'
  ): Promise<Blob> {
    if (!this.worker) {
      // Fallback to main thread
      return this.encodeMainThread(imageBitmap, quality, format);
    }

    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.worker!.postMessage(
        { type: 'encode', id, imageBitmap, quality, format },
        [imageBitmap] // Transfer ownership to worker
      );
    });
  }

  /**
   * Fallback: encode on main thread using canvas
   */
  private async encodeMainThread(
    imageBitmap: ImageBitmap,
    quality: number,
    format: 'jpeg' | 'png' | 'webp'
  ): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    return new Promise((resolve, reject) => {
      const mimeType = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to encode image'));
        },
        mimeType,
        quality
      );
    });
  }

  /**
   * Check if worker is available
   */
  get available(): boolean {
    return this.worker !== null;
  }

  /**
   * Check if OffscreenCanvas is supported
   */
  get supported(): boolean {
    return this.isSupported;
  }

  /**
   * Get number of pending encode requests
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

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();
  }
}

// Singleton instance
let globalEncoder: ImageEncoderWorker | null = null;

/**
 * Get the global image encoder worker instance
 */
export async function getImageEncoder(): Promise<ImageEncoderWorker> {
  if (!globalEncoder) {
    globalEncoder = new ImageEncoderWorker();
    await globalEncoder.initialize();
  }
  return globalEncoder;
}

/**
 * Capture canvas as ImageBitmap (fast, non-blocking)
 */
export async function captureCanvasAsImageBitmap(
  canvas: HTMLCanvasElement
): Promise<ImageBitmap> {
  // createImageBitmap is async and doesn't block main thread
  return createImageBitmap(canvas);
}

/**
 * Convert Blob to base64 data URL
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
