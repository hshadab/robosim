/**
 * Environment State Slice
 *
 * Manages environment objects, target zones, and environment selection.
 * This slice has no dependencies on other slices.
 */

import type { StateCreator } from 'zustand';
import type { EnvironmentType, SimObject, TargetZone } from '../../types';
import {
  DEFAULT_ENVIRONMENT,
  getEnvironmentObjects,
  getEnvironmentTargetZones,
} from '../../config/environments';
import { generateSecureId } from '../../lib/crypto';

export interface EnvironmentSliceState {
  currentEnvironment: EnvironmentType;
  objects: SimObject[];
  targetZones: TargetZone[];
}

export interface EnvironmentSliceActions {
  setEnvironment: (envId: EnvironmentType) => void;
  spawnObject: (obj: Omit<SimObject, 'id'>) => void;
  removeObject: (objId: string) => void;
  updateObject: (objId: string, updates: Partial<SimObject>) => void;
  clearObjects: () => void;
}

export type EnvironmentSlice = EnvironmentSliceState & EnvironmentSliceActions;

export const getDefaultEnvironmentState = (): EnvironmentSliceState => {
  const defaultEnv = DEFAULT_ENVIRONMENT as EnvironmentType;
  return {
    currentEnvironment: defaultEnv,
    objects: getEnvironmentObjects(defaultEnv),
    targetZones: getEnvironmentTargetZones(defaultEnv),
  };
};

export const createEnvironmentSlice: StateCreator<
  EnvironmentSlice,
  [],
  [],
  EnvironmentSlice
> = (set) => ({
  ...getDefaultEnvironmentState(),

  setEnvironment: (envId: EnvironmentType) => {
    const objects = getEnvironmentObjects(envId);
    const targetZones = getEnvironmentTargetZones(envId);
    set({
      currentEnvironment: envId,
      objects,
      targetZones,
    });
  },

  spawnObject: (obj: Omit<SimObject, 'id'>) => {
    const newObj: SimObject = {
      ...obj,
      id: generateSecureId('obj'),
    };
    set((state) => ({
      objects: [...state.objects, newObj],
    }));
  },

  removeObject: (objId: string) => {
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== objId),
    }));
  },

  updateObject: (objId: string, updates: Partial<SimObject>) => {
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === objId ? { ...o, ...updates } : o
      ),
    }));
  },

  clearObjects: () => {
    set({ objects: [] });
  },
});
