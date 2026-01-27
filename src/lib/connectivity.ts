/**
 * Connectivity Monitor
 *
 * Tracks online/offline state using navigator.onLine and
 * periodic health checks. Notifies listeners on transitions.
 */

type ConnectivityCallback = (online: boolean) => void;

const listeners = new Set<ConnectivityCallback>();
let polling = false;

/**
 * Returns the current online status.
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Register a callback for connectivity changes.
 * Returns an unsubscribe function.
 */
export function onConnectivityChange(callback: ConnectivityCallback): () => void {
  listeners.add(callback);
  startListening();
  return () => {
    listeners.delete(callback);
  };
}

function notify(online: boolean) {
  for (const cb of listeners) {
    try {
      cb(online);
    } catch {
      // ignore listener errors
    }
  }
}

function startListening() {
  if (polling || typeof window === 'undefined') return;
  polling = true;

  window.addEventListener('online', () => notify(true));
  window.addEventListener('offline', () => notify(false));
}
