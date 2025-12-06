/**
 * Hook for executing smooth trajectories
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import type { JointState } from '../types';
import type { InterpolationType } from '../lib/trajectoryPlanner';
import {
  TrajectoryExecutor,
  generatePointToPointTrajectory,
  generateMultiWaypointTrajectory,
} from '../lib/trajectoryPlanner';
import { useAppStore } from '../stores/useAppStore';

interface TrajectoryExecutionState {
  isExecuting: boolean;
  isPaused: boolean;
  progress: number;
}

interface UseTrajectoryExecutionResult {
  state: TrajectoryExecutionState;
  moveToPosition: (
    target: JointState,
    duration?: number,
    interpolationType?: InterpolationType
  ) => void;
  executeWaypoints: (
    waypoints: JointState[],
    durations?: number[],
    interpolationType?: InterpolationType
  ) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export const useTrajectoryExecution = (): UseTrajectoryExecutionResult => {
  const setJoints = useAppStore((state) => state.setJoints);
  const setIsAnimating = useAppStore((state) => state.setIsAnimating);

  const executorRef = useRef<TrajectoryExecutor>(new TrajectoryExecutor());
  const [state, setState] = useState<TrajectoryExecutionState>({
    isExecuting: false,
    isPaused: false,
    progress: 0,
  });

  // Update progress periodically while executing
  useEffect(() => {
    let intervalId: number | null = null;

    if (state.isExecuting && !state.isPaused) {
      intervalId = window.setInterval(() => {
        const progress = executorRef.current.getProgress();
        setState((prev) => ({ ...prev, progress }));
      }, 50);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [state.isExecuting, state.isPaused]);

  const handleUpdate = useCallback(
    (joints: JointState) => {
      setJoints(joints);
    },
    [setJoints]
  );

  const handleComplete = useCallback(() => {
    setState({
      isExecuting: false,
      isPaused: false,
      progress: 1,
    });
    setIsAnimating(false);
  }, [setIsAnimating]);

  const moveToPosition = useCallback(
    (
      target: JointState,
      duration?: number,
      interpolationType: InterpolationType = 'cubic'
    ) => {
      const currentJoints = useAppStore.getState().joints;
      const trajectory = generatePointToPointTrajectory(
        currentJoints,
        target,
        duration,
        interpolationType
      );

      setState({
        isExecuting: true,
        isPaused: false,
        progress: 0,
      });
      setIsAnimating(true);

      executorRef.current.execute(trajectory, handleUpdate, handleComplete);
    },
    [handleUpdate, handleComplete, setIsAnimating]
  );

  const executeWaypoints = useCallback(
    (
      waypoints: JointState[],
      durations?: number[],
      interpolationType: InterpolationType = 'cubic'
    ) => {
      if (waypoints.length < 2) {
        console.warn('Need at least 2 waypoints');
        return;
      }

      const trajectory = generateMultiWaypointTrajectory(
        waypoints,
        durations,
        interpolationType
      );

      setState({
        isExecuting: true,
        isPaused: false,
        progress: 0,
      });
      setIsAnimating(true);

      executorRef.current.execute(trajectory, handleUpdate, handleComplete);
    },
    [handleUpdate, handleComplete, setIsAnimating]
  );

  const pause = useCallback(() => {
    executorRef.current.pause();
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resume = useCallback(() => {
    executorRef.current.resume();
    setState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const stop = useCallback(() => {
    executorRef.current.stop();
    setState({
      isExecuting: false,
      isPaused: false,
      progress: 0,
    });
    setIsAnimating(false);
  }, [setIsAnimating]);

  // Cleanup on unmount
  useEffect(() => {
    const executor = executorRef.current;
    return () => {
      executor.stop();
    };
  }, []);

  return {
    state,
    moveToPosition,
    executeWaypoints,
    pause,
    resume,
    stop,
  };
};
