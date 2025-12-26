/**
 * Domain Randomization for Sim-to-Real Transfer
 *
 * Provides tools to randomize visual properties of the simulation:
 * - Lighting (intensity, color, direction)
 * - Material colors and textures
 * - Camera properties
 * - Background/environment
 *
 * These variations help trained policies generalize to real-world conditions.
 */

export interface LightingConfig {
  // Key light (main directional light)
  keyLightIntensity: number;
  keyLightColor: string;
  keyLightX: number;
  keyLightY: number;
  keyLightZ: number;

  // Fill light
  fillLightIntensity: number;
  fillLightColor: string;

  // Rim light
  rimLightIntensity: number;
  rimLightColor: string;

  // Ambient light
  ambientIntensity: number;
  ambientColor: string;
}

export interface MaterialConfig {
  // Robot colors
  robotBaseColor: string;
  robotAccentColor: string;
  robotMetallic: number;
  robotRoughness: number;

  // Floor/table
  floorColor: string;
  floorRoughness: number;

  // Object colors (for manipulation tasks)
  objectColor: string;
  objectMetallic: number;
}

export interface CameraConfig {
  fov: number;
  noiseAmount: number; // Simulated sensor noise
  exposureBias: number;
  saturation: number;
}

export interface DomainRandomizationConfig {
  lighting: LightingConfig;
  materials: MaterialConfig;
  camera: CameraConfig;
}

// ============================================
// NEW: Visual Domain Randomization Extensions
// ============================================

/**
 * Camera jitter configuration for per-episode variation
 */
export interface CameraJitterConfig {
  positionOffset: [number, number, number]; // x, y, z offset in meters
  rotationOffset: [number, number, number]; // roll, pitch, yaw in radians
}

/**
 * Shadow configuration for variation
 */
export interface ShadowConfig {
  opacity: number;     // 0-1
  blur: number;        // softness (1-5)
  far: number;         // shadow reach
  resolution: number;  // shadow map resolution
}

/**
 * Distractor object configuration
 */
export interface DistractorConfig {
  enabled: boolean;
  count: number;  // max number of distractors (0-5)
  shapes: ('cube' | 'sphere' | 'cylinder')[];
  sizeRange: [number, number]; // min/max scale in meters
  positionBounds: {
    xRange: [number, number];
    yRange: [number, number];
    zRange: [number, number];
  };
  colors: string[];
}

/**
 * Procedural texture configuration
 */
export interface ProceduralTextureConfig {
  floor: {
    type: 'solid' | 'noise' | 'checker' | 'wood' | 'concrete' | 'metal';
    baseColor: string;
    secondaryColor?: string;
    roughness: number;
    metalness: number;
  };
  background: {
    type: 'solid' | 'gradient' | 'industrial';
    primaryColor: string;
    secondaryColor?: string;
  };
}

/**
 * Distractor object representation
 */
export interface DistractorObject {
  id: string;
  shape: 'cube' | 'sphere' | 'cylinder';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  color: string;
  roughness: number;
  metalness: number;
}

/**
 * Full visual randomization config for an episode
 */
export interface FullVisualRandomizationConfig {
  domain: DomainRandomizationConfig;
  cameraJitter: CameraJitterConfig;
  shadows: ShadowConfig;
  distractors: DistractorObject[];
  texture: ProceduralTextureConfig;
}

/**
 * Default configuration (realistic studio lighting)
 */
export const DEFAULT_DOMAIN_CONFIG: DomainRandomizationConfig = {
  lighting: {
    keyLightIntensity: 2.0,
    keyLightColor: '#ffffff',
    keyLightX: 5,
    keyLightY: 8,
    keyLightZ: 5,
    fillLightIntensity: 0.8,
    fillLightColor: '#a0c4ff',
    rimLightIntensity: 0.6,
    rimLightColor: '#ffd6a5',
    ambientIntensity: 0.15,
    ambientColor: '#ffffff',
  },
  materials: {
    robotBaseColor: '#2a2a2a',
    robotAccentColor: '#3b82f6',
    robotMetallic: 0.3,
    robotRoughness: 0.7,
    floorColor: '#404040',
    floorRoughness: 0.8,
    objectColor: '#ef4444',
    objectMetallic: 0.1,
  },
  camera: {
    fov: 50,
    noiseAmount: 0,
    exposureBias: 0,
    saturation: 1.0,
  },
};

