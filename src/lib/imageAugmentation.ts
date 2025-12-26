/**
 * Image Augmentation Library for Sim-to-Real Transfer
 *
 * Provides post-hoc image augmentation to increase dataset diversity:
 * - Color jitter (brightness, contrast, saturation)
 * - Random crop with aspect ratio preservation
 * - Cutout/occlusion patches
 * - Real-to-sim style transfer (noise, blur, color calibration)
 */

/**
 * Color jitter configuration
 */
export interface ColorJitterConfig {
  enabled: boolean;
  brightnessRange: [number, number];  // Multiplier range, e.g., [0.8, 1.2] for ±20%
  contrastRange: [number, number];    // Multiplier range
  saturationRange: [number, number];  // Multiplier range
  hueShift?: number;                  // Max hue shift in degrees (0-180)
}

/**
 * Random crop configuration
 */
export interface RandomCropConfig {
  enabled: boolean;
  minScale: number;     // Minimum crop scale (0.8 = 80% of original)
  maxScale?: number;    // Maximum crop scale (default 1.0)
  maintainAspectRatio: boolean;
}

/**
 * Cutout/occlusion configuration
 */
export interface CutoutConfig {
  enabled: boolean;
  numPatches: [number, number];       // Min/max number of patches
  patchSizeRatio: [number, number];   // Patch size as ratio of image dimension
  fillColor: string;                  // Color to fill patches (hex or 'random')
}

/**
 * Real-to-sim style transfer configuration
 */
export interface RealToSimStyleConfig {
  gaussianNoise: {
    enabled: boolean;
    sigma: number;        // Standard deviation (0-50)
  };
  motionBlur: {
    enabled: boolean;
    angle: number;        // Blur angle in degrees
    strength: number;     // Blur strength (0-20 pixels)
  };
  colorCalibration: {
    whiteBalance: number;    // Color temperature shift (-50 to 50)
    gamma: number;           // Gamma correction (0.5-2.0)
    vignetting: number;      // Vignette strength (0-1)
  };
}

/**
 * Complete image augmentation configuration
 */
export interface ImageAugmentationConfig {
  colorJitter: ColorJitterConfig;
  randomCrop: RandomCropConfig;
  cutout: CutoutConfig;
  realToSimStyle?: RealToSimStyleConfig;
}

/**
 * Default image augmentation configuration
 */
export const DEFAULT_AUGMENTATION_CONFIG: ImageAugmentationConfig = {
  colorJitter: {
    enabled: true,
    brightnessRange: [0.8, 1.2],
    contrastRange: [0.8, 1.2],
    saturationRange: [0.7, 1.3],
    hueShift: 10,
  },
  randomCrop: {
    enabled: true,
    minScale: 0.85,
    maxScale: 1.0,
    maintainAspectRatio: true,
  },
  cutout: {
    enabled: true,
    numPatches: [1, 3],
    patchSizeRatio: [0.05, 0.15],
    fillColor: '#808080', // Gray
  },
  realToSimStyle: {
    gaussianNoise: {
      enabled: true,
      sigma: 5,
    },
    motionBlur: {
      enabled: false,
      angle: 0,
      strength: 3,
    },
    colorCalibration: {
      whiteBalance: 0,
      gamma: 1.0,
      vignetting: 0.1,
    },
  },
};

/**
 * Helper: Random number in range
 */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Helper: Clamp value to range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply color jitter to image data
 */
function applyColorJitter(
  imageData: ImageData,
  config: ColorJitterConfig
): ImageData {
  if (!config.enabled) return imageData;

  const brightness = randomInRange(config.brightnessRange[0], config.brightnessRange[1]);
  const contrast = randomInRange(config.contrastRange[0], config.contrastRange[1]);
  const saturation = randomInRange(config.saturationRange[0], config.saturationRange[1]);

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Apply brightness
    r = r * brightness;
    g = g * brightness;
    b = b * brightness;

    // Apply contrast (relative to 128)
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    // Apply saturation
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;

    // Clamp and write back
    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
  }

  return imageData;
}

