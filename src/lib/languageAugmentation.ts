/**
 * Language Augmentation Module
 *
 * Generates diverse natural language variants for robot actions.
 * Used to expand training data with multiple phrasings of the same action.
 */

import { createLogger } from './logger';

const log = createLogger('LanguageAugmentation');

// ========================================
// VOCABULARY POOLS
// ========================================

const PICK_VERBS = [
  'pick up',
  'grab',
  'take',
  'get',
  'lift',
  'grasp',
];

const PLACE_VERBS = [
  'place',
  'put',
  'set',
  'drop',
  'move',
  'position',
];

const STACK_VERBS = [
  'stack',
  'put on top of',
  'place on',
  'stack onto',
  'set on',
];

const PUSH_VERBS = [
  'push',
  'slide',
  'move',
  'nudge',
  'shove',
];

const ARTICLES = ['the', 'that', 'this'];

const MODIFIERS_PREFIX = [
  '',
  'please ',
  'can you ',
  'go ahead and ',
  'now ',
  'try to ',
];

const MODIFIERS_SUFFIX = [
  '',
  ' for me',
  ' please',
  ' now',
];

// ========================================
// VARIANT GENERATORS
// ========================================

export type ActionType = 'pick' | 'place' | 'stack' | 'push';

/**
 * Get the appropriate verb pool for an action type
 */
function getVerbPool(action: ActionType): string[] {
  switch (action) {
    case 'pick':
      return PICK_VERBS;
    case 'place':
      return PLACE_VERBS;
    case 'stack':
      return STACK_VERBS;
    case 'push':
      return PUSH_VERBS;
    default:
      return PICK_VERBS;
  }
}

/**
 * Generate natural language variants for an action
 *
 * @param action - The action type (pick, place, stack, push)
 * @param objectName - Name of the object (e.g., "red cube")
 * @param targetName - Optional target for place/stack actions (e.g., "the left zone")
 * @param maxVariants - Maximum number of variants to generate (default: 20)
 * @returns Array of unique language variants
 */
/**
 * Generate a single phrase variant
 */
function buildPhrase(
  prefix: string,
  verb: string,
  article: string,
  objectName: string,
  action: ActionType,
  targetName?: string,
  suffix: string = ''
): string {
  let phrase = `${prefix}${verb} ${article} ${objectName}`;

  // Add target for place/stack actions
  if (targetName && (action === 'place' || action === 'stack')) {
    if (action === 'stack') {
      phrase = `${prefix}${verb} ${article} ${objectName} ${targetName}`;
    } else {
      phrase = `${prefix}${verb} ${article} ${objectName} on ${targetName}`;
    }
  }

  phrase = phrase + suffix;
  return phrase.trim().replace(/\s+/g, ' '); // Clean up whitespace
}

export function generateLanguageVariants(
  action: ActionType,
  objectName: string,
  targetName?: string,
  maxVariants: number = 20
): string[] {
  const variants = new Set<string>();
  const verbs = getVerbPool(action);
  const targetSize = maxVariants * 2; // Generate extra to allow deduplication

  // Basic pattern: [prefix] verb [article] object [target] [suffix]
  outer: for (const verb of verbs) {
    for (const article of ARTICLES) {
      for (const prefix of MODIFIERS_PREFIX) {
        for (const suffix of MODIFIERS_SUFFIX) {
          if (variants.size >= targetSize) break outer; // Exit all loops

          const phrase = buildPhrase(prefix, verb, article, objectName, action, targetName, suffix);
          variants.add(phrase);
        }
      }
    }
  }

  // Add natural conversational variants
  const naturalVariants = generateNaturalVariants(action, objectName, targetName);
  for (const variant of naturalVariants) {
    if (variants.size < targetSize) {
      variants.add(variant);
    }
  }

  // Convert to array, shuffle, and limit
  const result = Array.from(variants);
  shuffleArray(result);

  log.debug(`Generated ${Math.min(result.length, maxVariants)} language variants for "${action} ${objectName}"`);

  return result.slice(0, maxVariants);
}

/**
 * Generate more natural/conversational variants with proper grammar
 */
