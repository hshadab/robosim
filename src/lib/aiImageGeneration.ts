/**
 * AI Image Generation Service
 *
 * Integrates with Google Gemini (Nano Banana) API to generate:
 * - Scene backgrounds/skyboxes
 * - Object textures
 * - Floor/wall textures
 * - Interactive object appearances
 */

import type { Vector3D } from '../types';
import { generateSecureId } from './crypto';

// API Configuration
export interface AIImageConfig {
  provider: 'gemini' | 'openai' | 'stability';
  apiKey: string;
  model?: string;
}

// Generated image result
export interface GeneratedImage {
  url: string;           // Data URL or blob URL
  prompt: string;
  width: number;
  height: number;
  timestamp: number;
}

// Object generation request
export interface AIObjectRequest {
  type: 'cube' | 'sphere' | 'cylinder' | 'custom';
  description: string;   // "red apple", "cardboard box", "metal can"
  style?: 'realistic' | 'cartoon' | 'pixel' | 'painterly';
  size?: Vector3D;
}

// Background generation request
export interface AIBackgroundRequest {
  description: string;   // "industrial warehouse", "outdoor garden", "space station"
  style?: 'realistic' | 'cartoon' | 'abstract' | 'minimalist';
  mood?: 'bright' | 'dark' | 'warm' | 'cool';
  panoramic?: boolean;   // Generate 360 panorama for skybox
}

// Texture generation request
export interface AITextureRequest {
  surface: 'floor' | 'wall' | 'ceiling' | 'custom';
  description: string;   // "concrete", "wooden planks", "metal grating"
  style?: 'realistic' | 'stylized';
  seamless?: boolean;    // Tileable texture
}

// Default configuration
let globalConfig: AIImageConfig = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.0-flash-exp',
};

/**
 * Configure the AI image generation service
 */
export function configureAIImageService(config: Partial<AIImageConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current configuration
 */
export function getAIImageConfig(): AIImageConfig {
  return { ...globalConfig };
}

/**
 * Check if the service is configured
 */
export function isAIImageServiceConfigured(): boolean {
  return globalConfig.apiKey.length > 0;
}

/**
 * Generate an image using Gemini API
 */
async function generateWithGemini(prompt: string, aspectRatio = '1:1'): Promise<GeneratedImage> {
  const apiKey = globalConfig.apiKey;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${globalConfig.model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        responseMimeType: 'text/plain',
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();

  // Extract image from response
  const candidates = data.candidates || [];
  if (candidates.length === 0) {
    throw new Error('No image generated');
  }

  const parts = candidates[0].content?.parts || [];
  const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith('image/'));

  if (!imagePart?.inlineData) {
    throw new Error('No image in response');
  }

  const { mimeType, data: base64Data } = imagePart.inlineData;
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  // Determine dimensions from aspect ratio
  const [w, h] = aspectRatio.split(':').map(Number);
  const baseSize = 512;
  const width = baseSize;
  const height = Math.round(baseSize * (h / w));

  return {
    url: dataUrl,
    prompt,
    width,
    height,
    timestamp: Date.now(),
  };
}

/**
 * Generate a background/environment image
 */
export async function generateBackground(request: AIBackgroundRequest): Promise<GeneratedImage> {
  const styleMap = {
    realistic: 'photorealistic, high detail, professional photography',
    cartoon: 'cartoon style, vibrant colors, cel shaded',
    abstract: 'abstract art, geometric shapes, modern design',
    minimalist: 'minimalist, clean, simple shapes, neutral colors',
  };

  const moodMap = {
    bright: 'bright lighting, sunny, cheerful atmosphere',
    dark: 'dark, moody, dramatic shadows',
    warm: 'warm tones, golden hour lighting, cozy',
    cool: 'cool tones, blue hour, calm atmosphere',
  };

  const style = styleMap[request.style || 'realistic'];
  const mood = moodMap[request.mood || 'bright'];

  let prompt = `Generate a ${request.description} background image for a robotics simulation. ${style}. ${mood}.`;

  if (request.panoramic) {
    prompt += ' Create as a seamless 360-degree panoramic environment.';
  } else {
    prompt += ' Wide angle view suitable for a 3D scene backdrop.';
  }

  prompt += ' No text, no watermarks, clean professional render.';

  return generateWithGemini(prompt, request.panoramic ? '2:1' : '16:9');
}

/**
 * Generate a texture for surfaces
 */
export async function generateTexture(request: AITextureRequest): Promise<GeneratedImage> {
  const surfaceContext = {
    floor: 'floor surface, top-down view',
    wall: 'wall surface, front view',
    ceiling: 'ceiling surface, bottom-up view',
    custom: 'surface texture',
  };

  let prompt = `Generate a ${request.description} texture for a ${surfaceContext[request.surface]}.`;

  if (request.seamless) {
    prompt += ' Must be seamlessly tileable with matching edges.';
  }

  if (request.style === 'realistic') {
    prompt += ' Photorealistic, high resolution, detailed texture.';
  } else {
    prompt += ' Stylized, game-ready texture.';
  }

  prompt += ' No text, no watermarks, pure texture only.';

  return generateWithGemini(prompt, '1:1');
}

/**
 * Generate a texture for an interactive object
 */
export async function generateObjectTexture(request: AIObjectRequest): Promise<GeneratedImage> {
  const typeContext = {
    cube: 'cube-shaped object, box',
    sphere: 'spherical object, ball',
    cylinder: 'cylindrical object, can or tube',
    custom: 'object',
  };

  const styleMap = {
    realistic: 'photorealistic, detailed, physically accurate materials',
    cartoon: 'cartoon style, bold outlines, vibrant colors',
    pixel: 'pixel art style, retro game aesthetic',
    painterly: 'painted style, artistic brush strokes',
  };

  const style = styleMap[request.style || 'realistic'];

  const prompt = `Generate a texture map for a ${request.description} ${typeContext[request.type]}. ${style}.
    The texture should wrap around a 3D ${request.type}.
    Clean, game-ready asset. No background, just the object texture.
    No text, no watermarks.`;

  return generateWithGemini(prompt, '1:1');
}

/**
 * Generate multiple object textures at once
 */
export async function generateObjectSet(
  descriptions: string[],
  style: AIObjectRequest['style'] = 'realistic'
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];

  for (const desc of descriptions) {
    try {
      const image = await generateObjectTexture({
        type: 'cube',
        description: desc,
        style,
      });
      results.push(image);
    } catch (error) {
      console.error(`Failed to generate texture for "${desc}":`, error);
    }
  }

  return results;
}

