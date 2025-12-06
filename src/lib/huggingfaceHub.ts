/**
 * HuggingFace Hub Integration for LeRobot Policies
 *
 * Enables browsing, downloading, and loading trained policies
 * from HuggingFace Hub for the SO-101 robot arm.
 */

// Types for HuggingFace Hub API responses
export interface HFModel {
  id: string;
  modelId: string;
  author: string;
  sha: string;
  lastModified: string;
  private: boolean;
  downloads: number;
  likes: number;
  tags: string[];
  library_name?: string;
  pipeline_tag?: string;
}

export interface HFModelInfo {
  id: string;
  author: string;
  sha: string;
  lastModified: string;
  siblings: HFFile[];
  tags: string[];
  downloads: number;
  likes: number;
  cardData?: {
    license?: string;
    datasets?: string[];
    metrics?: Record<string, number>;
    model_name?: string;
    task_name?: string;
    tags?: string[];
  };
}

export interface HFFile {
  rfilename: string;
  size?: number;
  blobId?: string;
  lfs?: {
    sha256: string;
    size: number;
    pointer_size: number;
  };
}

// LeRobot-specific policy metadata
export interface LeRobotPolicyMeta {
  modelId: string;
  author: string;
  policyType: 'act' | 'diffusion' | 'tdmpc' | 'vqbet' | 'unknown';
  robotType: string;
  taskName?: string;
  checkpoint?: string;
  downloads: number;
  likes: number;
  lastModified: string;
  hasOnnx: boolean;
  hasSafetensors: boolean;
  configUrl?: string;
  description?: string;
}

export interface PolicyConfig {
  policy: {
    name: string;
    chunk_size?: number;
    n_action_steps?: number;
    input_shapes?: Record<string, number[]>;
    output_shapes?: Record<string, number[]>;
  };
  training?: {
    dataset_repo_id?: string;
    num_epochs?: number;
    batch_size?: number;
  };
}

export type DownloadProgressCallback = (progress: number, message: string) => void;

// HuggingFace Hub API base URL
const HF_API_BASE = 'https://huggingface.co/api';
const HF_MODEL_BASE = 'https://huggingface.co';

// Cache for downloaded files
const fileCache = new Map<string, ArrayBuffer>();

/**
 * Search HuggingFace Hub for LeRobot policies compatible with SO-101
 */
