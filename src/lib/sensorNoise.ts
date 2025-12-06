/**
 * Sensor Noise Models
 *
 * Realistic noise simulation for sim-to-real transfer.
 * Based on real sensor characteristics and noise patterns.
 */

// Noise configuration interface
export interface NoiseConfig {
  enabled: boolean;
  // Gaussian noise
  gaussianStdDev: number;
  // Bias (systematic offset)
  bias: number;
  // Quantization (discrete steps)
  quantization: number;
  // Dropout probability (0-1)
  dropoutProbability: number;
  // Lag in milliseconds
  lagMs: number;
  // Jitter (random timing variation)
  jitterMs: number;
  // Spike probability (sudden large errors)
  spikeProbability: number;
  spikeMultiplier: number;
}

// Default noise profiles for different sensor types
export const NOISE_PROFILES: Record<string, Partial<NoiseConfig>> = {
  ultrasonic: {
    gaussianStdDev: 0.5,      // ±0.5cm typical
    bias: 0,
    quantization: 0.1,         // 1mm resolution
    dropoutProbability: 0.01,  // 1% dropout
    lagMs: 20,                 // 20ms typical response time
    jitterMs: 5,
    spikeProbability: 0.005,
    spikeMultiplier: 3,
  },
  ir: {
    gaussianStdDev: 0,         // Binary sensor
    bias: 0,
    quantization: 1,           // Binary
    dropoutProbability: 0.02,  // 2% false readings
    lagMs: 1,
    jitterMs: 0,
    spikeProbability: 0,
    spikeMultiplier: 0,
  },
  imu: {
    gaussianStdDev: 0.5,       // ±0.5° typical
    bias: 0.2,                 // Slight bias
    quantization: 0.1,         // 0.1° resolution
    dropoutProbability: 0.001,
    lagMs: 5,
    jitterMs: 2,
    spikeProbability: 0.001,
    spikeMultiplier: 5,
  },
  accelerometer: {
    gaussianStdDev: 0.05,      // ±0.05 m/s²
    bias: 0.02,
    quantization: 0.01,
    dropoutProbability: 0.001,
    lagMs: 2,
    jitterMs: 1,
    spikeProbability: 0.002,
    spikeMultiplier: 4,
  },
  gyroscope: {
    gaussianStdDev: 0.5,       // ±0.5°/s
    bias: 0.1,                 // Gyro drift bias
    quantization: 0.1,
    dropoutProbability: 0.001,
    lagMs: 2,
    jitterMs: 1,
    spikeProbability: 0.001,
    spikeMultiplier: 3,
  },
  encoder: {
    gaussianStdDev: 0.1,       // ±0.1° position noise
    bias: 0,
    quantization: 0.088,       // Typical servo resolution
    dropoutProbability: 0.0001,
    lagMs: 1,
    jitterMs: 0,
    spikeProbability: 0.0001,
    spikeMultiplier: 2,
  },
  temperature: {
    gaussianStdDev: 0.2,       // ±0.2°C
    bias: 0,
    quantization: 0.1,
    dropoutProbability: 0.001,
    lagMs: 1000,               // Slow response
    jitterMs: 100,
    spikeProbability: 0,
    spikeMultiplier: 0,
  },
  battery: {
    gaussianStdDev: 0.5,       // ±0.5%
    bias: 0,
    quantization: 1,           // 1% resolution
    dropoutProbability: 0.001,
    lagMs: 100,
    jitterMs: 50,
    spikeProbability: 0,
    spikeMultiplier: 0,
  },
  gps: {
    gaussianStdDev: 0.002,     // ±2mm position error
    bias: 0.001,
    quantization: 0.001,       // 1mm resolution
    dropoutProbability: 0.01,
    lagMs: 50,
    jitterMs: 20,
    spikeProbability: 0.01,
    spikeMultiplier: 10,
  },
  touch: {
    gaussianStdDev: 0,         // Binary
    bias: 0,
    quantization: 1,
    dropoutProbability: 0.02,  // 2% false readings
    lagMs: 5,
    jitterMs: 2,
    spikeProbability: 0.01,    // Occasional false triggers
    spikeMultiplier: 1,
  },
  lidar: {
    gaussianStdDev: 1.0,       // ±1cm typical
    bias: 0,
    quantization: 0.5,         // 5mm resolution
    dropoutProbability: 0.02,  // 2% missed rays
    lagMs: 10,
    jitterMs: 5,
    spikeProbability: 0.01,
    spikeMultiplier: 5,
  },
};

// Box-Muller transform for Gaussian random numbers
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Apply noise to a numeric sensor value
 */
