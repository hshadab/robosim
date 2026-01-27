/**
 * Image-to-3D Module
 *
 * Unified provider system for image-to-3D generation.
 */

export type {
  ImageTo3DProvider,
  ImageTo3DRequest,
  ProviderConfig,
  Generated3DResult,
  JobStatus,
  JobStatusResult,
  Generated3DObject,
  GraspPoint,
  PhysicsConfig,
} from './types';

export { rodinProvider } from './rodinProvider';
export { csmProvider } from './csmProvider';
export { falProvider } from './falProvider';

export {
  registerProvider,
  getProvider,
  listProviders,
  generate,
  validateApiKey,
} from './manager';
