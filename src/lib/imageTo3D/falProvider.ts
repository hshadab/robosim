/**
 * fal.ai TripoSR Provider
 *
 * Adapts the existing falImageTo3D module to the ImageTo3DProvider interface.
 */

import type { ImageTo3DProvider, ProviderConfig, ImageTo3DRequest, Generated3DResult } from './types';
import {
  generateTrainableObject,
  validateFalApiKey,
  type FalConfig,
} from '../falImageTo3D';

export const falProvider: ImageTo3DProvider = {
  name: 'fal',

  async generate(config: ProviderConfig, request: ImageTo3DRequest): Promise<Generated3DResult> {
    const falConfig: FalConfig = { apiKey: config.apiKey };
    const object = await generateTrainableObject(falConfig, {
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
    return validateFalApiKey(apiKey);
  },
};
