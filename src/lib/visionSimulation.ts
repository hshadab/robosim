/**
 * Vision Simulation Library
 *
 * Simulates camera and vision capabilities for robotics:
 * - RGB image capture from 3D viewport
 * - Blob detection (color-based object detection)
 * - Simple image processing utilities
 */

import type { Vector3D } from '../types';

// Color blob detection result
export interface BlobDetection {
  id: number;
  color: string;
  centroid: { x: number; y: number };
  boundingBox: { x: number; y: number; width: number; height: number };
  area: number;
  aspectRatio: number;
}

// Camera configuration
export interface CameraConfig {
  width: number;
  height: number;
  fov: number;
  nearClip: number;
  farClip: number;
  position: Vector3D;
  target: Vector3D;
}

// Default robot camera config (end effector camera)
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  width: 320,
  height: 240,
  fov: 60,
  nearClip: 0.01,
  farClip: 10,
  position: { x: 0, y: 0.2, z: 0.1 },
  target: { x: 0, y: 0, z: 0.3 },
};

// Color detection presets
export interface ColorFilter {
  name: string;
  hueMin: number;
  hueMax: number;
  satMin: number;
  satMax: number;
  valMin: number;
  valMax: number;
}

export const COLOR_PRESETS: Record<string, ColorFilter> = {
  red: {
    name: 'Red',
    hueMin: 0, hueMax: 15,
    satMin: 100, satMax: 255,
    valMin: 100, valMax: 255,
  },
  redWrap: {
    name: 'Red (Wrap)',
    hueMin: 170, hueMax: 180,
    satMin: 100, satMax: 255,
    valMin: 100, valMax: 255,
  },
  green: {
    name: 'Green',
    hueMin: 35, hueMax: 85,
    satMin: 100, satMax: 255,
    valMin: 100, valMax: 255,
  },
  blue: {
    name: 'Blue',
    hueMin: 100, hueMax: 130,
    satMin: 100, satMax: 255,
    valMin: 100, valMax: 255,
  },
  yellow: {
    name: 'Yellow',
    hueMin: 20, hueMax: 35,
    satMin: 100, satMax: 255,
    valMin: 100, valMax: 255,
  },
  orange: {
    name: 'Orange',
    hueMin: 10, hueMax: 25,
    satMin: 150, satMax: 255,
    valMin: 150, valMax: 255,
  },
  purple: {
    name: 'Purple',
    hueMin: 130, hueMax: 160,
    satMin: 50, satMax: 255,
    valMin: 50, valMax: 255,
  },
};

/**
 * Convert RGB to HSV
 */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 180), // 0-180 for OpenCV compatibility
    s: Math.round(s * 255),
    v: Math.round(v * 255),
  };
}

/**
 * Check if a pixel matches a color filter
 */
export function matchesColorFilter(
  r: number, g: number, b: number,
  filter: ColorFilter
): boolean {
  const { h, s, v } = rgbToHsv(r, g, b);
  return (
    h >= filter.hueMin && h <= filter.hueMax &&
    s >= filter.satMin && s <= filter.satMax &&
    v >= filter.valMin && v <= filter.valMax
  );
}

/**
 * Simple blob detection using connected component labeling
 */
export function detectBlobs(
  imageData: ImageData,
  colorFilter: ColorFilter,
  minArea: number = 100
): BlobDetection[] {
  const { width, height, data } = imageData;

  // Create binary mask
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (matchesColorFilter(r, g, b, colorFilter)) {
        mask[y * width + x] = 1;
      }
    }
  }

  // Connected component labeling (simple flood fill)
  const labels = new Int32Array(width * height);
  let nextLabel = 1;
  const blobs: Map<number, { pixels: Array<{ x: number; y: number }>; color: { r: number; g: number; b: number } }> = new Map();

  const floodFill = (startX: number, startY: number, label: number) => {
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    const pixels: Array<{ x: number; y: number }> = [];
    let totalR = 0, totalG = 0, totalB = 0;

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (mask[idx] === 0 || labels[idx] !== 0) continue;

      labels[idx] = label;
      pixels.push({ x, y });

      const dataIdx = idx * 4;
      totalR += data[dataIdx];
      totalG += data[dataIdx + 1];
      totalB += data[dataIdx + 2];

      // 4-connectivity
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    return {
      pixels,
      color: {
        r: Math.round(totalR / pixels.length),
        g: Math.round(totalG / pixels.length),
        b: Math.round(totalB / pixels.length),
      },
    };
  };

  // Find all blobs
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] === 1 && labels[idx] === 0) {
        const blob = floodFill(x, y, nextLabel);
        if (blob.pixels.length >= minArea) {
          blobs.set(nextLabel, blob);
        }
        nextLabel++;
      }
    }
  }

  // Convert to BlobDetection results
  const results: BlobDetection[] = [];
  let blobId = 0;

  for (const [, blob] of blobs) {
    const { pixels, color } = blob;

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;

    for (const p of pixels) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      sumX += p.x;
      sumY += p.y;
    }

    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;

    results.push({
      id: blobId++,
      color: `rgb(${color.r},${color.g},${color.b})`,
      centroid: {
        x: sumX / pixels.length,
        y: sumY / pixels.length,
      },
      boundingBox: {
        x: minX,
        y: minY,
        width: boxWidth,
        height: boxHeight,
      },
      area: pixels.length,
      aspectRatio: boxWidth / boxHeight,
    });
  }

  // Sort by area (largest first)
  results.sort((a, b) => b.area - a.area);

  return results;
}