function generateNaturalVariants(
  action: ActionType,
  objectName: string,
  targetName?: string
): string[] {
  const variants: string[] = [];
  // Add article if objectName doesn't already start with one
  const hasArticle = /^(the|a|an|this|that)\s/i.test(objectName);
  const theObject = hasArticle ? objectName : `the ${objectName}`;

  switch (action) {
    case 'pick':
      variants.push(
        `${theObject}, pick it up`,
        `I need you to grab ${theObject}`,
        `could you get ${theObject}`,
        `${theObject} please`,
        `let's pick up ${theObject}`,
        `go get ${theObject}`,
        `bring me ${theObject}`,
        `fetch ${theObject}`,
        `hand me ${theObject}`,
        `I want ${theObject}`,
      );
      break;

    case 'place':
      if (targetName) {
        const theTarget = /^(the|a|an|this|that)\s/i.test(targetName) ? targetName : `the ${targetName}`;
        variants.push(
          `put ${theObject} over at ${theTarget}`,
          `${theObject} goes to ${theTarget}`,
          `move ${theObject} to ${theTarget}`,
          `${theTarget} is where ${theObject} should go`,
          `I want ${theObject} at ${theTarget}`,
          `place ${theObject} near ${theTarget}`,
        );
      } else {
        variants.push(
          `put ${theObject} down`,
          `set ${theObject} down`,
          `release ${theObject}`,
          `let go of ${theObject}`,
          `drop ${theObject} here`,
        );
      }
      break;

    case 'stack':
      if (targetName) {
        const theTarget = /^(the|a|an|this|that)\s/i.test(targetName) ? targetName : `the ${targetName}`;
        variants.push(
          `${theObject} on top of ${theTarget}`,
          `put ${theObject} onto ${theTarget}`,
          `${theObject} should go on ${theTarget}`,
          `stack ${theObject} on ${theTarget}`,
          `build with ${theObject} on ${theTarget}`,
          `balance ${theObject} on ${theTarget}`,
        );
      }
      break;

    case 'push':
      variants.push(
        `slide ${theObject} forward`,
        `push ${theObject} away`,
        `move ${theObject} over`,
        `nudge ${theObject}`,
        `shove ${theObject} a bit`,
        `give ${theObject} a push`,
        `scoot ${theObject} over`,
      );
      break;
  }

  return variants;
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// ========================================
// BATCH AUGMENTATION
// ========================================

export interface LanguageAugmentedExample {
  original: string;
  variants: string[];
  action: ActionType;
  objectName: string;
  targetName?: string;
}

/**
 * Augment a pickup example with language variants
 */
export function augmentPickupExample(
  userMessage: string,
  objectName: string,
  maxVariants: number = 20
): LanguageAugmentedExample {
  return {
    original: userMessage,
    variants: generateLanguageVariants('pick', objectName, undefined, maxVariants),
    action: 'pick',
    objectName,
  };
}

/**
 * Augment a place example with language variants
 */
export function augmentPlaceExample(
  userMessage: string,
  objectName: string,
  targetZone: string,
  maxVariants: number = 20
): LanguageAugmentedExample {
  return {
    original: userMessage,
    variants: generateLanguageVariants('place', objectName, targetZone, maxVariants),
    action: 'place',
    objectName,
    targetName: targetZone,
  };
}

/**
 * Augment a stack example with language variants
 */
export function augmentStackExample(
  userMessage: string,
  objectName: string,
  targetObject: string,
  maxVariants: number = 20
): LanguageAugmentedExample {
  return {
    original: userMessage,
    variants: generateLanguageVariants('stack', objectName, targetObject, maxVariants),
    action: 'stack',
    objectName,
    targetName: targetObject,
  };
}

// ========================================
// STATISTICS
// ========================================

/**
 * Get statistics about language augmentation
 */
export function getAugmentationStats(): {
  pickVariants: number;
  placeVariants: number;
  stackVariants: number;
  pushVariants: number;
  totalVocabulary: number;
} {
  const testObject = 'test object';
  const testTarget = 'test target';

  return {
    pickVariants: generateLanguageVariants('pick', testObject).length,
    placeVariants: generateLanguageVariants('place', testObject, testTarget).length,
    stackVariants: generateLanguageVariants('stack', testObject, testTarget).length,
    pushVariants: generateLanguageVariants('push', testObject).length,
    totalVocabulary:
      PICK_VERBS.length +
      PLACE_VERBS.length +
      STACK_VERBS.length +
      PUSH_VERBS.length +
      ARTICLES.length +
      MODIFIERS_PREFIX.length +
      MODIFIERS_SUFFIX.length,
  };
}
