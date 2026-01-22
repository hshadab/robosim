/**
 * Gripper State Slice
 *
 * Manages gripper world position, orientation, and minimum gripper value.
 * This slice has no dependencies on other slices for basic state,
 * but the collision detection in the main store reads objects.
 */

import type { StateCreator } from 'zustand';

export interface GripperSliceState {
  // Gripper world position - updated from Three.js scene each frame
  gripperWorldPosition: [number, number, number];
  // Gripper world quaternion - updated from Three.js scene each frame (for orientation-aware grab)
  gripperWorldQuaternion: [number, number, number, number]; // [x, y, z, w]
  // Gripper minimum value - when holding an object, gripper can't close past this
  gripperMinValue: number | null;
}

export interface GripperSliceActions {
  setGripperWorldPosition: (position: [number, number, number]) => void;
  setGripperWorldQuaternion: (quaternion: [number, number, number, number]) => void;
  setGripperMinValue: (value: number | null) => void;
}

export type GripperSlice = GripperSliceState & GripperSliceActions;

export const getDefaultGripperState = (): GripperSliceState => ({
  gripperWorldPosition: [0, 0.15, 0], // Default gripper position
  gripperWorldQuaternion: [0, 0, 0, 1], // Identity quaternion
  gripperMinValue: null, // Minimum gripper value when holding object
});

export const createGripperSlice: StateCreator<
  GripperSlice,
  [],
  [],
  GripperSlice
> = (set) => ({
  ...getDefaultGripperState(),

  setGripperWorldPosition: (position: [number, number, number]) => {
    set({ gripperWorldPosition: position });
  },

  setGripperWorldQuaternion: (quaternion: [number, number, number, number]) => {
    set({ gripperWorldQuaternion: quaternion });
  },

  setGripperMinValue: (value: number | null) => {
    set({ gripperMinValue: value });
  },
});
