/**
 * Object matching utilities for natural language processing
 */

import type { SimObject } from '../../types';
import { TYPE_ALIASES, COLOR_WORDS } from './constants';

/**
 * Match an object against a natural language message
 * Returns match type if found, null otherwise
 */
export function matchObjectToMessage(
  obj: SimObject,
  message: string
): { match: true; via: string } | { match: false } {
  const name = (obj.name || '').toLowerCase();
  const objType = (obj.type || '').toLowerCase();
  const color = (obj.color || '').toLowerCase();
  const words = name.split(/\s+/);
  const messageColor = COLOR_WORDS.find(c => message.includes(c));
  const typeMatches = TYPE_ALIASES[objType]?.some(alias => message.includes(alias)) || message.includes(objType);

  if (message.includes(name)) {
    return { match: true, via: 'full name' };
  }
  if (message.includes(obj.id)) {
    return { match: true, via: 'id' };
  }
  if (words.some(word => word.length > 2 && message.includes(word))) {
    return { match: true, via: 'word match' };
  }
  if (typeMatches) {
    return { match: true, via: 'type match' };
  }
  if (messageColor && (name.includes(messageColor) || color.includes(messageColor))) {
    return { match: true, via: 'color match' };
  }
  return { match: false };
}

/**
 * Find an object by name, color, or type from a message
 */
export function findObjectByDescription(message: string, objects: SimObject[]): SimObject | null {
  for (const obj of objects) {
    const matchResult = matchObjectToMessage(obj, message);
    if (matchResult.match) {
      return obj;
    }
  }
  return null;
}