/**
 * Parameter ranges for randomization
 */
export interface RandomizationRanges {
  lighting: {
    keyLightIntensity: [number, number];
    fillLightIntensity: [number, number];
    rimLightIntensity: [number, number];
    ambientIntensity: [number, number];
    lightPositionVariance: number; // How much to vary light positions
    colorTemperatureRange: [number, number]; // Kelvin
  };
  materials: {
    robotHueShift: [number, number]; // Degrees
    floorHueShift: [number, number];
    objectHueShift: [number, number];
    metallicRange: [number, number];
    roughnessRange: [number, number];
  };
  camera: {
    fovRange: [number, number];
    noiseRange: [number, number];
    exposureRange: [number, number];
    saturationRange: [number, number];
  };
  // New visual randomization ranges
  cameraJitter: {
    positionRange: number; // +/- meters (0.01 = 1cm)
    rotationRange: number; // +/- radians (0.035 = ~2 degrees)
  };
  shadows: {
    opacityRange: [number, number];
    blurRange: [number, number];
  };
  distractors: DistractorConfig;
  textures: {
    floorTypes: ProceduralTextureConfig['floor']['type'][];
    backgroundTypes: ProceduralTextureConfig['background']['type'][];
  };
}

export const DEFAULT_RANDOMIZATION_RANGES: RandomizationRanges = {
  lighting: {
    keyLightIntensity: [1.0, 4.0],
    fillLightIntensity: [0.3, 1.5],
    rimLightIntensity: [0.2, 1.2],
    ambientIntensity: [0.05, 0.4],
    lightPositionVariance: 3.0,
    colorTemperatureRange: [3000, 7500],
  },
  materials: {
    robotHueShift: [-30, 30],
    floorHueShift: [-60, 60],
    objectHueShift: [-180, 180],
    metallicRange: [0.0, 0.8],
    roughnessRange: [0.3, 1.0],
  },
  camera: {
    fovRange: [35, 75],
    noiseRange: [0, 0.1],
    exposureRange: [-1, 1],
    saturationRange: [0.6, 1.4],
  },
  // New visual randomization defaults
  cameraJitter: {
    positionRange: 0.01,  // ±1cm
    rotationRange: 0.035, // ±2 degrees
  },
  shadows: {
    opacityRange: [0.3, 0.7],
    blurRange: [1.5, 3.0],
  },
  distractors: {
    enabled: true,
    count: 3,
    shapes: ['cube', 'sphere', 'cylinder'],
    sizeRange: [0.01, 0.03],
    positionBounds: {
      xRange: [-0.25, 0.35],
      yRange: [0.01, 0.08],
      zRange: [-0.25, 0.25],
    },
    colors: ['#888888', '#555555', '#aaaaaa', '#666666', '#777777'],
  },
  textures: {
    floorTypes: ['solid', 'noise', 'checker', 'wood', 'concrete', 'metal'],
    backgroundTypes: ['solid', 'gradient', 'industrial'],
  },
};

/**
 * Convert color temperature (Kelvin) to RGB hex
 */