// Cache for generated images
const imageCache = new Map<string, GeneratedImage>();

/**
 * Get a cached image or generate a new one
 */
export async function getCachedOrGenerate(
  cacheKey: string,
  generator: () => Promise<GeneratedImage>
): Promise<GeneratedImage> {
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  const image = await generator();
  imageCache.set(cacheKey, image);
  return image;
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}

/**
 * Preset environment themes
 */
export const ENVIRONMENT_PRESETS = {
  warehouse: {
    description: 'industrial warehouse interior with metal shelving, concrete floors, high ceilings',
    style: 'realistic' as const,
    mood: 'cool' as const,
  },
  garden: {
    description: 'outdoor garden with grass, flowers, trees, blue sky',
    style: 'realistic' as const,
    mood: 'bright' as const,
  },
  laboratory: {
    description: 'modern robotics laboratory with white walls, equipment, screens',
    style: 'realistic' as const,
    mood: 'cool' as const,
  },
  space: {
    description: 'space station interior with windows showing Earth, futuristic design',
    style: 'realistic' as const,
    mood: 'dark' as const,
  },
  cartoon_workshop: {
    description: 'colorful cartoon workshop with tools, workbenches, friendly atmosphere',
    style: 'cartoon' as const,
    mood: 'bright' as const,
  },
  abstract_void: {
    description: 'abstract geometric space with floating shapes, gradient colors',
    style: 'abstract' as const,
    mood: 'cool' as const,
  },
};

/**
 * Preset object collections for different scenarios
 */
export const OBJECT_PRESETS = {
  warehouse_items: [
    'cardboard shipping box',
    'wooden pallet',
    'plastic storage bin',
    'metal drum barrel',
  ],
  food_items: [
    'red apple',
    'orange fruit',
    'yellow banana',
    'green cucumber',
  ],
  workshop_tools: [
    'red screwdriver',
    'silver wrench',
    'yellow measuring tape',
    'blue pliers',
  ],
  toys: [
    'red rubber ball',
    'wooden building block',
    'colorful stacking ring',
    'small toy car',
  ],
};

/**
 * AI-generated interactive object definition
 */
export interface AIGeneratedObject {
  id: string;
  name: string;
  type: 'cube' | 'sphere' | 'cylinder';
  texture: GeneratedImage;
  position: Vector3D;
  size: Vector3D;
  isGrabbable: boolean;
  physicsEnabled: boolean;
}

/**
 * Create an AI-generated interactive object
 */
export async function createAIObject(
  name: string,
  description: string,
  options: {
    type?: 'cube' | 'sphere' | 'cylinder';
    position?: Vector3D;
    size?: Vector3D;
    style?: AIObjectRequest['style'];
    grabbable?: boolean;
  } = {}
): Promise<AIGeneratedObject> {
  const texture = await generateObjectTexture({
    type: options.type || 'cube',
    description,
    style: options.style || 'realistic',
  });

  return {
    id: generateSecureId('ai_obj'),
    name,
    type: options.type || 'cube',
    texture,
    position: options.position || { x: 0, y: 0.1, z: 0.2 },
    size: options.size || { x: 0.05, y: 0.05, z: 0.05 },
    isGrabbable: options.grabbable ?? true,
    physicsEnabled: true,
  };
}
