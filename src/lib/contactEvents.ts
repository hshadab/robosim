/**
 * Contact Events Export Module
 *
 * Captures and exports grasp contact events for training data.
 * Hooks into GraspManager state changes via store subscriptions.
 */

import { useAppStore } from '../stores/useAppStore';
import { createLogger } from './logger';
import { generateSecureId } from './crypto';

const log = createLogger('ContactEvents');

// ========================================
// CONTACT EVENT TYPES
// ========================================

export interface ContactEvent {
  id: string;
  timestamp: number;
  type: 'grasp' | 'release' | 'contact' | 'slip';

  // Object info
  objectId: string;
  objectName: string;
  objectType: string;
  objectPosition: [number, number, number];
  objectRotation: [number, number, number];
  objectScale: number;

  // Gripper state at event time
  gripperValue: number;
  gripperPosition: [number, number, number];
  gripperQuaternion: [number, number, number, number];

  // Joint state at event time
  jointState: {
    base: number;
    shoulder: number;
    elbow: number;
    wrist: number;
    wristRoll: number;
    gripper: number;
  };

  // Additional context
  graspForce?: number; // Estimated from gripper closure vs object size
  contactDuration?: number; // For release events
}

export interface ContactSession {
  id: string;
  startTime: number;
  endTime?: number;
  events: ContactEvent[];
  metadata: {
    robotType: string;
    userCommand?: string;
    success: boolean;
  };
}

// ========================================
// IN-MEMORY STORAGE
// ========================================

let currentSession: ContactSession | null = null;
let allSessions: ContactSession[] = [];
let eventListeners: ((event: ContactEvent) => void)[] = [];

// Track previous grasp state for change detection
let previousGraspedObjects: Set<string> = new Set();
let graspStartTimes: Map<string, number> = new Map();

// ========================================
// SESSION MANAGEMENT
// ========================================

/**
 * Start a new contact recording session
 */
export function startContactSession(userCommand?: string): string {
  const sessionId = generateSecureId('session');

  currentSession = {
    id: sessionId,
    startTime: Date.now(),
    events: [],
    metadata: {
      robotType: useAppStore.getState().activeRobotType,
      userCommand,
      success: false,
    },
  };

  log.info(`Started contact session ${sessionId}`, { userCommand });
  return sessionId;
}

/**
 * End the current contact session
 */
export function endContactSession(success: boolean = false): ContactSession | null {
  if (!currentSession) {
    log.warn('No active session to end');
    return null;
  }

  currentSession.endTime = Date.now();
  currentSession.metadata.success = success;

  allSessions.push(currentSession);

  log.info(`Ended contact session ${currentSession.id}`, {
    success,
    eventCount: currentSession.events.length,
    duration: currentSession.endTime - currentSession.startTime,
  });

  const session = currentSession;
  currentSession = null;
  return session;
}

/**
 * Get the current active session
 */
export function getCurrentSession(): ContactSession | null {
  return currentSession;
}

/**
 * Get all recorded sessions
 */
export function getAllSessions(): ContactSession[] {
  return [...allSessions];
}

/**
 * Clear all sessions
 */
export function clearSessions(): void {
  allSessions = [];
  currentSession = null;
  previousGraspedObjects.clear();
  graspStartTimes.clear();
  log.info('Cleared all contact sessions');
}

// ========================================
// EVENT RECORDING
// ========================================

/**
 * Record a contact event
 */
export function recordContactEvent(event: Omit<ContactEvent, 'id' | 'timestamp'>): ContactEvent {
  const fullEvent: ContactEvent = {
    ...event,
    id: generateSecureId('event'),
    timestamp: Date.now(),
  };

  // Add to current session if active
  if (currentSession) {
    currentSession.events.push(fullEvent);
  }

  // Notify listeners
  for (const listener of eventListeners) {
    try {
      listener(fullEvent);
    } catch (err) {
      log.warn('Event listener error', err);
    }
  }

  log.debug(`Recorded ${event.type} event`, {
    objectName: event.objectName,
    gripperValue: event.gripperValue.toFixed(1),
  });

  return fullEvent;
}

/**
 * Subscribe to contact events
 */
export function onContactEvent(listener: (event: ContactEvent) => void): () => void {
  eventListeners.push(listener);
  return () => {
    eventListeners = eventListeners.filter(l => l !== listener);
  };
}

// ========================================
// STORE SUBSCRIPTION - Automatic Event Detection
// ========================================

let storeUnsubscribe: (() => void) | null = null;

/**
 * Start monitoring grasp state changes
 */
