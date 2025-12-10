/**
 * Centralized Configuration
 *
 * All magic numbers, timeouts, limits, and configurable values
 * should be defined here for easy maintenance and consistency.
 */

// Storage Configuration
export const STORAGE_CONFIG = {
  /** Maximum localStorage size in bytes (5MB typical limit) */
  MAX_LOCAL_STORAGE_SIZE: 5 * 1024 * 1024,
  /** Maximum number of save slots */
  MAX_SAVE_SLOTS: 10,
  /** Auto-save interval in milliseconds */
  AUTOSAVE_INTERVAL_MS: 30000,
  /** State persistence version */
  STORAGE_VERSION: '1.0.0',
  /** IndexedDB database name */
  DB_NAME: 'robosim-saves',
  /** IndexedDB store name */
  DB_STORE: 'states',
  /** LocalStorage keys */
  KEYS: {
    SAVE_SLOTS: 'robosim-save-slots',
    AUTOSAVE: 'robosim-autosave',
    CLAUDE_API_KEY: 'robosim-claude-api-key',
    GEMINI_API_KEY: 'robosim-gemini-api-key',
    FAL_API_KEY: 'robosim-fal-api-key',
    HF_TOKEN: 'robosim-hf-token',
    CSM_API_KEY: 'robosim-csm-api-key',
  },
} as const;

// API Configuration
export const API_CONFIG = {
  /** Default API request timeout in milliseconds */
  DEFAULT_TIMEOUT_MS: 30000,
  /** Claude API configuration */
  CLAUDE: {
    BASE_URL: 'https://api.anthropic.com/v1',
    VERSION: '2023-06-01',
    DEFAULT_MODEL: 'claude-sonnet-4-20250514',
    MAX_TOKENS: 1024,
  },
  /** Conversation history limit */
  MAX_CONVERSATION_HISTORY: 10,
} as const;

// Simulation Configuration
export const SIMULATION_CONFIG = {
  /** Target frames per second */
  TARGET_FPS: 60,
  /** Physics timestep in seconds */
  PHYSICS_TIMESTEP: 1 / 60,
  /** Maximum simulation duration in milliseconds */
  MAX_DURATION_MS: 30000,
  /** Episode recording frame rate */
  RECORDING_FRAME_RATE: 30,
} as const;

// Console Configuration
export const CONSOLE_CONFIG = {
  /** Maximum number of console messages to retain */
  MAX_MESSAGES: 100,
} as const;

// Robot Configuration
export const ROBOT_CONFIG = {
  /** Gripper grab radius in meters */
  GRIPPER_GRAB_RADIUS: 0.1,
  /** Maximum joint velocity in degrees/second */
  MAX_JOINT_VELOCITY: 180,
} as const;

// UI Configuration
export const UI_CONFIG = {
  /** Debounce delay for input fields in milliseconds */
  INPUT_DEBOUNCE_MS: 300,
  /** Animation duration for UI transitions in milliseconds */
  ANIMATION_DURATION_MS: 200,
  /** Toast notification duration in milliseconds */
  TOAST_DURATION_MS: 3000,
} as const;

// Episode Recording Configuration
export const EPISODE_CONFIG = {
  /** Maximum frames per episode chunk for streaming */
  CHUNK_SIZE: 1000,
  /** Maximum episode duration in milliseconds */
  MAX_DURATION_MS: 60000,
  /** Default frame rate for recording */
  DEFAULT_FRAME_RATE: 30,
  /** Maximum episodes in memory before forcing export */
  MAX_IN_MEMORY_EPISODES: 50,
} as const;

// Validation helpers
export function validateEnvConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for Supabase configuration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    warnings.push(
      'Supabase not configured. Running in offline mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for full features.'
    );
  }

  // Validate URL format if provided
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    errors.push('VITE_SUPABASE_URL must be a valid HTTPS URL');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