/**
 * Detect multiple color blobs in an image
 */
export function detectMultipleColors(
  imageData: ImageData,
  colors: string[],
  minArea: number = 100
): Map<string, BlobDetection[]> {
  const results = new Map<string, BlobDetection[]>();

  for (const colorName of colors) {
    const filter = COLOR_PRESETS[colorName];
    if (filter) {
      const blobs = detectBlobs(imageData, filter, minArea);
      results.set(colorName, blobs);

      // For red, also check the wrap-around range
      if (colorName === 'red' && COLOR_PRESETS['redWrap']) {
        const wrapBlobs = detectBlobs(imageData, COLOR_PRESETS['redWrap'], minArea);
        results.set(colorName, [...blobs, ...wrapBlobs]);
      }
    }
  }

  return results;
}

/**
 * Simple edge detection (Sobel-like)
 */
export function detectEdges(imageData: ImageData, threshold: number = 50): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);

  // Convert to grayscale first
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  // Sobel kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      let ki = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = gray[(y + ky) * width + (x + kx)];
          gx += pixel * sobelX[ki];
          gy += pixel * sobelY[ki];
          ki++;
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const outIdx = (y * width + x) * 4;
      const value = magnitude > threshold ? 255 : 0;
      output.data[outIdx] = value;
      output.data[outIdx + 1] = value;
      output.data[outIdx + 2] = value;
      output.data[outIdx + 3] = 255;
    }
  }

  return output;
}

/**
 * Calculate image histogram
 */
export function calculateHistogram(imageData: ImageData): { r: number[]; g: number[]; b: number[] } {
  const r = new Array(256).fill(0);
  const g = new Array(256).fill(0);
  const b = new Array(256).fill(0);

  for (let i = 0; i < imageData.data.length; i += 4) {
    r[imageData.data[i]]++;
    g[imageData.data[i + 1]]++;
    b[imageData.data[i + 2]]++;
  }

  return { r, g, b };
}

/**
 * Apply brightness/contrast adjustment
 */
export function adjustBrightnessContrast(
  imageData: ImageData,
  brightness: number,
  contrast: number
): ImageData {
  const output = new ImageData(imageData.width, imageData.height);
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < imageData.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let value = imageData.data[i + c];
      value = factor * (value - 128) + 128 + brightness;
      output.data[i + c] = Math.max(0, Math.min(255, Math.round(value)));
    }
    output.data[i + 3] = imageData.data[i + 3];
  }

  return output;
}

/**
 * Gaussian blur (3x3 kernel)
 */
export function gaussianBlur(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);

  // 3x3 Gaussian kernel (normalized)
  const kernel = [
    1/16, 2/16, 1/16,
    2/16, 4/16, 2/16,
    1/16, 2/16, 1/16,
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += data[idx] * kernel[ki];
            ki++;
          }
        }
        output.data[(y * width + x) * 4 + c] = Math.round(sum);
      }
      output.data[(y * width + x) * 4 + 3] = 255;
    }
  }

  return output;
}

/**
 * Vision simulation state manager
 */
export class VisionSimulator {
  private config: CameraConfig;
  private lastCapture: ImageData | null = null;
  private captureCallback: ((imageData: ImageData) => void) | null = null;

  constructor(config: Partial<CameraConfig> = {}) {
    this.config = { ...DEFAULT_CAMERA_CONFIG, ...config };
  }

  setConfig(config: Partial<CameraConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CameraConfig {
    return { ...this.config };
  }

  onCapture(callback: (imageData: ImageData) => void): void {
    this.captureCallback = callback;
  }

  processCapture(imageData: ImageData): void {
    this.lastCapture = imageData;
    if (this.captureCallback) {
      this.captureCallback(imageData);
    }
  }

  getLastCapture(): ImageData | null {
    return this.lastCapture;
  }

  detectColor(colorName: string, minArea: number = 100): BlobDetection[] {
    if (!this.lastCapture) return [];
    const filter = COLOR_PRESETS[colorName];
    if (!filter) return [];
    return detectBlobs(this.lastCapture, filter, minArea);
  }

  detectAllColors(minArea: number = 100): Map<string, BlobDetection[]> {
    if (!this.lastCapture) return new Map();
    return detectMultipleColors(
      this.lastCapture,
      Object.keys(COLOR_PRESETS).filter(k => k !== 'redWrap'),
      minArea
    );
  }
}

// Global vision simulator instance
let globalVisionSimulator: VisionSimulator | null = null;

export function getVisionSimulator(): VisionSimulator {
  if (!globalVisionSimulator) {
    globalVisionSimulator = new VisionSimulator();
  }
  return globalVisionSimulator;
}

export function resetVisionSimulator(): void {
  globalVisionSimulator = null;
}
