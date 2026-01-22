/**
 * UI State Slice
 *
 * Manages user interface preferences and control modes.
 * This slice has no dependencies on other slices.
 */

import type { StateCreator } from 'zustand';
import type { SkillLevel } from '../../types';

export interface UIState {
  // User preferences
  skillLevel: SkillLevel;

  // Control mode
  controlMode: 'manual' | 'click-to-move' | 'keyboard' | 'gamepad';

  // Visibility toggles
  showWorkspace: boolean;
  showGripperDebug: boolean;
}

export interface UIActions {
  setSkillLevel: (level: SkillLevel) => void;
  setControlMode: (mode: 'manual' | 'click-to-move' | 'keyboard' | 'gamepad') => void;
  setShowWorkspace: (show: boolean) => void;
  setShowGripperDebug: (show: boolean) => void;
}

export type UISlice = UIState & UIActions;

export const getDefaultUIState = (): UIState => ({
  skillLevel: 'prompter',
  controlMode: 'manual',
  showWorkspace: false,
  showGripperDebug: true, // Enable gripper debug visualization by default
});

export const createUISlice: StateCreator<
  UISlice,
  [],
  [],
  UISlice
> = (set) => ({
  ...getDefaultUIState(),

  setSkillLevel: (level: SkillLevel) => set({ skillLevel: level }),

  setControlMode: (mode: 'manual' | 'click-to-move' | 'keyboard' | 'gamepad') =>
    set({ controlMode: mode }),

  setShowWorkspace: (show: boolean) => set({ showWorkspace: show }),

  setShowGripperDebug: (show: boolean) => set({ showGripperDebug: show }),
});
