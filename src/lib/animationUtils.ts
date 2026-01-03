/**
 * Animation Utilities
 *
 * Provides headless-safe animation loops that work reliably in both
 * headed and headless browser environments. requestAnimationFrame can be
 * throttled or disabled in headless mode, causing infinite waits.
 */

const FRAME_INTERVAL = 16; // ~60fps

/**
 * Detect if we're likely in a headless browser environment
 */
export const isHeadlessEnvironment = (): boolean => {
  if (typeof window === 'undefined') return true;

  // Check for common headless indicators
  const isAutomated = !!(window as unknown as { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__ ||
    navigator.webdriver ||
    /HeadlessChrome/.test(navigator.userAgent);

  return isAutomated;
};

/**
 * Schedule the next animation frame reliably in both headed and headless modes.
 * Uses setTimeout in headless environments for predictable timing.
 */
export const scheduleFrame = (callback: () => void): number => {
  if (isHeadlessEnvironment()) {
    return window.setTimeout(callback, FRAME_INTERVAL);
  }
  return requestAnimationFrame(callback);
};

/**
 * Cancel a scheduled frame
 */
export const cancelFrame = (id: number): void => {
  if (isHeadlessEnvironment()) {
    clearTimeout(id);
  } else {
    cancelAnimationFrame(id);
  }
};

/**
 * Run an animation loop with a given callback until it returns false.
 * The callback receives the elapsed time since start.
 * Returns a function to cancel the animation.
 */
export const runAnimationLoop = (
  callback: (elapsed: number) => boolean,
  onComplete?: () => void
): (() => void) => {
  const startTime = Date.now();
  let frameId: number | null = null;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;

    const elapsed = Date.now() - startTime;
    const shouldContinue = callback(elapsed);

    if (shouldContinue && !cancelled) {
      frameId = scheduleFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  };

  frameId = scheduleFrame(tick);

  return () => {
    cancelled = true;
    if (frameId !== null) {
      cancelFrame(frameId);
    }
  };
};

/**
 * Animate joints from current to target over a duration.
 * Returns a promise that resolves when animation completes.
 */
export const animateJoints = <T extends Record<string, number>>(
  getStart: () => T,
  setJoints: (joints: Partial<T>) => void,
  targetJoints: Partial<T>,
  duration: number,
  easing: (t: number) => number = (t) => 1 - Math.pow(1 - t, 3) // ease out cubic
): Promise<void> => {
  return new Promise((resolve) => {
    const startJoints = getStart();
    const startTime = Date.now();

    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = easing(progress);

      const newJoints: Partial<T> = {};
      for (const joint of Object.keys(startJoints) as (keyof T)[]) {
        if (targetJoints[joint] !== undefined) {
          (newJoints as Record<string, number>)[joint as string] =
            (startJoints[joint] as number) +
            ((targetJoints[joint] as number) - (startJoints[joint] as number)) * eased;
        }
      }

      setJoints(newJoints);

      if (progress < 1) {
        scheduleFrame(animate);
      } else {
        resolve();
      }
    };

    animate();
  });
};
