/**
 * Centralized Color Constants
 *
 * All color definitions used throughout the application.
 * Import from here rather than defining colors inline.
 */

/**
 * Object color names for identifying objects in the scene
 * Used for natural language object references (e.g., "pick up the red cube")
 */
export const OBJECT_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type ObjectColor = typeof OBJECT_COLORS[number];

/**
 * Robot instance colors (hex values)
 * Used for visual differentiation in multi-robot scenarios
 */
export const ROBOT_COLORS = [
  '#3b82f6', // Blue (primary)
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Orange
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
] as const;
export type RobotColor = typeof ROBOT_COLORS[number];

/**
 * Object color name to hex mapping
 * For consistent color representation across UI and 3D rendering
 */
export const OBJECT_COLOR_HEX: Record<ObjectColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#8b5cf6',
  orange: '#f59e0b',
};

/**
 * Target zone colors
 */
export const TARGET_ZONE_COLORS = {
  default: '#00ff00',    // Green
  satisfied: '#22c55e',  // Bright green
  unsatisfied: '#fbbf24', // Amber
} as const;

/**
 * UI semantic colors
 */
export const UI_COLORS = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
} as const;

/**
 * Get a random robot color from the palette
 */
export function getRandomRobotColor(): RobotColor {
  return ROBOT_COLORS[Math.floor(Math.random() * ROBOT_COLORS.length)];
}

/**
 * Get the next robot color in sequence
 */
export function getNextRobotColor(currentColor: string): RobotColor {
  const currentIndex = ROBOT_COLORS.indexOf(currentColor as RobotColor);
  return ROBOT_COLORS[(currentIndex + 1) % ROBOT_COLORS.length];
}