export function applyNoise(
  value: number,
  config: Partial<NoiseConfig>,
  min?: number,
  max?: number
): number {
  if (!config.enabled && config.enabled !== undefined) {
    return value;
  }

  let noisyValue = value;

  // 1. Add Gaussian noise
  if (config.gaussianStdDev && config.gaussianStdDev > 0) {
    noisyValue += gaussianRandom() * config.gaussianStdDev;
  }

  // 2. Add systematic bias
  if (config.bias) {
    noisyValue += config.bias;
  }

  // 3. Apply quantization
  if (config.quantization && config.quantization > 0) {
    noisyValue = Math.round(noisyValue / config.quantization) * config.quantization;
  }

  // 4. Handle dropout (return NaN or previous value)
  if (config.dropoutProbability && Math.random() < config.dropoutProbability) {
    return NaN; // Caller should handle dropout
  }

  // 5. Handle spikes
  if (config.spikeProbability && config.spikeMultiplier) {
    if (Math.random() < config.spikeProbability) {
      const spikeDirection = Math.random() > 0.5 ? 1 : -1;
      noisyValue += spikeDirection * config.gaussianStdDev! * config.spikeMultiplier;
    }
  }

  // Clamp to valid range if specified
  if (min !== undefined && max !== undefined) {
    noisyValue = Math.max(min, Math.min(max, noisyValue));
  }

  return noisyValue;
}

/**
 * Apply noise to a boolean sensor (with false positive/negative)
 */
export function applyBooleanNoise(
  value: boolean,
  config: Partial<NoiseConfig>
): boolean {
  if (!config.enabled && config.enabled !== undefined) {
    return value;
  }

  // Dropout causes false negative
  if (config.dropoutProbability && Math.random() < config.dropoutProbability) {
    return !value; // Flip the value
  }

  // Spike causes false positive
  if (config.spikeProbability && Math.random() < config.spikeProbability) {
    return !value; // Flip the value
  }

  return value;
}

/**
 * Apply noise to a 3D vector
 */
export function applyVectorNoise(
  vector: { x: number; y: number; z: number },
  config: Partial<NoiseConfig>,
  min?: number,
  max?: number
): { x: number; y: number; z: number } {
  return {
    x: applyNoise(vector.x, config, min, max),
    y: applyNoise(vector.y, config, min, max),
    z: applyNoise(vector.z, config, min, max),
  };
}

/**
 * Sensor lag buffer - stores historical values for delayed reading
 */
export class LagBuffer<T> {
  private buffer: Array<{ value: T; timestamp: number }> = [];
  private lagMs: number;
  private jitterMs: number;

  constructor(lagMs: number, jitterMs: number = 0) {
    this.lagMs = lagMs;
    this.jitterMs = jitterMs;
  }

  push(value: T): void {
    const now = performance.now();
    this.buffer.push({ value, timestamp: now });

    // Clean old entries (keep last 2 seconds max)
    const cutoff = now - 2000;
    this.buffer = this.buffer.filter(entry => entry.timestamp > cutoff);
  }

  get(fallback: T): T {
    const now = performance.now();
    const targetTime = now - this.lagMs - (Math.random() * this.jitterMs);

    // Find the most recent value before targetTime
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].timestamp <= targetTime) {
        return this.buffer[i].value;
      }
    }

    return fallback;
  }

  clear(): void {
    this.buffer = [];
  }
}

/**
 * Drift model - gradual sensor drift over time
 */
export class DriftModel {
  private driftValue: number = 0;
  private driftRate: number;
  private maxDrift: number;
  private lastUpdate: number = performance.now();

  constructor(driftRatePerSecond: number, maxDrift: number) {
    this.driftRate = driftRatePerSecond;
    this.maxDrift = maxDrift;
  }

  update(): number {
    const now = performance.now();
    const deltaSeconds = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // Random walk drift
    this.driftValue += (Math.random() - 0.5) * this.driftRate * deltaSeconds;

    // Clamp to max drift
    this.driftValue = Math.max(-this.maxDrift, Math.min(this.maxDrift, this.driftValue));

    return this.driftValue;
  }

  reset(): void {
    this.driftValue = 0;
  }

  getValue(): number {
    return this.driftValue;
  }
}

/**
 * Complete noise model for a sensor
 */
export class SensorNoiseModel<T> {
  private config: NoiseConfig;
  private lagBuffer: LagBuffer<T>;
  private drift: DriftModel;
  private lastValidValue: T;

  constructor(
    sensorType: string,
    initialValue: T,
    overrides?: Partial<NoiseConfig>
  ) {
    const profile = NOISE_PROFILES[sensorType] || {};
    this.config = {
      enabled: true,
      gaussianStdDev: 0,
      bias: 0,
      quantization: 0,
      dropoutProbability: 0,
      lagMs: 0,
      jitterMs: 0,
      spikeProbability: 0,
      spikeMultiplier: 1,
      ...profile,
      ...overrides,
    };

    this.lagBuffer = new LagBuffer(this.config.lagMs, this.config.jitterMs);
    this.drift = new DriftModel(0.01, this.config.bias * 2);
    this.lastValidValue = initialValue;
  }