export async function searchLeRobotPolicies(
  query?: string,
  limit = 50
): Promise<LeRobotPolicyMeta[]> {
  // Search for models with lerobot tag and optionally so-101/so101
  const searchTerms = ['lerobot'];
  if (query) {
    searchTerms.push(query);
  }

  const searchQuery = encodeURIComponent(searchTerms.join(' '));
  const url = `${HF_API_BASE}/models?search=${searchQuery}&limit=${limit}&sort=downloads&direction=-1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const models: HFModel[] = await response.json();

    // Filter and transform to LeRobotPolicyMeta
    const policies: LeRobotPolicyMeta[] = [];

    for (const model of models) {
      // Check if it's a LeRobot model
      const isLeRobot = model.tags?.some(tag =>
        tag.toLowerCase().includes('lerobot') ||
        tag.toLowerCase() === 'robotics'
      );

      if (!isLeRobot) continue;

      // Determine policy type from tags or model ID
      const policyType = detectPolicyType(model.id, model.tags || []);

      // Determine robot type
      const robotType = detectRobotType(model.id, model.tags || []);

      policies.push({
        modelId: model.id,
        author: model.author || model.id.split('/')[0],
        policyType,
        robotType,
        downloads: model.downloads || 0,
        likes: model.likes || 0,
        lastModified: model.lastModified,
        hasOnnx: false, // Will be determined by getModelInfo
        hasSafetensors: false,
      });
    }

    return policies;
  } catch (error) {
    console.error('Failed to search HuggingFace Hub:', error);
    throw error;
  }
}

/**
 * Get detailed model information including file list
 */
export async function getModelInfo(modelId: string): Promise<HFModelInfo> {
  const url = `${HF_API_BASE}/models/${modelId}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get model info: ${response.status}`);
  }

  return response.json();
}

/**
 * Get LeRobot policy metadata with file information
 */
export async function getPolicyDetails(modelId: string): Promise<LeRobotPolicyMeta> {
  const info = await getModelInfo(modelId);

  const files = info.siblings || [];
  const hasOnnx = files.some(f => f.rfilename.endsWith('.onnx'));
  const hasSafetensors = files.some(f => f.rfilename.endsWith('.safetensors'));
  const hasConfig = files.some(f =>
    f.rfilename === 'config.yaml' ||
    f.rfilename === 'config.json' ||
    f.rfilename.includes('config')
  );

  // Find checkpoint files
  const checkpointFile = files.find(f =>
    f.rfilename.includes('checkpoint') ||
    f.rfilename.endsWith('.safetensors') ||
    f.rfilename.endsWith('.pt') ||
    f.rfilename.endsWith('.pth')
  );

  // Determine policy type
  const policyType = detectPolicyType(modelId, info.tags || []);
  const robotType = detectRobotType(modelId, info.tags || []);

  // Extract task name from card data
  const taskName = info.cardData?.task_name ||
    info.cardData?.datasets?.[0]?.split('/')?.[1] ||
    extractTaskFromId(modelId);

  return {
    modelId: info.id,
    author: info.author,
    policyType,
    robotType,
    taskName,
    checkpoint: checkpointFile?.rfilename,
    downloads: info.downloads || 0,
    likes: info.likes || 0,
    lastModified: info.lastModified,
    hasOnnx,
    hasSafetensors,
    configUrl: hasConfig ? `${HF_MODEL_BASE}/${modelId}/raw/main/config.yaml` : undefined,
    description: info.cardData?.model_name,
  };
}

/**
 * Download a file from HuggingFace Hub
 */
export async function downloadFile(
  modelId: string,
  filename: string,
  onProgress?: DownloadProgressCallback
): Promise<ArrayBuffer> {
  const cacheKey = `${modelId}/${filename}`;

  // Check cache first
  if (fileCache.has(cacheKey)) {
    onProgress?.(100, 'Loaded from cache');
    return fileCache.get(cacheKey)!;
  }

  const url = `${HF_MODEL_BASE}/${modelId}/resolve/main/${filename}`;

  onProgress?.(0, `Downloading ${filename}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${filename}: ${response.status}`);
  }

  // Track download progress
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (total > 0 && response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      received += value.length;

      const progress = Math.round((received / total) * 100);
      onProgress?.(progress, `Downloading ${filename}... ${formatBytes(received)}/${formatBytes(total)}`);
    }

    // Combine chunks
    const buffer = new ArrayBuffer(received);
    const view = new Uint8Array(buffer);
    let offset = 0;
    for (const chunk of chunks) {
      view.set(chunk, offset);
      offset += chunk.length;
    }

    // Cache the result
    fileCache.set(cacheKey, buffer);

    onProgress?.(100, 'Download complete');
    return buffer;
  }

  // Fallback for responses without content-length
  const buffer = await response.arrayBuffer();
  fileCache.set(cacheKey, buffer);
  onProgress?.(100, 'Download complete');
  return buffer;
}

/**
 * Download policy config file
 */
export async function downloadPolicyConfig(
  modelId: string,
  onProgress?: DownloadProgressCallback
): Promise<PolicyConfig | null> {
  const configFiles = ['config.yaml', 'config.json', 'training_config.yaml'];

  for (const configFile of configFiles) {
    try {
      const buffer = await downloadFile(modelId, configFile, onProgress);
      const text = new TextDecoder().decode(buffer);

      if (configFile.endsWith('.yaml')) {
        // Simple YAML parsing for common config structure
        return parseSimpleYaml(text);
      } else {
        return JSON.parse(text);
      }
    } catch {
      // Try next config file
      continue;
    }
  }

  return null;
}

/**
 * Download ONNX model file
 */
export async function downloadOnnxModel(
  modelId: string,
  onProgress?: DownloadProgressCallback
): Promise<ArrayBuffer | null> {
  const info = await getModelInfo(modelId);
  const files = info.siblings || [];

  // Find ONNX file
  const onnxFile = files.find(f => f.rfilename.endsWith('.onnx'));
  if (!onnxFile) {
    return null;
  }

  return downloadFile(modelId, onnxFile.rfilename, onProgress);
}

/**
 * List available ONNX models for a policy
 */
export async function listOnnxModels(modelId: string): Promise<string[]> {
  const info = await getModelInfo(modelId);
  const files = info.siblings || [];

  return files
    .filter(f => f.rfilename.endsWith('.onnx'))
    .map(f => f.rfilename);
}

/**
 * Clear the download cache
 */
export function clearCache(): void {
  fileCache.clear();
}

/**
 * Get cache size
 */
export function getCacheSize(): number {
  let size = 0;
  for (const buffer of fileCache.values()) {
    size += buffer.byteLength;
  }
  return size;
}

// Helper functions

function detectPolicyType(modelId: string, tags: string[]): LeRobotPolicyMeta['policyType'] {
  const combined = (modelId + ' ' + tags.join(' ')).toLowerCase();

  if (combined.includes('act') || combined.includes('action_chunk')) {
    return 'act';
  }
  if (combined.includes('diffusion')) {
    return 'diffusion';
  }
  if (combined.includes('tdmpc')) {
    return 'tdmpc';
  }
  if (combined.includes('vqbet') || combined.includes('vq-bet')) {
    return 'vqbet';
  }

  return 'unknown';
}

function detectRobotType(modelId: string, tags: string[]): string {
  const combined = (modelId + ' ' + tags.join(' ')).toLowerCase();

  if (combined.includes('so-101') || combined.includes('so101') || combined.includes('so_101')) {
    return 'so-101';
  }
  if (combined.includes('koch')) {
    return 'koch';
  }
  if (combined.includes('aloha')) {
    return 'aloha';
  }
  if (combined.includes('xarm') || combined.includes('x-arm')) {
    return 'xarm';
  }

  return 'unknown';
}

function extractTaskFromId(modelId: string): string | undefined {
  // Try to extract task name from model ID
  // e.g., "lerobot/act_so101_pick_place" -> "pick_place"
  const parts = modelId.split('/');
  const name = parts[parts.length - 1];

  const taskPatterns = [
    /pick[_-]?place/i,
    /push[_-]?block/i,
    /stack[_-]?cube/i,
    /reach/i,
    /grasp/i,
  ];

  for (const pattern of taskPatterns) {
    const match = name.match(pattern);
    if (match) {
      return match[0].replace(/[-_]/g, ' ');
    }
  }

  return undefined;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseSimpleYaml(text: string): PolicyConfig {
  // Simple YAML parser for LeRobot config files
  // This handles basic key-value pairs and nested objects
  const config: Record<string, unknown> = {};
  const lines = text.split('\n');
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [
    { obj: config, indent: -1 }
  ];

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);
    const match = trimmed.match(/^(\s*)([^:]+):\s*(.*)$/);

    if (!match) continue;

    const key = match[2].trim();
    let value: unknown = match[3].trim();

    // Pop stack to correct level
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].obj;

    if (value === '' || value === '~' || value === 'null') {
      // Nested object
      const newObj: Record<string, unknown> = {};
      current[key] = newObj;
      stack.push({ obj: newObj, indent });
    } else {
      // Parse value
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^-?\d+$/.test(value as string)) value = parseInt(value as string, 10);
      else if (/^-?\d+\.\d+$/.test(value as string)) value = parseFloat(value as string);
      else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
        // Simple array
        value = (value as string)
          .slice(1, -1)
          .split(',')
          .map(v => {
            v = v.trim();
            if (/^-?\d+$/.test(v)) return parseInt(v, 10);
            if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
            return v;
          });
      }

      current[key] = value;
    }
  }

  return config as unknown as PolicyConfig;
}

/**
 * Featured/recommended policies for SO-101
 */
export const FEATURED_POLICIES: LeRobotPolicyMeta[] = [
  {
    modelId: 'lerobot/act_so100_test',
    author: 'lerobot',
    policyType: 'act',
    robotType: 'so-101',
    taskName: 'Test Task',
    downloads: 0,
    likes: 0,
    lastModified: new Date().toISOString(),
    hasOnnx: false,
    hasSafetensors: true,
    description: 'Example ACT policy for SO-100/SO-101',
  },
];
