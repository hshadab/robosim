/**
 * Rodin (Hyper3D) Provider
 *
 * Adapts the existing rodinImageTo3D module to the ImageTo3DProvider interface.
 */

import type { ImageTo3DProvider, ProviderConfig, ImageTo3DRequest, Generated3DResult, JobStatusResult } from './types';
import {
  createRodinSession,
  waitForSession,
  generateTrainableObject,
  validateRodinApiKey,
  type RodinConfig,
} from '../rodinImageTo3D';

export const rodinProvider: ImageTo3DProvider = {
  name: 'rodin',

  async generate(config: ProviderConfig, request: ImageTo3DRequest): Promise<Generated3DResult> {
    const rodinConfig: RodinConfig = { apiKey: config.apiKey };
    const object = await generateTrainableObject(rodinConfig, {
      imageSource: request.imageSource,
      objectName: request.objectName,
      scaledBbox: request.scaledBbox,
    });

    return {
      meshUrl: object.meshUrl || '',
      object,
    };
  },

  async validateApiKey(apiKey: string): Promise<boolean> {
    return validateRodinApiKey(apiKey);
  },
};