/**
 * Apply Gaussian noise to image data
 */
function applyGaussianNoise(
  imageData: ImageData,
  sigma: number
): ImageData {
  if (sigma <= 0) return imageData;

  const data = imageData.data;

  // Box-Muller transform for Gaussian random numbers
  const gaussianRandom = (): number => {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  for (let i = 0; i < data.length; i += 4) {
    const noise = gaussianRandom() * sigma;
    data[i] = clamp(data[i] + noise, 0, 255);
    data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
    data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
  }

  return imageData;
}

/**
 * Apply vignetting effect to image data
 */
function applyVignetting(
  imageData: ImageData,
  width: number,
  height: number,
  strength: number
): ImageData {
  if (strength <= 0) return imageData;

  const data = imageData.data;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      const normalizedDist = dist / maxDist;
      const vignetteMultiplier = 1 - strength * normalizedDist * normalizedDist;

      data[i] = clamp(data[i] * vignetteMultiplier, 0, 255);
      data[i + 1] = clamp(data[i + 1] * vignetteMultiplier, 0, 255);
      data[i + 2] = clamp(data[i + 2] * vignetteMultiplier, 0, 255);
    }
  }

  return imageData;
}

/**
 * Apply gamma correction to image data
 */
function applyGammaCorrection(
  imageData: ImageData,
  gamma: number
): ImageData {
  if (gamma === 1.0) return imageData;

  const invGamma = 1.0 / gamma;
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 * Math.pow(data[i] / 255, invGamma);
    data[i + 1] = 255 * Math.pow(data[i + 1] / 255, invGamma);
    data[i + 2] = 255 * Math.pow(data[i + 2] / 255, invGamma);
  }

  return imageData;
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
  return { r: 128, g: 128, b: 128 }; // Default gray
}

/**
 * Draw cutout patches on canvas context
 */
function drawCutoutPatches(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: CutoutConfig
): void {
  if (!config.enabled) return;

  const numPatches = Math.floor(randomInRange(config.numPatches[0], config.numPatches[1] + 1));

  for (let i = 0; i < numPatches; i++) {
    const patchWidth = Math.floor(width * randomInRange(config.patchSizeRatio[0], config.patchSizeRatio[1]));
    const patchHeight = Math.floor(height * randomInRange(config.patchSizeRatio[0], config.patchSizeRatio[1]));
    const x = Math.floor(Math.random() * (width - patchWidth));
    const y = Math.floor(Math.random() * (height - patchHeight));

    // Set fill color
    if (config.fillColor === 'random') {
      ctx.fillStyle = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
    } else {
      ctx.fillStyle = config.fillColor;
    }

    ctx.fillRect(x, y, patchWidth, patchHeight);
  }
}

/**
 * Augment a single base64 image
 * Returns a new augmented base64 image
 */
