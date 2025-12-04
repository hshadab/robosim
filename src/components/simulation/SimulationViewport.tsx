import React, { useState, Suspense } from 'react';
import { RotateCcw, Camera, Maximize2, Box, Square, Radio } from 'lucide-react';
import { RobotArm } from './RobotArm';
import { RobotArm3D } from './RobotArm3D';
import { RobotCameraOverlay } from './RobotCameraView';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { useGripperInteraction } from '../../hooks/useGripperInteraction';

export const SimulationViewport: React.FC = () => {
  const {
    joints,
    selectedRobot,
    simulation,
    setJoints,
    isAnimating,
    currentEnvironment,
    objects,
    targetZones,
    sensors,
    sensorVisualization,
    activeRobotType,
    wheeledRobot,
    drone,
    humanoid,
  } = useAppStore();
  const [view3D, setView3D] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<'gripper' | 'base' | 'overhead'>('gripper');

  // Enable gripper interaction with objects
  useGripperInteraction();

  const handleReset = () => {
    if (selectedRobot && !isAnimating) {
      setJoints(selectedRobot.defaultPosition);
    }
  };

  const toggleCameraPosition = () => {
    const positions: Array<'gripper' | 'base' | 'overhead'> = ['gripper', 'base', 'overhead'];
    const currentIndex = positions.indexOf(cameraPosition);
    setCameraPosition(positions[(currentIndex + 1) % positions.length]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Viewport Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">
            {view3D ? '3D' : '2D'} Simulation
          </span>
          {simulation.status === 'running' && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Running
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 2D/3D Toggle */}
          <Button
            variant={view3D ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setView3D(true)}
            title="3D View"
          >
            <Box className="w-4 h-4" />
          </Button>
          <Button
            variant={!view3D ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setView3D(false)}
            title="2D View"
          >
            <Square className="w-4 h-4" />
          </Button>
          <div className="w-px h-4 bg-slate-600 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isAnimating}
            title="Reset Position"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant={showCamera ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setShowCamera(!showCamera)}
            title="Robot Camera"
          >
            <Camera className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" title="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 relative">
        {view3D ? (
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-slate-900">
                <div className="text-slate-400">Loading 3D view...</div>
              </div>
            }
          >
            <RobotArm3D
              joints={joints}
              environment={currentEnvironment}
              objects={objects}
              targetZones={targetZones}
              sensors={sensors}
              sensorVisualization={sensorVisualization}
              activeRobotType={activeRobotType}
              wheeledRobot={wheeledRobot}
              drone={drone}
              humanoid={humanoid}
            />
          </Suspense>
        ) : (
          <RobotArm joints={joints} />
        )}

        {/* Robot Camera Overlay */}
        {showCamera && view3D && (
          <RobotCameraOverlay
            position="top-right"
            size="medium"
            cameraPosition={cameraPosition}
            onClose={() => setShowCamera(false)}
          />
        )}

        {/* Camera position toggle when camera is shown */}
        {showCamera && view3D && (
          <button
            onClick={toggleCameraPosition}
            className="absolute top-14 right-52 bg-slate-800/90 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 border border-slate-600"
          >
            <Radio className="w-3 h-3 inline mr-1" />
            {cameraPosition}
          </button>
        )}

        {/* Overlay status */}
        {isAnimating && (
          <div className="absolute top-3 right-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg px-3 py-1.5">
            <span className="text-sm text-yellow-400 font-medium flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Animating...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
