/**
 * Data Recorder Hook
 * Records time-series data for plotting with ring buffer
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { PlotDataPoint, PlotSeries, PlotConfig } from '../types';

const DEFAULT_CONFIG: PlotConfig = {
  enabled: true,
  maxDataPoints: 200,     // Keep last 200 points
  updateInterval: 50,     // 50ms = 20Hz update rate
  timeWindow: 10000,      // 10 second window
};

// Ring buffer for efficient data storage
class RingBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private size: number = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  toArray(): T[] {
    if (this.size === 0) return [];

    const result: T[] = new Array(this.size);
    const start = this.size < this.capacity ? 0 : this.head;

    for (let i = 0; i < this.size; i++) {
      result[i] = this.buffer[(start + i) % this.capacity];
    }

    return result;
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }
}

// Series definitions
interface SeriesDefinition {
  id: string;
  label: string;
  color: string;
  getValue: (state: ReturnType<typeof useAppStore.getState>) => number;
}

const JOINT_SERIES: SeriesDefinition[] = [
  {
    id: 'base',
    label: 'Base',
    color: '#ef4444',
    getValue: (state) => state.joints.base,
  },
  {
    id: 'shoulder',
    label: 'Shoulder',
    color: '#22c55e',
    getValue: (state) => state.joints.shoulder,
  },
  {
    id: 'elbow',
    label: 'Elbow',
    color: '#3b82f6',
    getValue: (state) => state.joints.elbow,
  },
  {
    id: 'wrist',
    label: 'Wrist',
    color: '#a855f7',
    getValue: (state) => state.joints.wrist,
  },
  {
    id: 'gripper',
    label: 'Gripper',
    color: '#f97316',
    getValue: (state) => state.joints.gripper,
  },
];

const SENSOR_SERIES: SeriesDefinition[] = [
  {
    id: 'ultrasonic',
    label: 'Ultrasonic',
    color: '#06b6d4',
    getValue: (state) => state.sensors.ultrasonic ?? 0,
  },
  {
    id: 'temperature',
    label: 'Temperature',
    color: '#f43f5e',
    getValue: (state) => state.sensors.temperature ?? 25,
  },
  {
    id: 'battery',
    label: 'Battery',
    color: '#84cc16',
    getValue: (state) => state.sensors.battery ?? 100,
  },
  {
    id: 'accel_y',
    label: 'Accel Y',
    color: '#14b8a6',
    getValue: (state) => state.sensors.accelerometer?.y ?? 0,
  },
];

export type RecorderMode = 'joints' | 'sensors' | 'all';

export const useDataRecorder = (
  mode: RecorderMode = 'joints',
  config: Partial<PlotConfig> = {}
) => {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Create ring buffers for each series
  const buffersRef = useRef<Map<string, RingBuffer<PlotDataPoint>>>(new Map());
  const startTimeRef = useRef(Date.now());
  const [series, setSeries] = useState<PlotSeries[]>([]);

  // Get active series definitions
  const getSeriesDefinitions = useCallback((): SeriesDefinition[] => {
    switch (mode) {
      case 'joints':
        return JOINT_SERIES;
      case 'sensors':
        return SENSOR_SERIES;
      case 'all':
        return [...JOINT_SERIES, ...SENSOR_SERIES];
    }
  }, [mode]);

  // Initialize buffers
  useEffect(() => {
    const definitions = getSeriesDefinitions();
    buffersRef.current.clear();

    definitions.forEach((def) => {
      buffersRef.current.set(def.id, new RingBuffer(fullConfig.maxDataPoints));
    });

    // Initialize series state
    setSeries(
      definitions.map((def) => ({
        id: def.id,
        label: def.label,
        color: def.color,
        data: [],
        visible: true,
      }))
    );

    startTimeRef.current = Date.now();
  }, [mode, fullConfig.maxDataPoints, getSeriesDefinitions]);

  // Record data point
  const recordPoint = useCallback(() => {
    if (!fullConfig.enabled) return;

    const state = useAppStore.getState();
    const now = Date.now();
    const time = now - startTimeRef.current;
    const definitions = getSeriesDefinitions();

    definitions.forEach((def) => {
      const buffer = buffersRef.current.get(def.id);
      if (buffer) {
        buffer.push({
          time,
          value: def.getValue(state),
        });
      }
    });

    // Update series state
    setSeries((prev) =>
      prev.map((s) => {
        const buffer = buffersRef.current.get(s.id);
        return {
          ...s,
          data: buffer ? buffer.toArray() : [],
        };
      })
    );
  }, [fullConfig.enabled, getSeriesDefinitions]);

  // Toggle series visibility
  const toggleSeries = useCallback((seriesId: string) => {
    setSeries((prev) =>
      prev.map((s) =>
        s.id === seriesId ? { ...s, visible: !s.visible } : s
      )
    );
  }, []);

  // Clear all data
  const clearData = useCallback(() => {
    buffersRef.current.forEach((buffer) => buffer.clear());
    startTimeRef.current = Date.now();
    setSeries((prev) => prev.map((s) => ({ ...s, data: [] })));
  }, []);

  // Start recording
  useEffect(() => {
    if (!fullConfig.enabled) return;

    const interval = setInterval(recordPoint, fullConfig.updateInterval);
    return () => clearInterval(interval);
  }, [fullConfig.enabled, fullConfig.updateInterval, recordPoint]);

  return {
    series,
    config: fullConfig,
    toggleSeries,
    clearData,
  };
};

export { JOINT_SERIES, SENSOR_SERIES };