export async function augmentImage(
  base64Image: string,
  config: ImageAugmentationConfig = DEFAULT_AUGMENTATION_CONFIG
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Create offscreen canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Handle random crop
        let cropX = 0;
        let cropY = 0;
        let cropWidth = width;
        let cropHeight = height;

        if (config.randomCrop.enabled) {
          const scale = randomInRange(
            config.randomCrop.minScale,
            config.randomCrop.maxScale ?? 1.0
          );
          cropWidth = Math.floor(width * scale);
          cropHeight = Math.floor(height * scale);
          cropX = Math.floor(Math.random() * (width - cropWidth));
          cropY = Math.floor(Math.random() * (height - cropHeight));
        }

        // Set canvas size to output size (same as crop size for now)
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        // Draw cropped image
        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight, // Source rect
          0, 0, cropWidth, cropHeight          // Dest rect
        );

        // Get image data for pixel manipulation
        let imageData = ctx.getImageData(0, 0, cropWidth, cropHeight);

        // Apply color jitter
        if (config.colorJitter.enabled) {
          imageData = applyColorJitter(imageData, config.colorJitter);
        }

        // Apply real-to-sim style transfer
        if (config.realToSimStyle) {
          // Gaussian noise
          if (config.realToSimStyle.gaussianNoise.enabled) {
            imageData = applyGaussianNoise(imageData, config.realToSimStyle.gaussianNoise.sigma);
          }

          // Gamma correction
          if (config.realToSimStyle.colorCalibration.gamma !== 1.0) {
            imageData = applyGammaCorrection(imageData, config.realToSimStyle.colorCalibration.gamma);
          }

          // Vignetting
          if (config.realToSimStyle.colorCalibration.vignetting > 0) {
            imageData = applyVignetting(
              imageData,
              cropWidth,
              cropHeight,
              config.realToSimStyle.colorCalibration.vignetting
            );
          }
        }

        // Put the modified image data back
        ctx.putImageData(imageData, 0, 0);

        // Apply cutout patches (drawn on top)
        if (config.cutout.enabled) {
          drawCutoutPatches(ctx, cropWidth, cropHeight, config.cutout);
        }

        // Convert to base64
        const result = canvas.toDataURL('image/jpeg', 0.85);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for augmentation'));
    };

    // Handle both data URL and raw base64
    if (base64Image.startsWith('data:')) {
      img.src = base64Image;
    } else {
      img.src = `data:image/jpeg;base64,${base64Image}`;
    }
  });
}

/**
 * Generate multiple augmented versions of an image
 */
export async function generateAugmentedVersions(
  base64Image: string,
  numVersions: number,
  config: ImageAugmentationConfig = DEFAULT_AUGMENTATION_CONFIG
): Promise<string[]> {
  const augmented: string[] = [];

  for (let i = 0; i < numVersions; i++) {
    const augmentedImage = await augmentImage(base64Image, config);
    augmented.push(augmentedImage);
  }

  return augmented;
}

/**
 * Augmentation metadata to store with episode
 */
export interface AugmentationMetadata {
  type: 'original' | 'augmented';
  augmentationConfig?: Partial<ImageAugmentationConfig>;
  augmentationIndex?: number;
}

/**
 * Light augmentation config (subtle changes)
 */
export const LIGHT_AUGMENTATION_CONFIG: ImageAugmentationConfig = {
  colorJitter: {
    enabled: true,
    brightnessRange: [0.9, 1.1],
    contrastRange: [0.95, 1.05],
    saturationRange: [0.9, 1.1],
  },
  randomCrop: {
    enabled: true,
    minScale: 0.95,
    maintainAspectRatio: true,
  },
  cutout: {
    enabled: false,
    numPatches: [0, 0],
    patchSizeRatio: [0, 0],
    fillColor: '#808080',
  },
};

/**
 * Heavy augmentation config (more aggressive)
 */
export const HEAVY_AUGMENTATION_CONFIG: ImageAugmentationConfig = {
  colorJitter: {
    enabled: true,
    brightnessRange: [0.6, 1.4],
    contrastRange: [0.7, 1.3],
    saturationRange: [0.5, 1.5],
    hueShift: 20,
  },
  randomCrop: {
    enabled: true,
    minScale: 0.75,
    maintainAspectRatio: true,
  },
  cutout: {
    enabled: true,
    numPatches: [2, 5],
    patchSizeRatio: [0.1, 0.25],
    fillColor: 'random',
  },
  realToSimStyle: {
    gaussianNoise: {
      enabled: true,
      sigma: 15,
    },
    motionBlur: {
      enabled: true,
      angle: 45,
      strength: 5,
    },
    colorCalibration: {
      whiteBalance: 0,
      gamma: 0.9,
      vignetting: 0.3,
    },
  },
};
