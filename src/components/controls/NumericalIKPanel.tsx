/**
 * Numerical IK Panel
 *
 * UI for configuring and testing the numerical inverse kinematics solver.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Target,
  Play,
  Settings,
  AlertTriangle,
  CheckCircle,
  Crosshair,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import {
  solveIK,
  solveIKMultiStart,
  getIKDiagnostics,
  generateIKTrajectory,
  type IKConfig,
  type IKResult,
  DEFAULT_IK_CONFIG,
} from '../../lib/numericalIK';
import { calculateSO101GripperPosition } from '../simulation/SO101Kinematics';

export const NumericalIKPanel: React.FC = () => {
  const { joints, setJoints, activeRobotType } = useAppStore();

  // Target position state
  const [targetX, setTargetX] = useState<number>(0.15);
  const [targetY, setTargetY] = useState<number>(0.25);
  const [targetZ, setTargetZ] = useState<number>(0);

  // Config state
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<IKConfig>({ ...DEFAULT_IK_CONFIG });

  // Result state
  const [lastResult, setLastResult] = useState<IKResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Diagnostics
  const [diagnostics, setDiagnostics] = useState<ReturnType<typeof getIKDiagnostics> | null>(null);

  // Update diagnostics when joints change
  useEffect(() => {
    if (activeRobotType === 'arm') {
      const diag = getIKDiagnostics(joints);
      setDiagnostics(diag);
    }
  }, [joints, activeRobotType]);

  // Set target to current gripper position
  const handleSetCurrentAsTarget = useCallback(() => {
    const pos = calculateSO101GripperPosition(joints);
    setTargetX(Number(pos[0].toFixed(4)));
    setTargetY(Number(pos[1].toFixed(4)));
    setTargetZ(Number(pos[2].toFixed(4)));
  }, [joints]);

  // Solve IK
  const handleSolveIK = useCallback(() => {
    setIsRunning(true);

    // Use requestAnimationFrame to not block UI
    requestAnimationFrame(() => {
      const result = solveIK(
        { position: { x: targetX, y: targetY, z: targetZ } },
        joints,
        config
      );

      setLastResult(result);

      if (result.success) {
        setJoints(result.joints);
      }

      setIsRunning(false);
    });
  }, [targetX, targetY, targetZ, joints, config, setJoints]);

  // Solve IK with multiple starting points
  const handleSolveIKMultiStart = useCallback(() => {
    setIsRunning(true);

    requestAnimationFrame(() => {
      const result = solveIKMultiStart(
        { position: { x: targetX, y: targetY, z: targetZ } },
        joints,
        5,
        config
      );

      setLastResult(result);

      if (result.success) {
        setJoints(result.joints);
      }

      setIsRunning(false);
    });
  }, [targetX, targetY, targetZ, joints, config, setJoints]);

  // Generate and execute trajectory
  const handleGenerateTrajectory = useCallback(() => {
    setIsRunning(true);

    const { waypoints, success } = generateIKTrajectory(
      joints,
      { x: targetX, y: targetY, z: targetZ },
      10,
      config
    );

    if (success && waypoints.length > 0) {
      // Animate through waypoints
      let i = 0;
      const interval = setInterval(() => {
        if (i >= waypoints.length) {
          clearInterval(interval);
          setIsRunning(false);
          return;
        }
        setJoints(waypoints[i]);
        i++;
      }, 50);
    } else {
      setIsRunning(false);
    }
  }, [targetX, targetY, targetZ, joints, config, setJoints]);

  // Only show for arm robots
  if (activeRobotType !== 'arm') {
    return null;
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-cyan-400" />
          Numerical IK
        </h3>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`p-1 transition-colors ${
            showConfig ? 'text-cyan-400' : 'text-slate-400 hover:text-white'
          }`}
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg space-y-3">
          <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Solver Configuration
          </div>

          {/* Method Selection */}
          <div className="flex gap-1">
            {(['dls', 'ccd'] as const).map((method) => (
              <button
                key={method}
                onClick={() => setConfig({ ...config, method })}
                className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                  config.method === method
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {method === 'dls' ? 'Damped LS' : 'CCD'}
              </button>
            ))}
          </div>

          {/* Max Iterations */}
          <div>
            <label className="text-xs text-slate-500">Max Iterations: {config.maxIterations}</label>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={config.maxIterations}
              onChange={(e) => setConfig({ ...config, maxIterations: parseInt(e.target.value) })}
              className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer"
            />
          </div>

          {/* Damping Factor */}
          <div>
            <label className="text-xs text-slate-500">
              Damping: {config.dampingFactor.toFixed(2)}
            </label>
            <input
              type="range"
              min={0.01}
              max={1}
              step={0.01}
              value={config.dampingFactor}
              onChange={(e) => setConfig({ ...config, dampingFactor: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer"
            />
          </div>

          {/* Step Size */}
          <div>
            <label className="text-xs text-slate-500">Step Size: {config.stepSize.toFixed(2)}</label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={config.stepSize}
              onChange={(e) => setConfig({ ...config, stepSize: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer"
            />
          </div>

          {/* Tolerance */}
          <div>
            <label className="text-xs text-slate-500">
              Tolerance: {(config.positionTolerance * 1000).toFixed(1)}mm
            </label>
            <input
              type="range"
              min={0.0005}
              max={0.01}
              step={0.0005}
              value={config.positionTolerance}
              onChange={(e) =>
                setConfig({ ...config, positionTolerance: parseFloat(e.target.value) })
              }
              className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Target Position */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Target Position (m)</span>
          <button
            onClick={handleSetCurrentAsTarget}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            title="Set current gripper position as target"
          >
            <Target className="w-3 h-3" />
            Use Current
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-slate-500">X</label>
            <input
              type="number"
              step={0.01}
              value={targetX}
              onChange={(e) => setTargetX(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Y</label>
            <input
              type="number"
              step={0.01}
              value={targetY}
              onChange={(e) => setTargetY(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Z</label>
            <input
              type="number"
              step={0.01}
              value={targetZ}
              onChange={(e) => setTargetZ(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Solve Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleSolveIK}
          disabled={isRunning}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded transition-colors disabled:bg-slate-700 disabled:text-slate-500"
        >
          {isRunning ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          Solve IK
        </button>
        <button
          onClick={handleSolveIKMultiStart}
          disabled={isRunning}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded transition-colors disabled:bg-slate-700 disabled:text-slate-500"
          title="Try multiple starting configurations"
        >
          Multi-Start
        </button>
      </div>

      <button
        onClick={handleGenerateTrajectory}
        disabled={isRunning}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded transition-colors disabled:bg-slate-700 disabled:text-slate-500 mb-3"
      >
        Animate Trajectory
      </button>

      {/* Result Display */}
      {lastResult && (
        <div
          className={`p-2 rounded-lg ${
            lastResult.converged
              ? 'bg-green-500/10 border border-green-500/30'
              : lastResult.success
              ? 'bg-yellow-500/10 border border-yellow-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {lastResult.converged ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            )}
            <span
              className={`text-xs font-medium ${
                lastResult.converged ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {lastResult.message}
            </span>
          </div>
          <div className="text-xs text-slate-400 grid grid-cols-2 gap-1">
            <span>Iterations: {lastResult.iterations}</span>
            <span>Error: {(lastResult.finalError * 1000).toFixed(2)}mm</span>
          </div>
        </div>
      )}

      {/* Diagnostics */}
      {diagnostics && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 mb-2">Current State</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-900/50 p-2 rounded">
              <span className="text-slate-400">Position</span>
              <div className="text-white font-mono">
                {diagnostics.gripperPosition.map((v) => v.toFixed(3)).join(', ')}
              </div>
            </div>
            <div className="bg-slate-900/50 p-2 rounded">
              <span className="text-slate-400">Manipulability</span>
              <div
                className={`font-mono ${
                  diagnostics.nearSingularity ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {diagnostics.manipulability.toFixed(4)}
              </div>
            </div>
            <div className="bg-slate-900/50 p-2 rounded">
              <span className="text-slate-400">Status</span>
              <div
                className={`font-medium ${
                  diagnostics.nearSingularity ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {diagnostics.nearSingularity ? 'Near Singularity' : 'OK'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
