/**
 * Transformers.js Integration for AI Features
 * Provides browser-based ML models for vision and NLP tasks
 */

import { pipeline, env, type PipelineType, type Pipeline } from '@huggingface/transformers';

// Configure transformers.js for browser use
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface ObjectDetectionResult {
  label: string;
  score: number;
  box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

export interface ImageClassificationResult {
  label: string;
  score: number;
}

export interface TextGenerationResult {
  generated_text: string;
}

export interface FeatureExtractionResult {
  embedding: number[];
}

// Cache for loaded pipelines
const pipelineCache = new Map<string, Pipeline>();

/**
 * Get or create a pipeline (cached)
 */
async function getPipeline(
  task: PipelineType,
  model?: string
): Promise<Pipeline> {
  const cacheKey = `${task}:${model || 'default'}`;

  if (pipelineCache.has(cacheKey)) {
    return pipelineCache.get(cacheKey)!;
  }

  const pipe = await pipeline(task, model);
  pipelineCache.set(cacheKey, pipe);
  return pipe;
}

/**
 * Object Detection using DETR
 * Detects objects in images useful for robot navigation and manipulation
 */
export async function detectObjects(
  image: HTMLImageElement | HTMLCanvasElement | ImageData | string,
  options?: { threshold?: number }
): Promise<ObjectDetectionResult[]> {
  const detector = await getPipeline(
    'object-detection',
    'Xenova/detr-resnet-50'
  );

  const results = await detector(image, {
    threshold: options?.threshold ?? 0.5,
  }) as {
    label: string;
    score: number;
    box: { xmin: number; ymin: number; xmax: number; ymax: number };
  }[];

  return results.map((r) => ({
    label: r.label,
    score: r.score,
    box: r.box,
  }));
}

/**
 * Image Classification using ViT
 * Classifies images for understanding scenes
 */
export async function classifyImage(
  image: HTMLImageElement | HTMLCanvasElement | ImageData | string,
  options?: { topK?: number }
): Promise<ImageClassificationResult[]> {
  const classifier = await getPipeline(
    'image-classification',
    'Xenova/vit-base-patch16-224'
  );

  const results = await classifier(image, {
    topk: options?.topK ?? 5,
  }) as { label: string; score: number }[];

  return results.map((r) => ({
    label: r.label,
    score: r.score,
  }));
}

/**
 * Zero-shot Image Classification
 * Classify images based on custom labels
 */
export async function classifyImageZeroShot(
  image: HTMLImageElement | HTMLCanvasElement | ImageData | string,
  candidateLabels: string[]
): Promise<ImageClassificationResult[]> {
  const classifier = await getPipeline(
    'zero-shot-image-classification',
    'Xenova/clip-vit-base-patch32'
  );

  const results = await classifier(image, candidateLabels) as { label: string; score: number }[];

  return results.map((r) => ({
    label: r.label,
    score: r.score,
  }));
}

/**
 * Image Feature Extraction
 * Extracts embeddings for similarity search and memory
 */
export async function extractImageFeatures(
  image: HTMLImageElement | HTMLCanvasElement | ImageData | string
): Promise<FeatureExtractionResult> {
  const extractor = await getPipeline(
    'feature-extraction',
    'Xenova/clip-vit-base-patch32'
  );

  const result = await extractor(image, { pooling: 'mean', normalize: true }) as { data: Float32Array };

  return {
    embedding: Array.from(result.data),
  };
}

/**
 * Text Feature Extraction
 * Extracts embeddings for text-image similarity
 */
export async function extractTextFeatures(
  text: string
): Promise<FeatureExtractionResult> {
  const extractor = await getPipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2'
  );

  const result = await extractor(text, { pooling: 'mean', normalize: true }) as { data: Float32Array };

  return {
    embedding: Array.from(result.data),
  };
}

/**
 * Depth Estimation using DPT
 * Estimates depth for 3D understanding
 */
export async function estimateDepth(
  image: HTMLImageElement | HTMLCanvasElement | ImageData | string
): Promise<ImageData> {
  const depthEstimator = await getPipeline(
    'depth-estimation',
    'Xenova/dpt-hybrid-midas'
  );

  const result = await depthEstimator(image) as { depth: ImageData };

  return result.depth;
}

/**
 * Image Segmentation
 * Segments images for understanding object boundaries
 */
export async function segmentImage(
  image: HTMLImageElement | HTMLCanvasElement | ImageData | string
): Promise<{ label: string; score: number; mask: ImageData }[]> {
  const segmenter = await getPipeline(
    'image-segmentation',
    'Xenova/detr-resnet-50-panoptic'
  );

  const results = await segmenter(image) as { label: string; score: number; mask: ImageData }[];

  return results;
}

/**
 * Text-to-Text Generation for command interpretation
 */
export async function interpretCommand(
  command: string,
  context?: string
): Promise<string> {
  const generator = await getPipeline(
    'text2text-generation',
    'Xenova/flan-t5-small'
  );

  const prompt = context
    ? `Context: ${context}\nCommand: ${command}\nInterpret this robot command:`
    : `Interpret this robot command: ${command}`;

  const result = await generator(prompt, {
    max_new_tokens: 100,
  }) as { generated_text: string }[];

  return result[0]?.generated_text || '';
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find most similar items from a collection
 */
export function findSimilar(
  query: number[],
  candidates: { id: string; embedding: number[] }[],
  topK = 5
): { id: string; score: number }[] {
  const scored = candidates.map((c) => ({
    id: c.id,
    score: cosineSimilarity(query, c.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * Preload commonly used models
 */
export async function preloadModels(
  onProgress?: (model: string, progress: number) => void
): Promise<void> {
  const models: [string, string][] = [
    ['object-detection', 'Xenova/detr-resnet-50'],
    ['image-classification', 'Xenova/vit-base-patch16-224'],
  ];

  for (const [task, model] of models) {
    onProgress?.(model, 0);
    await getPipeline(task as PipelineType, model);
    onProgress?.(model, 100);
  }
}

/**
 * Clear cached pipelines to free memory
 */
export function clearCache(): void {
  pipelineCache.clear();
}

/**
 * Get list of loaded models
 */
export function getLoadedModels(): string[] {
  return Array.from(pipelineCache.keys());
}
