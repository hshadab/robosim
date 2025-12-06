/**
 * Advanced Controls Panel for SO-101 Robot Arm
 *
 * Provides controls for:
 * - Click-to-move (IK) mode
 * - Keyboard teleoperation
 * - Gamepad support
 * - Workspace visualization
 * - Trajectory recording
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  MousePointer2,
  Keyboard,
  Gamepad2,
  Activity,
  Layers,
  Settings,
  ChevronDown,
  ChevronUp,
  Circle,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { JointState } from '../../types';

type ControlMode = 'manual' | 'click-to-move' | 'keyboard' | 'gamepad';

interface AdvancedControlsPanelProps {
  onModeChange?: (mode: ControlMode) => void;
  onShowWorkspace?: (show: boolean) => void;
}

export const AdvancedControlsPanel: React.FC<AdvancedControlsPanelProps> = ({
  onModeChange,
  onShowWorkspace,
}) => {
  const { setJoints, activeRobotType } = useAppStore();

  const [controlMode, setControlMode] = useState<ControlMode>('manual');
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [keyboardActive, setKeyboardActive] = useState(false);

  // Keyboard control state
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // Handle mode changes
  const handleModeChange = useCallback(
    (mode: ControlMode) => {
      setControlMode(mode);
      onModeChange?.(mode);
    },
    [onModeChange]
  );

  // Handle workspace visibility
  const handleWorkspaceToggle = useCallback(() => {
    const newValue = !showWorkspace;
    setShowWorkspace(newValue);
    onShowWorkspace?.(newValue);
  }, [showWorkspace, onShowWorkspace]);

  // Keyboard controls
  useEffect(() => {
    if (controlMode !== 'keyboard' || activeRobotType !== 'arm') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      setPressedKeys((prev) => new Set(prev).add(e.key.toLowerCase()));
      setKeyboardActive(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.key.toLowerCase());
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      setKeyboardActive(false);
    };
  }, [controlMode, activeRobotType]);

  // Process keyboard input
  useEffect(() => {
    if (controlMode !== 'keyboard' || pressedKeys.size === 0) return;

    const speed = 2; // Degrees per frame
    const interval = setInterval(() => {
      // Get current state from store
      const currentJoints = useAppStore.getState().joints;
      const updates: Partial<JointState> = {};

      // WASD for base and shoulder
      if (pressedKeys.has('a')) updates.base = Math.max(-110, currentJoints.base - speed);
      if (pressedKeys.has('d')) updates.base = Math.min(110, currentJoints.base + speed);
      if (pressedKeys.has('w')) updates.shoulder = Math.max(-100, currentJoints.shoulder - speed);
      if (pressedKeys.has('s')) updates.shoulder = Math.min(100, currentJoints.shoulder + speed);

      // Arrow keys for elbow and wrist
      if (pressedKeys.has('arrowup')) updates.elbow = Math.max(-97, currentJoints.elbow - speed);
      if (pressedKeys.has('arrowdown')) updates.elbow = Math.min(97, currentJoints.elbow + speed);
      if (pressedKeys.has('arrowleft')) updates.wrist = Math.max(-95, currentJoints.wrist - speed);
      if (pressedKeys.has('arrowright')) updates.wrist = Math.min(95, currentJoints.wrist + speed);

      // Q/E for wrist roll
      if (pressedKeys.has('q')) updates.wristRoll = Math.max(-157, currentJoints.wristRoll - speed);
      if (pressedKeys.has('e')) updates.wristRoll = Math.min(163, currentJoints.wristRoll + speed);

      // Space/Shift for gripper
      if (pressedKeys.has(' ')) updates.gripper = Math.min(100, currentJoints.gripper + speed * 2);
      if (pressedKeys.has('shift')) updates.gripper = Math.max(0, currentJoints.gripper - speed * 2);

      if (Object.keys(updates).length > 0) {
        setJoints(updates);
      }
    }, 33); // ~30fps

    return () => clearInterval(interval);
  }, [controlMode, pressedKeys, setJoints]);

  // Gamepad detection
  useEffect(() => {
    const handleGamepadConnected = () => {
      setGamepadConnected(true);
    };

    const handleGamepadDisconnected = () => {
      setGamepadConnected(false);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // Check for already connected gamepads
    const gamepads = navigator.getGamepads();
    setGamepadConnected(gamepads.some((gp) => gp !== null));

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    };
  }, []);

  // Gamepad input processing
  useEffect(() => {
    if (controlMode !== 'gamepad' || !gamepadConnected || activeRobotType !== 'arm') return;

    const processGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gamepad = gamepads.find((gp) => gp !== null);

      if (!gamepad) return;

      const deadzone = 0.15;
      const speed = 3;

      // Get current state from store
      const currentJoints = useAppStore.getState().joints;
      const updates: Partial<JointState> = {};

      // Left stick: base (X) and shoulder (Y)
      const lx = Math.abs(gamepad.axes[0]) > deadzone ? gamepad.axes[0] : 0;
      const ly = Math.abs(gamepad.axes[1]) > deadzone ? gamepad.axes[1] : 0;
      if (lx !== 0) updates.base = Math.max(-110, Math.min(110, currentJoints.base + lx * speed));
      if (ly !== 0) updates.shoulder = Math.max(-100, Math.min(100, currentJoints.shoulder + ly * speed));

      // Right stick: elbow (Y) and wrist (X)
      const rx = Math.abs(gamepad.axes[2]) > deadzone ? gamepad.axes[2] : 0;
      const ry = Math.abs(gamepad.axes[3]) > deadzone ? gamepad.axes[3] : 0;
      if (rx !== 0) updates.wrist = Math.max(-95, Math.min(95, currentJoints.wrist + rx * speed));
      if (ry !== 0) updates.elbow = Math.max(-97, Math.min(97, currentJoints.elbow + ry * speed));

      // Triggers: gripper
      const lt = gamepad.buttons[6]?.value || 0; // Left trigger - close
      const rt = gamepad.buttons[7]?.value || 0; // Right trigger - open
      if (lt !== 0 || rt !== 0) {
        updates.gripper = Math.max(0, Math.min(100, currentJoints.gripper + (rt - lt) * speed * 2));
      }

      // Bumpers: wrist roll
      const lb = gamepad.buttons[4]?.pressed ? 1 : 0;
      const rb = gamepad.buttons[5]?.pressed ? 1 : 0;
      if (lb !== 0 || rb !== 0) {
        updates.wristRoll = Math.max(-157, Math.min(163, currentJoints.wristRoll + (rb - lb) * speed));
      }

      if (Object.keys(updates).length > 0) {
        setJoints(updates);
      }
    };

    const interval = setInterval(processGamepad, 33);
    return () => clearInterval(interval);
  }, [controlMode, gamepadConnected, activeRobotType, setJoints]);

  // Only show for arm robot
  if (activeRobotType !== 'arm') return null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" />
          Advanced Controls
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Control Mode Selector */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        <button
          onClick={() => handleModeChange('manual')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors ${
            controlMode === 'manual'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
          }`}
          title="Manual joint control"
        >
          <Activity className="w-4 h-4" />
          <span>Manual</span>
        </button>

        <button
          onClick={() => handleModeChange('click-to-move')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors ${
            controlMode === 'click-to-move'
              ? 'bg-green-600 text-white'
              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
          }`}
          title="Click in 3D to move (Inverse Kinematics)"
        >
          <MousePointer2 className="w-4 h-4" />
          <span>Click</span>
        </button>

        <button
          onClick={() => handleModeChange('keyboard')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors ${
            controlMode === 'keyboard'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
          }`}
          title="Keyboard teleoperation"
        >
          <Keyboard className="w-4 h-4" />
          <span>Keys</span>
        </button>

        <button
          onClick={() => handleModeChange('gamepad')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors ${
            controlMode === 'gamepad'
              ? 'bg-orange-600 text-white'
              : gamepadConnected
              ? 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
          }`}
          title={gamepadConnected ? 'Gamepad control' : 'No gamepad connected'}
          disabled={!gamepadConnected}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>Pad</span>
          {gamepadConnected && (
            <Circle className="w-2 h-2 fill-green-400 text-green-400 absolute -top-1 -right-1" />
          )}
        </button>
      </div>

      {/* Mode-specific help */}
      {controlMode === 'keyboard' && (
        <div className="mb-3 p-2 bg-slate-900/50 rounded-lg text-xs">
          <div className="text-purple-400 font-medium mb-2">Keyboard Controls:</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
            <div className="flex items-center gap-1">
              <kbd className="px-1 bg-slate-700 rounded text-[10px]">W</kbd>
              <kbd className="px-1 bg-slate-700 rounded text-[10px]">S</kbd>
              <span>Shoulder</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1 bg-slate-700 rounded text-[10px]">A</kbd>
              <kbd className="px-1 bg-slate-700 rounded text-[10px]">D</kbd>
              <span>Base</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              <ArrowDown className="w-3 h-3" />
              <span>Elbow</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              <ArrowRight className="w-3 h-3" />
              <span>Wrist</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1 bg-slate-700 rounded text-[10px]">Q</kbd>
              <kbd className="px-1 bg-slate-700 rounded text-[10px]">E</kbd>
              <span>Roll</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 bg-slate-700 rounded text-[10px]">␣</kbd>
              <kbd className="px-1 bg-slate-700 rounded text-[10px]">⇧</kbd>
              <span>Gripper</span>
            </div>
          </div>
        </div>
      )}

      {controlMode === 'gamepad' && gamepadConnected && (
        <div className="mb-3 p-2 bg-slate-900/50 rounded-lg text-xs">
          <div className="text-orange-400 font-medium mb-2">Gamepad Controls:</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
            <div>Left Stick: Base/Shoulder</div>
            <div>Right Stick: Elbow/Wrist</div>
            <div>Bumpers: Wrist Roll</div>
            <div>Triggers: Gripper</div>
          </div>
        </div>
      )}

      {controlMode === 'click-to-move' && (
        <div className="mb-3 p-2 bg-slate-900/50 rounded-lg text-xs">
          <div className="text-green-400 font-medium mb-1">Click-to-Move (IK):</div>
          <div className="text-slate-400">
            Click anywhere in the 3D view to move the gripper to that position.
            Green = reachable, Red = out of range.
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="pt-3 border-t border-slate-700/50 space-y-2">
          {/* Workspace Visualization Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Show Workspace
            </span>
            <button
              onClick={handleWorkspaceToggle}
              className={`w-10 h-5 rounded-full transition-colors ${
                showWorkspace ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  showWorkspace ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Active mode indicator */}
      {(keyboardActive || controlMode === 'gamepad') && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-400">
            {controlMode === 'keyboard' ? 'Keyboard active' : 'Gamepad active'}
          </span>
        </div>
      )}
    </div>
  );
};
