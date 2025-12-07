/**
 * Vision-Language Analysis for RoboSim
 *
 * Provides scene understanding by combining vision models with LLM analysis.
 * Enables questions like:
 * - "What's in the scene?"
 * - "Where is the red object?"
 * - "Is there anything the robot can pick up?"
 * - "Describe the robot's current pose"
 */

import { getClaudeApiKey } from './claudeApi';
import { detectObjects, classifyImage, classifyImageZeroShot, type ObjectDetectionResult } from './transformersAI';
import { createLogger } from './logger';

const logger = createLogger('VisionLanguage');

export interface SceneAnalysis {
  description: string;
  objects: DetectedObject[];
  robotState: string;
  suggestions: string[];
  timestamp: number;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  position: { x: number; y: number; width: number; height: number };
  isGrabbable: boolean;
  color?: string;
}

export interface VisionQuery {
  question: string;
  imageData: string; // base64 or data URL
  context?: {
    robotType: string;
    jointPositions?: Record<string, number>;
    recentActions?: string[];
  };
}

export interface VisionResponse {
  answer: string;
  confidence: number;
  detectedObjects?: DetectedObject[];
  suggestedActions?: string[];
}

/**
 * Capture the current 3D scene as an image
 */
export function captureSceneImage(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Analyze scene using local object detection models
 */
export async function analyzeSceneLocally(
  imageSource: HTMLImageElement | HTMLCanvasElement | string
): Promise<DetectedObject[]> {
  try {
    const detections = await detectObjects(imageSource, { threshold: 0.5 });

    return detections.map(det => ({
      label: det.label,
      confidence: det.score,
      position: {
        x: det.box.xmin,
        y: det.box.ymin,
        width: det.box.xmax - det.box.xmin,
        height: det.box.ymax - det.box.ymin,
      },
      isGrabbable: isGrabbableObject(det.label),
    }));
  } catch (error) {
    logger.error('Local scene analysis failed', error);
    return [];
  }
}

/**
 * Determine if an object is likely graspable by the robot
 */
function isGrabbableObject(label: string): boolean {
  const graspableCategories = [
    'apple', 'orange', 'banana', 'bottle', 'cup', 'bowl', 'book',
    'cell phone', 'remote', 'keyboard', 'mouse', 'scissors', 'teddy bear',
    'toothbrush', 'ball', 'toy', 'box', 'can', 'container'
  ];

  return graspableCategories.some(cat =>
    label.toLowerCase().includes(cat)
  );
}

/**
 * Classify scene type using zero-shot classification
 */
export async function classifySceneType(
  imageSource: HTMLImageElement | HTMLCanvasElement | string
): Promise<string> {
  const sceneTypes = [
    'robotics laboratory',
    'warehouse',
    'kitchen',
    'living room',
    'outdoor',
    'factory floor',
    'office',
    'empty room'
  ];

  try {
    const results = await classifyImageZeroShot(imageSource, sceneTypes);
    if (results.length > 0) {
      return results[0].label;
    }
  } catch (error) {
    logger.error('Scene classification failed', error);
  }

  return 'unknown environment';
}

/**
 * Ask a question about the scene using Claude Vision
 */
export async function askAboutScene(query: VisionQuery): Promise<VisionResponse> {
  const apiKey = getClaudeApiKey();

  // If no API key, use local models for basic analysis
  if (!apiKey) {
    return askAboutSceneLocal(query);
  }

  try {
    // Build context message
    let contextMsg = '';
    if (query.context) {
      contextMsg = `\n\nContext:
- Robot type: ${query.context.robotType}`;
      if (query.context.jointPositions) {
        contextMsg += `\n- Current joint positions: ${JSON.stringify(query.context.jointPositions)}`;
      }
      if (query.context.recentActions && query.context.recentActions.length > 0) {
        contextMsg += `\n- Recent actions: ${query.context.recentActions.join(', ')}`;
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: query.imageData.replace(/^data:image\/\w+;base64,/, ''),
                },
              },
              {
                type: 'text',
                text: `You are a vision system for a robotics simulation. Analyze this scene and answer the question.

Question: ${query.question}${contextMsg}

Respond with:
1. A direct answer to the question
2. List any objects you can see that the robot could interact with
3. If relevant, suggest what actions the robot could take

Be concise and focus on information useful for robot control.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || 'Unable to analyze the scene.';

    // Parse the response
    const answer = content.split('\n')[0] || content;

    // Extract suggested actions if present
    const suggestedActions: string[] = [];
    const actionMatch = content.match(/suggest(?:ed)?\s*(?:actions?)?:?\s*(.+)/i);
    if (actionMatch) {
      suggestedActions.push(...actionMatch[1].split(/[,;]/).map((s: string) => s.trim()).filter(Boolean));
    }

    return {
      answer,
      confidence: 0.9,
      suggestedActions,
    };
  } catch (error) {
    logger.error('Vision-language query failed', error);
    return askAboutSceneLocal(query);
  }
}

/**
 * Fallback: Use local models for basic scene understanding
 */
async function askAboutSceneLocal(query: VisionQuery): Promise<VisionResponse> {
  logger.info('Using local vision models (no API key)');

  const question = query.question.toLowerCase();

  // Create an image element from base64
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = query.imageData;
  });

  // Get object detections
  const objects = await analyzeSceneLocally(img);

  // Get scene classification
  const sceneType = await classifySceneType(img);

  // Build response based on question type
  let answer = '';
  const suggestedActions: string[] = [];

  if (question.includes('what') && (question.includes('scene') || question.includes('see'))) {
    // "What's in the scene?"
    if (objects.length === 0) {
      answer = `This appears to be a ${sceneType}. I don't detect any specific objects in the current view.`;
    } else {
      const objectList = objects.map(o => `${o.label} (${(o.confidence * 100).toFixed(0)}%)`).join(', ');
      answer = `This is a ${sceneType}. I can see: ${objectList}.`;
    }
  } else if (question.includes('where')) {
    // "Where is the X?"
    const targetObject = extractObjectFromQuestion(question);
    const found = objects.find(o => o.label.toLowerCase().includes(targetObject));
    if (found) {
      const xPos = found.position.x < 0.33 ? 'left' : found.position.x > 0.66 ? 'right' : 'center';
      const yPos = found.position.y < 0.33 ? 'top' : found.position.y > 0.66 ? 'bottom' : 'middle';
      answer = `The ${found.label} is in the ${yPos}-${xPos} of the image.`;
      if (found.isGrabbable) {
        suggestedActions.push(`Move toward the ${found.label}`, `Pick up the ${found.label}`);
      }
    } else {
      answer = `I cannot locate "${targetObject}" in the current view.`;
    }
  } else if (question.includes('pick') || question.includes('grab')) {
    // "What can I pick up?"
    const graspable = objects.filter(o => o.isGrabbable);
    if (graspable.length > 0) {
      const items = graspable.map(o => o.label).join(', ');
      answer = `You could potentially pick up: ${items}.`;
      suggestedActions.push(...graspable.map(o => `Pick up the ${o.label}`));
    } else {
      answer = 'I don\'t see any easily graspable objects in the current view.';
    }
  } else {
    // General question - provide scene overview
    answer = `Scene: ${sceneType}. ${objects.length} objects detected.`;
    if (objects.length > 0) {
      answer += ` Objects: ${objects.map(o => o.label).join(', ')}.`;
    }
  }

  return {
    answer,
    confidence: 0.7,
    detectedObjects: objects,
    suggestedActions,
  };
}

/**
 * Extract the object being asked about from a question
 */
function extractObjectFromQuestion(question: string): string {
  // Match patterns like "where is the X" or "find the X"
  const patterns = [
    /where\s+is\s+(?:the\s+)?(\w+)/i,
    /find\s+(?:the\s+)?(\w+)/i,
    /locate\s+(?:the\s+)?(\w+)/i,
    /see\s+(?:the\s+)?(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  return '';
}

/**
 * Generate a comprehensive scene analysis
 */
export async function generateSceneAnalysis(
  canvas: HTMLCanvasElement,
  robotState: string
): Promise<SceneAnalysis> {
  const imageData = captureSceneImage(canvas);

  // Create image element for analysis
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = imageData;
  });

  // Run parallel analysis
  const [objects, sceneType] = await Promise.all([
    analyzeSceneLocally(img),
    classifySceneType(img),
  ]);

  // Generate suggestions based on detected objects
  const suggestions: string[] = [];
  const graspable = objects.filter(o => o.isGrabbable);

  if (graspable.length > 0) {
    suggestions.push(`Pick up the ${graspable[0].label}`);
  }
  if (objects.length > 1) {
    suggestions.push('Navigate between objects');
  }
  suggestions.push('Scan the area for more objects');

  return {
    description: `${sceneType} with ${objects.length} detected objects`,
    objects,
    robotState,
    suggestions,
    timestamp: Date.now(),
  };
}

/**
 * Quick scene summary for status display
 */
export async function getQuickSceneSummary(
  canvas: HTMLCanvasElement
): Promise<string> {
  try {
    const imageData = captureSceneImage(canvas);

    // Create image element
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = imageData;
    });

    const classifications = await classifyImage(img, { topK: 3 });

    if (classifications.length > 0) {
      return classifications.map(c => c.label).slice(0, 2).join(', ');
    }
  } catch (error) {
    logger.error('Quick scene summary failed', error);
  }

  return 'Scene analysis unavailable';
}