export function startContactMonitoring(): void {
  if (storeUnsubscribe) {
    log.debug('Contact monitoring already active');
    return;
  }

  log.info('Starting contact event monitoring');

  storeUnsubscribe = useAppStore.subscribe((state, prevState) => {
    // Check for grasp state changes in objects
    const currentGrasped = new Set(
      state.objects.filter(o => o.isGrabbed).map(o => o.id)
    );
    const prevGrasped = new Set(
      prevState.objects.filter(o => o.isGrabbed).map(o => o.id)
    );

    // Detect new grasps
    for (const objId of currentGrasped) {
      if (!prevGrasped.has(objId)) {
        // New grasp detected
        const obj = state.objects.find(o => o.id === objId);
        if (obj) {
          graspStartTimes.set(objId, Date.now());

          recordContactEvent({
            type: 'grasp',
            objectId: obj.id,
            objectName: obj.name || obj.id,
            objectType: obj.type || 'unknown',
            objectPosition: obj.position as [number, number, number],
            objectRotation: obj.rotation as [number, number, number],
            objectScale: obj.scale,
            gripperValue: state.actualJoints.gripper,
            gripperPosition: state.gripperWorldPosition as [number, number, number],
            gripperQuaternion: state.gripperWorldQuaternion as [number, number, number, number],
            jointState: { ...state.actualJoints },
            graspForce: estimateGraspForce(state.actualJoints.gripper, obj.scale),
          });
        }
      }
    }

    // Detect releases
    for (const objId of prevGrasped) {
      if (!currentGrasped.has(objId)) {
        // Release detected
        const obj = state.objects.find(o => o.id === objId);
        if (obj) {
          const graspStart = graspStartTimes.get(objId);
          const contactDuration = graspStart ? Date.now() - graspStart : undefined;
          graspStartTimes.delete(objId);

          recordContactEvent({
            type: 'release',
            objectId: obj.id,
            objectName: obj.name || obj.id,
            objectType: obj.type || 'unknown',
            objectPosition: obj.position as [number, number, number],
            objectRotation: obj.rotation as [number, number, number],
            objectScale: obj.scale,
            gripperValue: state.actualJoints.gripper,
            gripperPosition: state.gripperWorldPosition as [number, number, number],
            gripperQuaternion: state.gripperWorldQuaternion as [number, number, number, number],
            jointState: { ...state.actualJoints },
            contactDuration,
          });
        }
      }
    }

    previousGraspedObjects = currentGrasped;
  });
}

/**
 * Stop monitoring grasp state changes
 */
export function stopContactMonitoring(): void {
  if (storeUnsubscribe) {
    storeUnsubscribe();
    storeUnsubscribe = null;
    log.info('Stopped contact event monitoring');
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Estimate grasp force based on gripper closure and object size
 * Returns normalized force 0-1
 */
function estimateGraspForce(gripperValue: number, objectScale: number): number {
  // Lower gripper value = more closed = more force
  // Adjust for object size - smaller objects need less closure for same force
  const closureRatio = 1 - (gripperValue / 100);
  const sizeFactor = Math.min(1, objectScale / 0.05); // Normalize to 5cm reference
  return Math.min(1, closureRatio * (1 + sizeFactor));
}

// ========================================
// EXPORT FORMATS
// ========================================

/**
 * Export sessions in LeRobot-compatible format
 */
export function exportForLeRobot(): {
  episodes: Array<{
    episode_id: string;
    timestamp_start: number;
    timestamp_end: number;
    success: boolean;
    contacts: Array<{
      timestamp: number;
      type: string;
      object_type: string;
      position: number[];
      gripper_state: number;
      joint_positions: number[];
      force_estimate: number;
    }>;
  }>;
  metadata: {
    robot_type: string;
    total_episodes: number;
    successful_episodes: number;
    total_contacts: number;
    export_time: string;
  };
} {
  const episodes = allSessions.map(session => ({
    episode_id: session.id,
    timestamp_start: session.startTime,
    timestamp_end: session.endTime || Date.now(),
    success: session.metadata.success,
    contacts: session.events.map(event => ({
      timestamp: event.timestamp,
      type: event.type,
      object_type: event.objectType,
      position: event.objectPosition,
      gripper_state: event.gripperValue,
      joint_positions: [
        event.jointState.base,
        event.jointState.shoulder,
        event.jointState.elbow,
        event.jointState.wrist,
        event.jointState.wristRoll,
        event.jointState.gripper,
      ],
      force_estimate: event.graspForce || 0,
    })),
  }));

  const successfulCount = allSessions.filter(s => s.metadata.success).length;
  const totalContacts = allSessions.reduce((sum, s) => sum + s.events.length, 0);

  return {
    episodes,
    metadata: {
      robot_type: useAppStore.getState().activeRobotType,
      total_episodes: allSessions.length,
      successful_episodes: successfulCount,
      total_contacts: totalContacts,
      export_time: new Date().toISOString(),
    },
  };
}

/**
 * Export as JSON string for download
 */
export function exportAsJSON(): string {
  return JSON.stringify(exportForLeRobot(), null, 2);
}

/**
 * Get contact statistics
 */
export function getContactStats(): {
  totalSessions: number;
  successfulSessions: number;
  totalEvents: number;
  eventsByType: Record<string, number>;
  averageGraspDuration: number;
} {
  const eventsByType: Record<string, number> = {};
  let totalDuration = 0;
  let durationCount = 0;

  for (const session of allSessions) {
    for (const event of session.events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      if (event.type === 'release' && event.contactDuration) {
        totalDuration += event.contactDuration;
        durationCount++;
      }
    }
  }

  return {
    totalSessions: allSessions.length,
    successfulSessions: allSessions.filter(s => s.metadata.success).length,
    totalEvents: allSessions.reduce((sum, s) => sum + s.events.length, 0),
    eventsByType,
    averageGraspDuration: durationCount > 0 ? totalDuration / durationCount : 0,
  };
}

// ========================================
// LOCALSTORAGE PERSISTENCE
// ========================================

const STORAGE_KEY = 'robosim_contact_sessions';

/**
 * Save sessions to localStorage
 */
export function saveSessionsToStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    const data = JSON.stringify(allSessions);
    localStorage.setItem(STORAGE_KEY, data);
    log.debug(`Saved ${allSessions.length} sessions to localStorage`);
  } catch (err) {
    log.warn('Failed to save sessions to localStorage', err);
  }
}

/**
 * Load sessions from localStorage
 */
export function loadSessionsFromStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        allSessions = parsed;
        log.info(`Loaded ${allSessions.length} sessions from localStorage`);
      }
    }
  } catch (err) {
    log.warn('Failed to load sessions from localStorage', err);
  }
}

// Initialize on module load
loadSessionsFromStorage();