  apply(value: T, min?: number, max?: number): T {
    // Push current value to lag buffer
    this.lagBuffer.push(value);

    // Get lagged value
    const laggedValue = this.lagBuffer.get(value);

    if (typeof laggedValue === 'number') {
      const drift = this.drift.update();
      let result = applyNoise(laggedValue as number, this.config, min, max);

      // Handle dropout
      if (isNaN(result)) {
        return this.lastValidValue;
      }

      result += drift;
      this.lastValidValue = result as T;
      return result as T;
    } else if (typeof laggedValue === 'boolean') {
      const result = applyBooleanNoise(laggedValue as boolean, this.config);
      this.lastValidValue = result as T;
      return result as T;
    } else if (typeof laggedValue === 'object' && laggedValue !== null) {
      // Assume it's a vector
      const vec = laggedValue as unknown as { x: number; y: number; z: number };
      const result = applyVectorNoise(vec, this.config, min, max);
      this.lastValidValue = result as unknown as T;
      return result as unknown as T;
    }

    return laggedValue;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getConfig(): NoiseConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<NoiseConfig>): void {
    Object.assign(this.config, updates);
    this.lagBuffer = new LagBuffer(this.config.lagMs, this.config.jitterMs);
  }

  reset(): void {
    this.lagBuffer.clear();
    this.drift.reset();
  }
}

/**
 * Global noise settings manager
 */
export interface NoiseSettings {
  enabled: boolean;
  realism: 'none' | 'low' | 'medium' | 'high' | 'extreme';
  customMultiplier: number;
}

const REALISM_MULTIPLIERS: Record<NoiseSettings['realism'], number> = {
  none: 0,
  low: 0.25,
  medium: 0.5,
  high: 1.0,
  extreme: 2.0,
};

let globalNoiseSettings: NoiseSettings = {
  enabled: true,
  realism: 'medium',
  customMultiplier: 1.0,
};

export function getNoiseSettings(): NoiseSettings {
  return { ...globalNoiseSettings };
}

export function setNoiseSettings(settings: Partial<NoiseSettings>): void {
  globalNoiseSettings = { ...globalNoiseSettings, ...settings };
}

export function getEffectiveMultiplier(): number {
  if (!globalNoiseSettings.enabled) return 0;
  return REALISM_MULTIPLIERS[globalNoiseSettings.realism] * globalNoiseSettings.customMultiplier;
}

/**
 * Quick noise application with global settings
 */
export function quickNoise(
  value: number,
  sensorType: string,
  min?: number,
  max?: number
): number {
  const multiplier = getEffectiveMultiplier();
  if (multiplier === 0) return value;

  const profile = NOISE_PROFILES[sensorType] || {};
  const scaledConfig: Partial<NoiseConfig> = {
    ...profile,
    enabled: true,
    gaussianStdDev: (profile.gaussianStdDev || 0) * multiplier,
    bias: (profile.bias || 0) * multiplier,
    dropoutProbability: (profile.dropoutProbability || 0) * multiplier,
    spikeProbability: (profile.spikeProbability || 0) * multiplier,
  };

  const result = applyNoise(value, scaledConfig, min, max);
  return isNaN(result) ? value : result;
}

export function quickBooleanNoise(value: boolean, sensorType: string): boolean {
  const multiplier = getEffectiveMultiplier();
  if (multiplier === 0) return value;

  const profile = NOISE_PROFILES[sensorType] || {};
  const scaledConfig: Partial<NoiseConfig> = {
    ...profile,
    enabled: true,
    dropoutProbability: (profile.dropoutProbability || 0) * multiplier,
    spikeProbability: (profile.spikeProbability || 0) * multiplier,
  };

  return applyBooleanNoise(value, scaledConfig);
}

export function quickVectorNoise(
  vector: { x: number; y: number; z: number },
  sensorType: string,
  min?: number,
  max?: number
): { x: number; y: number; z: number } {
  const multiplier = getEffectiveMultiplier();
  if (multiplier === 0) return vector;

  const profile = NOISE_PROFILES[sensorType] || {};
  const scaledConfig: Partial<NoiseConfig> = {
    ...profile,
    enabled: true,
    gaussianStdDev: (profile.gaussianStdDev || 0) * multiplier,
    bias: (profile.bias || 0) * multiplier,
  };

  return applyVectorNoise(vector, scaledConfig, min, max);
}
