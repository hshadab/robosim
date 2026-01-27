/**
 * Image-to-3D Provider Manager
 *
 * Registry and dispatcher for image-to-3D generation providers.
 */

import type { ImageTo3DProvider, ProviderConfig, ImageTo3DRequest, Generated3DResult } from './types';
import { rodinProvider } from './rodinProvider';
import { csmProvider } from './csmProvider';
import { falProvider } from './falProvider';

const providers = new Map<string, ImageTo3DProvider>();

// Register built-in providers
providers.set('rodin', rodinProvider);
providers.set('csm', csmProvider);
providers.set('fal', falProvider);

/**
 * Register a custom provider
 */
export function registerProvider(provider: ImageTo3DProvider): void {
  providers.set(provider.name, provider);
}

/**
 * Get a registered provider by name
 */
export function getProvider(name: string): ImageTo3DProvider | undefined {
  return providers.get(name);
}

/**
 * List all registered provider names
 */
export function listProviders(): string[] {
  return [...providers.keys()];
}

/**
 * Generate a 3D model using the specified provider
 */
export async function generate(
  providerName: string,
  config: ProviderConfig,
  request: ImageTo3DRequest
): Promise<Generated3DResult> {
  const provider = providers.get(providerName);
  if (!provider) {
    throw new Error(`Unknown image-to-3D provider: "${providerName}". Available: ${listProviders().join(', ')}`);
  }
  return provider.generate(config, request);
}

/**
 * Validate an API key for the specified provider
 */
export async function validateApiKey(providerName: string, apiKey: string): Promise<boolean> {
  const provider = providers.get(providerName);
  if (!provider?.validateApiKey) {
    return false;
  }
  return provider.validateApiKey(apiKey);
}
