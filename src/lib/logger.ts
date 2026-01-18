/**
 * Logging Utility for RoboSim
 *
 * Provides structured logging with levels, namespaces, and production-safe output.
 * In development mode, logs are shown in the console.
 * In production, only warnings and errors are shown.
 *
 * ## Usage Conventions
 *
 * ### For common namespaces, use pre-created loggers:
 * ```typescript
 * import { loggers } from './logger';
 * loggers.claude.info('API call successful');
 * loggers.ik.debug('Computed position', { x, y, z });
 * ```
 *
 * ### For module-specific logging, create a logger:
 * ```typescript
 * import { createLogger } from './logger';
 * const log = createLogger('MyModule');
 * log.info('Module initialized');
 * ```
 *
 * ### Naming Conventions:
 * - Use PascalCase for namespace names (e.g., 'Claude', 'PolicyRunner')
 * - For new modules, prefer adding to `loggers` object if widely used
 * - For one-off module logging, use `createLogger()` with descriptive name
 *
 * ### Log Levels:
 * - debug: Detailed debugging info (dev only)
 * - info: General operational info
 * - warn: Potential issues that don't break functionality
 * - error: Errors that affect functionality
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  namespace: string;
  message: string;
  data?: unknown;
  timestamp: Date;
}

type LogHandler = (entry: LogEntry) => void;

// Configuration
const config = {
  enabled: true,
  minLevel: (import.meta.env.DEV ? 'debug' : 'warn') as LogLevel,
  handlers: [] as LogHandler[],
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color: #888',
  info: 'color: #4ade80',
  warn: 'color: #fbbf24',
  error: 'color: #f87171; font-weight: bold',
};

const NAMESPACE_COLORS = [
  '#60a5fa', // blue
  '#a78bfa', // purple
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#f472b6', // pink
  '#34d399', // emerald
];

function getNamespaceColor(namespace: string): string {
  let hash = 0;
  for (let i = 0; i < namespace.length; i++) {
    hash = ((hash << 5) - hash + namespace.charCodeAt(i)) | 0;
  }
  return NAMESPACE_COLORS[Math.abs(hash) % NAMESPACE_COLORS.length];
}

function shouldLog(level: LogLevel): boolean {
  return config.enabled && LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[config.minLevel];
}

function formatMessage(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;

  const namespaceColor = getNamespaceColor(entry.namespace);
  const prefix = `[${entry.namespace}]`;
  const style = LEVEL_STYLES[entry.level];

  const consoleMethod = entry.level === 'error' ? console.error :
                       entry.level === 'warn' ? console.warn :
                       entry.level === 'debug' ? console.debug :
                       console.log;

  if (entry.data !== undefined) {
    consoleMethod(
      `%c${prefix}%c ${entry.message}`,
      `color: ${namespaceColor}; font-weight: bold`,
      style,
      entry.data
    );
  } else {
    consoleMethod(
      `%c${prefix}%c ${entry.message}`,
      `color: ${namespaceColor}; font-weight: bold`,
      style
    );
  }

  // Call registered handlers
  for (const handler of config.handlers) {
    try {
      handler(entry);
    } catch {
      // Silently ignore handler errors
    }
  }
}

/**
 * Create a logger instance for a specific namespace
 */
export function createLogger(namespace: string) {
  return {
    debug(message: string, data?: unknown) {
      formatMessage({ level: 'debug', namespace, message, data, timestamp: new Date() });
    },
    info(message: string, data?: unknown) {
      formatMessage({ level: 'info', namespace, message, data, timestamp: new Date() });
    },
    warn(message: string, data?: unknown) {
      formatMessage({ level: 'warn', namespace, message, data, timestamp: new Date() });
    },
    error(message: string, data?: unknown) {
      formatMessage({ level: 'error', namespace, message, data, timestamp: new Date() });
    },
  };
}

/**
 * Configure the logger
 */
export function configureLogger(options: {
  enabled?: boolean;
  minLevel?: LogLevel;
}): void {
  if (options.enabled !== undefined) config.enabled = options.enabled;
  if (options.minLevel !== undefined) config.minLevel = options.minLevel;
}

/**
 * Add a custom log handler (e.g., for sending logs to a server)
 */
export function addLogHandler(handler: LogHandler): () => void {
  config.handlers.push(handler);
  return () => {
    const index = config.handlers.indexOf(handler);
    if (index > -1) config.handlers.splice(index, 1);
  };
}

/**
 * Get current log configuration
 */
export function getLogConfig() {
  return { ...config, handlers: config.handlers.length };
}

// Pre-created loggers for common namespaces
export const loggers = {
  claude: createLogger('Claude'),
  policy: createLogger('PolicyRunner'),
  serial: createLogger('Serial'),
  ik: createLogger('IK'),
  vision: createLogger('Vision'),
  ai: createLogger('AI'),
  urdf: createLogger('URDF'),
  dataset: createLogger('Dataset'),
  video: createLogger('Video'),
  mediaPipe: createLogger('MediaPipe'),
  state: createLogger('State'),
  multiRobot: createLogger('MultiRobot'),
  emulator: createLogger('Emulator'),
  grasp: createLogger('Grasp'),
  gripper: createLogger('Gripper'),
  simulation: createLogger('Simulation'),
  objects: createLogger('Objects'),
};

export default createLogger;