function kelvinToRGB(kelvin: number): string {
  const temp = kelvin / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 255;
    g = Math.max(0, Math.min(255, 99.4708025861 * Math.log(temp) - 161.1195681661));
    if (temp <= 19) {
      b = 0;
    } else {
      b = Math.max(0, Math.min(255, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
    }
  } else {
    r = Math.max(0, Math.min(255, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    g = Math.max(0, Math.min(255, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
    b = 255;
  }

  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

/**
 * Shift hue of a hex color
 */
function shiftHue(hexColor: string, degrees: number): string {
  // Parse hex
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;

  // Convert to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

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

  // Shift hue
  h = (h + degrees / 360) % 1;
  if (h < 0) h += 1;

  // Convert back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let newR: number, newG: number, newB: number;
  if (s === 0) {
    newR = newG = newB = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    newR = hue2rgb(p, q, h + 1 / 3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1 / 3);
  }

  return `#${Math.round(newR * 255).toString(16).padStart(2, '0')}${Math.round(newG * 255).toString(16).padStart(2, '0')}${Math.round(newB * 255).toString(16).padStart(2, '0')}`;
}

/**
 * Random number in range
 */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Generate a randomized domain configuration
 */
export function randomizeDomainConfig(
  base: DomainRandomizationConfig = DEFAULT_DOMAIN_CONFIG,
  ranges: RandomizationRanges = DEFAULT_RANDOMIZATION_RANGES
): DomainRandomizationConfig {
  const colorTemp = randomInRange(
    ranges.lighting.colorTemperatureRange[0],
    ranges.lighting.colorTemperatureRange[1]
  );
  const keyLightColor = kelvinToRGB(colorTemp);

  return {
    lighting: {
      keyLightIntensity: randomInRange(
        ranges.lighting.keyLightIntensity[0],
        ranges.lighting.keyLightIntensity[1]
      ),
      keyLightColor,
      keyLightX: base.lighting.keyLightX + randomInRange(
        -ranges.lighting.lightPositionVariance,
        ranges.lighting.lightPositionVariance
      ),
      keyLightY: base.lighting.keyLightY + randomInRange(
        -ranges.lighting.lightPositionVariance / 2,
        ranges.lighting.lightPositionVariance / 2
      ),
      keyLightZ: base.lighting.keyLightZ + randomInRange(
        -ranges.lighting.lightPositionVariance,
        ranges.lighting.lightPositionVariance
      ),
      fillLightIntensity: randomInRange(
        ranges.lighting.fillLightIntensity[0],
        ranges.lighting.fillLightIntensity[1]
      ),
      fillLightColor: shiftHue(base.lighting.fillLightColor, randomInRange(-30, 30)),
      rimLightIntensity: randomInRange(
        ranges.lighting.rimLightIntensity[0],
        ranges.lighting.rimLightIntensity[1]
      ),
      rimLightColor: shiftHue(base.lighting.rimLightColor, randomInRange(-30, 30)),
      ambientIntensity: randomInRange(
        ranges.lighting.ambientIntensity[0],
        ranges.lighting.ambientIntensity[1]
      ),
      ambientColor: kelvinToRGB(colorTemp * 0.9), // Slightly warmer ambient
    },
    materials: {
      robotBaseColor: shiftHue(
        base.materials.robotBaseColor,
        randomInRange(ranges.materials.robotHueShift[0], ranges.materials.robotHueShift[1])
      ),
      robotAccentColor: shiftHue(
        base.materials.robotAccentColor,
        randomInRange(ranges.materials.robotHueShift[0], ranges.materials.robotHueShift[1])
      ),
      robotMetallic: randomInRange(
        ranges.materials.metallicRange[0],
        ranges.materials.metallicRange[1]
      ),
      robotRoughness: randomInRange(
        ranges.materials.roughnessRange[0],
        ranges.materials.roughnessRange[1]
      ),
      floorColor: shiftHue(
        base.materials.floorColor,
        randomInRange(ranges.materials.floorHueShift[0], ranges.materials.floorHueShift[1])
      ),
      floorRoughness: randomInRange(
        ranges.materials.roughnessRange[0],
        ranges.materials.roughnessRange[1]
      ),
      objectColor: shiftHue(
        base.materials.objectColor,
        randomInRange(ranges.materials.objectHueShift[0], ranges.materials.objectHueShift[1])
      ),
      objectMetallic: randomInRange(
        ranges.materials.metallicRange[0],
        ranges.materials.metallicRange[1]
      ),
    },
    camera: {
      fov: randomInRange(ranges.camera.fovRange[0], ranges.camera.fovRange[1]),
      noiseAmount: randomInRange(ranges.camera.noiseRange[0], ranges.camera.noiseRange[1]),
      exposureBias: randomInRange(ranges.camera.exposureRange[0], ranges.camera.exposureRange[1]),
      saturation: randomInRange(ranges.camera.saturationRange[0], ranges.camera.saturationRange[1]),
    },
  };
}

/**
 * Preset configurations for different lighting conditions
 */
export const LIGHTING_PRESETS: Record<string, Partial<LightingConfig>> = {
  studio: {
    keyLightIntensity: 2.0,
    keyLightColor: '#ffffff',
    fillLightIntensity: 0.8,
    ambientIntensity: 0.15,
  },
  daylight: {
    keyLightIntensity: 3.0,
    keyLightColor: '#fff5e6',
    fillLightIntensity: 1.2,
    fillLightColor: '#87ceeb',
    ambientIntensity: 0.3,
  },
  overcast: {
    keyLightIntensity: 1.2,
    keyLightColor: '#e0e0e0',
    fillLightIntensity: 1.0,
    fillLightColor: '#c0c0c0',
    ambientIntensity: 0.4,
  },
  sunset: {
    keyLightIntensity: 2.5,
    keyLightColor: '#ff8c42',
    fillLightIntensity: 0.6,
    fillLightColor: '#ff6b6b',
    rimLightColor: '#ffd93d',
    ambientIntensity: 0.2,
  },
  night: {
    keyLightIntensity: 0.8,
    keyLightColor: '#4a5568',
    fillLightIntensity: 0.3,
    ambientIntensity: 0.1,
  },
  industrial: {
    keyLightIntensity: 2.5,
    keyLightColor: '#fff8dc',
    fillLightIntensity: 0.5,
    fillLightColor: '#90ee90',
    ambientIntensity: 0.25,
  },
};

/**
 * Apply a preset to the current config
 */
export function applyLightingPreset(
  config: DomainRandomizationConfig,
  presetName: keyof typeof LIGHTING_PRESETS
): DomainRandomizationConfig {
  const preset = LIGHTING_PRESETS[presetName];
  return {
    ...config,
    lighting: {
      ...config.lighting,
      ...preset,
    },
  };
}

/**
 * Generate multiple domain configurations for batch training
 */
export function generateDomainVariations(
  count: number,
  base?: DomainRandomizationConfig,
  ranges?: RandomizationRanges
): DomainRandomizationConfig[] {
  const variations: DomainRandomizationConfig[] = [];
  for (let i = 0; i < count; i++) {
    variations.push(randomizeDomainConfig(base, ranges));
  }
  return variations;
}

// ============================================
// NEW: Full Visual Randomization Functions
// ============================================

/**
 * Generate random camera jitter
 */
function generateCameraJitter(ranges: RandomizationRanges): CameraJitterConfig {
  const { positionRange, rotationRange } = ranges.cameraJitter;
  return {
    positionOffset: [
      randomInRange(-positionRange, positionRange),
      randomInRange(-positionRange, positionRange),
      randomInRange(-positionRange, positionRange),
    ],
    rotationOffset: [
      randomInRange(-rotationRange, rotationRange),
      randomInRange(-rotationRange, rotationRange),
      randomInRange(-rotationRange, rotationRange),
    ],
  };
}

/**
 * Generate random shadow configuration
 */
function generateShadowConfig(ranges: RandomizationRanges): ShadowConfig {
  return {
    opacity: randomInRange(ranges.shadows.opacityRange[0], ranges.shadows.opacityRange[1]),
    blur: randomInRange(ranges.shadows.blurRange[0], ranges.shadows.blurRange[1]),
    far: 0.5,
    resolution: 256,
  };
}

/**
 * Generate random distractor objects
 */
function generateDistractors(config: DistractorConfig): DistractorObject[] {
  if (!config.enabled) return [];

  const distractors: DistractorObject[] = [];
  const count = Math.floor(Math.random() * (config.count + 1)); // 0 to count

  for (let i = 0; i < count; i++) {
    const shape = config.shapes[Math.floor(Math.random() * config.shapes.length)];
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    const scale = randomInRange(config.sizeRange[0], config.sizeRange[1]);

    distractors.push({
      id: `distractor-${i}-${Date.now()}`,
      shape,
      position: [
        randomInRange(config.positionBounds.xRange[0], config.positionBounds.xRange[1]),
        randomInRange(config.positionBounds.yRange[0], config.positionBounds.yRange[1]),
        randomInRange(config.positionBounds.zRange[0], config.positionBounds.zRange[1]),
      ],
      rotation: [0, Math.random() * Math.PI * 2, 0],
      scale,
      color,
      roughness: randomInRange(0.4, 0.9),
      metalness: randomInRange(0.0, 0.3),
    });
  }

  return distractors;
}

/**
 * Generate random procedural texture configuration
 */
function generateTextureConfig(ranges: RandomizationRanges): ProceduralTextureConfig {
  const floorType = ranges.textures.floorTypes[
    Math.floor(Math.random() * ranges.textures.floorTypes.length)
  ];
  const bgType = ranges.textures.backgroundTypes[
    Math.floor(Math.random() * ranges.textures.backgroundTypes.length)
  ];

  // Generate floor colors based on type
  const floorColors: Record<string, { base: string; secondary?: string }> = {
    solid: { base: '#334155' },
    noise: { base: '#3a4a5f', secondary: '#2a3a4f' },
    checker: { base: '#404040', secondary: '#303030' },
    wood: { base: '#8B4513', secondary: '#A0522D' },
    concrete: { base: '#808080', secondary: '#696969' },
    metal: { base: '#708090', secondary: '#778899' },
  };

  const bgColors: Record<string, { primary: string; secondary?: string }> = {
    solid: { primary: '#0f172a' },
    gradient: { primary: '#0f172a', secondary: '#1e293b' },
    industrial: { primary: '#1a1a2e', secondary: '#16213e' },
  };

  const floorColorConfig = floorColors[floorType] || floorColors.solid;
  const bgColorConfig = bgColors[bgType] || bgColors.solid;

  return {
    floor: {
      type: floorType,
      baseColor: floorColorConfig.base,
      secondaryColor: floorColorConfig.secondary,
      roughness: randomInRange(0.6, 0.95),
      metalness: floorType === 'metal' ? randomInRange(0.5, 0.8) : randomInRange(0.0, 0.2),
    },
    background: {
      type: bgType,
      primaryColor: bgColorConfig.primary,
      secondaryColor: bgColorConfig.secondary,
    },
  };
}

/**
 * Generate a complete visual randomization configuration for an episode
 * This is the main function to call before each demo in batch generation
 */
export function randomizeVisuals(
  ranges: RandomizationRanges = DEFAULT_RANDOMIZATION_RANGES
): FullVisualRandomizationConfig {
  return {
    domain: randomizeDomainConfig(DEFAULT_DOMAIN_CONFIG, ranges),
    cameraJitter: generateCameraJitter(ranges),
    shadows: generateShadowConfig(ranges),
    distractors: generateDistractors(ranges.distractors),
    texture: generateTextureConfig(ranges),
  };
}

/**
 * Default full visual config (no randomization)
 */
export const DEFAULT_FULL_VISUAL_CONFIG: FullVisualRandomizationConfig = {
  domain: DEFAULT_DOMAIN_CONFIG,
  cameraJitter: {
    positionOffset: [0, 0, 0],
    rotationOffset: [0, 0, 0],
  },
  shadows: {
    opacity: 0.5,
    blur: 2,
    far: 0.5,
    resolution: 256,
  },
  distractors: [],
  texture: {
    floor: {
      type: 'solid',
      baseColor: '#334155',
      roughness: 0.8,
      metalness: 0.2,
    },
    background: {
      type: 'solid',
      primaryColor: '#0f172a',
    },
  },
};
