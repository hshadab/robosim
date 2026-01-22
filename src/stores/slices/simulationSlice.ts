/**
 * Simulation State Slice
 *
 * Manages simulation status, FPS, elapsed time, sensors, and sensor visualization.
 * This slice has no dependencies on other slices.
 */

import type { StateCreator } from 'zustand';
import type { SimulationState, SensorReading, SensorVisualization } from '../../types';

export interface SimulationSliceState {
  simulation: SimulationState;
  sensors: SensorReading;
  sensorVisualization: SensorVisualization;
}

export interface SimulationSliceActions {
  setSimulationStatus: (status: SimulationState['status']) => void;
  setSensors: (sensors: Partial<SensorReading>) => void;
  setSensorVisualization: (viz: Partial<SensorVisualization>) => void;
}

export type SimulationSlice = SimulationSliceState & SimulationSliceActions;

export const getDefaultSimulationState = (): SimulationSliceState => ({
  simulation: {
    status: 'idle',
    fps: 60,
    elapsedTime: 0,
  },
  sensors: {
    ultrasonic: 25.0,
    leftIR: false,
    centerIR: false,
    rightIR: false,
    leftMotor: 0,
    rightMotor: 0,
    battery: 100,
  },
  sensorVisualization: {
    showUltrasonicBeam: false,
    showIRIndicators: false,
    showDistanceLabels: false,
  },
});

export const createSimulationSlice: StateCreator<
  SimulationSlice,
  [],
  [],
  SimulationSlice
> = (set) => ({
  ...getDefaultSimulationState(),

  setSimulationStatus: (status: SimulationState['status']) =>
    set((state) => ({
      simulation: { ...state.simulation, status },
    })),

  setSensors: (sensors: Partial<SensorReading>) =>
    set((state) => ({
      sensors: { ...state.sensors, ...sensors },
    })),

  setSensorVisualization: (viz: Partial<SensorVisualization>) =>
    set((state) => ({
      sensorVisualization: { ...state.sensorVisualization, ...viz },
    })),
});
