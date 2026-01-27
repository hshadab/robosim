/**
 * CSM (Common Sense Machines) Provider
 *
 * Adapts the existing csmImageTo3D module to the ImageTo3DProvider interface.
 */

import type { ImageTo3DProvider, ProviderConfig, ImageTo3DRequest, Generated3DResult } from './types';
import {
  generateTrainableObject,
  validateCSMApiKey,
  type CSMConfig,
} from '../csmImageTo3D';

export const csmProvider: ImageTo3DProvider = {
  name: 'csm',

  async generate(config: ProviderConfig, request: ImageTo3DRequest): Promise<Generated3DResult> {
    const csmConfig: CSMConfig = { apiKey: config.apiKey };
    const imageSource = typeof request.imageSource === 'string'
      ? request.imageSource
      : '';
    const object = await generateTrainableObject(csmConfig, {
      imageSource,
      objectName: request.objectName,
      scaledBbox: request.scaledBbox,
    });

    return {
      meshUrl: object.meshUrl || '',
      object,
    };
  },

  async validateApiKey(apiKey: string): Promise<boolean> {
    return validateCSMApiKey(apiKey);
  },
};
