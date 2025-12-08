import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { parseShareUrl, clearShareUrl } from '../lib/stateSerializer';

/**
 * Hook to load shared state from URL on app startup
 */
export function useLoadSharedState() {
  const {
    setSelectedRobot,
    setActiveRobotType,
    setCode,
    setJoints,
    setWheeledRobot,
    setDrone,
    setEnvironment,
    addConsoleMessage,
  } = useAppStore();

  const loadFromUrl = useCallback(() => {
    const sharedState = parseShareUrl();

    if (!sharedState) return;

    try {
      // Apply shared state
      setSelectedRobot(sharedState.robotId);
      setActiveRobotType(sharedState.activeRobotType);
      setCode({ source: sharedState.code, isGenerated: false });

      if (sharedState.joints) {
        setJoints(sharedState.joints);
      }

      if (sharedState.wheeledRobot) {
        setWheeledRobot(sharedState.wheeledRobot);
      }

      if (sharedState.drone) {
        setDrone(sharedState.drone);
      }

      if (sharedState.environment) {
        setEnvironment(sharedState.environment);
      }

      // Clear the URL hash after loading
      clearShareUrl();

      addConsoleMessage('info', 'Loaded shared simulation!');
    } catch (error) {
      console.error('Failed to load shared state:', error);
      addConsoleMessage('error', 'Failed to load shared simulation');
    }
  }, [setSelectedRobot, setActiveRobotType, setCode, setJoints, setWheeledRobot, setDrone, setEnvironment, addConsoleMessage]);

  useEffect(() => {
    loadFromUrl();
  }, [loadFromUrl]);
}
