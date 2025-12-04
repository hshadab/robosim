import React, { useState } from 'react';
import { Sliders, Car, Plane, User } from 'lucide-react';
import { Slider } from '../common';
import { useAppStore } from '../../stores/useAppStore';

export const JointControls: React.FC = () => {
  const {
    joints,
    setJoints,
    selectedRobot,
    isAnimating,
    activeRobotType,
    wheeledRobot,
    setWheeledRobot,
    drone,
    setDrone,
    humanoid,
    setHumanoid,
  } = useAppStore();
  const [humanoidTab, setHumanoidTab] = useState<'legs' | 'arms'>('legs');

  if (!selectedRobot) return null;

  // Arm controls
  if (activeRobotType === 'arm') {
    const jointColors = {
      base: '#3B82F6',
      shoulder: '#8B5CF6',
      elbow: '#06B6D4',
      wrist: '#10B981',
      gripper: '#F97316',
    };

    const jointLabels = {
      base: 'Base',
      shoulder: 'Shoulder',
      elbow: 'Elbow',
      wrist: 'Wrist',
      gripper: 'Gripper',
    };

    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-300">Arm Control</h3>
        </div>

        <div className="space-y-1">
          {(Object.keys(jointLabels) as (keyof typeof jointLabels)[]).map(
            (joint) => (
              <Slider
                key={joint}
                label={jointLabels[joint]}
                value={joints[joint]}
                min={selectedRobot.limits[joint].min}
                max={selectedRobot.limits[joint].max}
                onChange={(value) => setJoints({ [joint]: value })}
                unit={joint === 'gripper' ? '%' : '°'}
                color={jointColors[joint]}
                disabled={isAnimating}
              />
            )
          )}
        </div>
      </div>
    );
  }

  // Wheeled robot controls
  if (activeRobotType === 'wheeled') {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Car className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-slate-300">Motor Control</h3>
        </div>

        <div className="space-y-1">
          <Slider
            label="Left Motor"
            value={wheeledRobot.leftWheelSpeed}
            min={-255}
            max={255}
            onChange={(value) => setWheeledRobot({ leftWheelSpeed: value })}
            unit=""
            color="#22C55E"
            disabled={isAnimating}
          />
          <Slider
            label="Right Motor"
            value={wheeledRobot.rightWheelSpeed}
            min={-255}
            max={255}
            onChange={(value) => setWheeledRobot({ rightWheelSpeed: value })}
            unit=""
            color="#16A34A"
            disabled={isAnimating}
          />
          <Slider
            label="Servo Head"
            value={wheeledRobot.servoHead}
            min={-90}
            max={90}
            onChange={(value) => setWheeledRobot({ servoHead: value })}
            unit="°"
            color="#4ADE80"
            disabled={isAnimating}
          />
        </div>

        {/* Quick movement buttons */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={() => setWheeledRobot({ leftWheelSpeed: 150, rightWheelSpeed: 150 })}
            disabled={isAnimating}
            className="px-2 py-1.5 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/30 hover:bg-green-600/30 disabled:opacity-50"
          >
            Forward
          </button>
          <button
            onClick={() => setWheeledRobot({ leftWheelSpeed: 0, rightWheelSpeed: 0 })}
            disabled={isAnimating}
            className="px-2 py-1.5 text-xs bg-red-600/20 text-red-400 rounded border border-red-600/30 hover:bg-red-600/30 disabled:opacity-50"
          >
            Stop
          </button>
          <button
            onClick={() => setWheeledRobot({ leftWheelSpeed: -150, rightWheelSpeed: -150 })}
            disabled={isAnimating}
            className="px-2 py-1.5 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/30 hover:bg-green-600/30 disabled:opacity-50"
          >
            Backward
          </button>
          <button
            onClick={() => setWheeledRobot({ leftWheelSpeed: -100, rightWheelSpeed: 100 })}
            disabled={isAnimating}
            className="px-2 py-1.5 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-600/30 hover:bg-blue-600/30 disabled:opacity-50"
          >
            Turn Left
          </button>
          <button
            onClick={() => setWheeledRobot({ servoHead: 0 })}
            disabled={isAnimating}
            className="px-2 py-1.5 text-xs bg-slate-600/20 text-slate-400 rounded border border-slate-600/30 hover:bg-slate-600/30 disabled:opacity-50"
          >
            Center
          </button>
          <button
            onClick={() => setWheeledRobot({ leftWheelSpeed: 100, rightWheelSpeed: -100 })}
            disabled={isAnimating}
            className="px-2 py-1.5 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-600/30 hover:bg-blue-600/30 disabled:opacity-50"
          >
            Turn Right
          </button>
        </div>
      </div>
    );
  }

  // Drone controls
  if (activeRobotType === 'drone') {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Plane className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-300">Flight Control</h3>
        </div>

        <div className="space-y-1">
          <Slider
            label="Throttle"
            value={drone.throttle}
            min={0}
            max={100}
            onChange={(value) => setDrone({ throttle: value })}
            unit="%"
            color="#A855F7"
            disabled={isAnimating || !drone.armed}
          />
          <Slider
            label="Roll"
            value={drone.rotation.x}
            min={-45}
            max={45}
            onChange={(value) => setDrone({ rotation: { ...drone.rotation, x: value } })}
            unit="°"
            color="#8B5CF6"
            disabled={isAnimating || !drone.armed}
          />
          <Slider
            label="Pitch"
            value={drone.rotation.z}
            min={-45}
            max={45}
            onChange={(value) => setDrone({ rotation: { ...drone.rotation, z: value } })}
            unit="°"
            color="#7C3AED"
            disabled={isAnimating || !drone.armed}
          />
          <Slider
            label="Yaw"
            value={drone.rotation.y}
            min={-180}
            max={180}
            onChange={(value) => setDrone({ rotation: { ...drone.rotation, y: value } })}
            unit="°"
            color="#6D28D9"
            disabled={isAnimating || !drone.armed}
          />
        </div>

        {/* Flight mode buttons */}
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setDrone({ armed: !drone.armed, throttle: 0 })}
              className={`flex-1 px-3 py-2 text-xs rounded border transition-colors ${
                drone.armed
                  ? 'bg-red-600/20 text-red-400 border-red-600/30 hover:bg-red-600/30'
                  : 'bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/30'
              }`}
            >
              {drone.armed ? 'DISARM' : 'ARM'}
            </button>
            <button
              onClick={() => setDrone({ flightMode: 'land', throttle: 0 })}
              disabled={!drone.armed}
              className="flex-1 px-3 py-2 text-xs bg-yellow-600/20 text-yellow-400 rounded border border-yellow-600/30 hover:bg-yellow-600/30 disabled:opacity-50"
            >
              Land
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDrone({ flightMode: 'stabilize' })}
              disabled={!drone.armed}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                drone.flightMode === 'stabilize'
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-600/50'
              } disabled:opacity-50`}
            >
              Stabilize
            </button>
            <button
              onClick={() => setDrone({ flightMode: 'altitude_hold' })}
              disabled={!drone.armed}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                drone.flightMode === 'altitude_hold'
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-600/50'
              } disabled:opacity-50`}
            >
              Alt Hold
            </button>
            <button
              onClick={() => setDrone({ flightMode: 'position_hold' })}
              disabled={!drone.armed}
              className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                drone.flightMode === 'position_hold'
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-slate-600/50'
              } disabled:opacity-50`}
            >
              Pos Hold
            </button>
            <button
              onClick={() => {
                setDrone({ armed: true, throttle: 50, flightMode: 'altitude_hold' });
              }}
              disabled={drone.armed}
              className="px-2 py-1.5 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/30 hover:bg-green-600/30 disabled:opacity-50"
            >
              Takeoff
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Humanoid controls
  if (activeRobotType === 'humanoid') {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-300">Humanoid Control</h3>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setHumanoidTab('legs')}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              humanoidTab === 'legs'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
            }`}
          >
            Legs
          </button>
          <button
            onClick={() => setHumanoidTab('arms')}
            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
              humanoidTab === 'arms'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50'
                : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
            }`}
          >
            Arms
          </button>
        </div>

        {humanoidTab === 'legs' && (
          <div className="space-y-3">
            {/* Left Leg */}
            <div>
              <div className="text-xs text-slate-500 mb-1">Left Leg</div>
              <div className="space-y-0.5">
                <Slider label="Hip Pitch" value={humanoid.leftHipPitch} min={-60} max={60}
                  onChange={(v) => setHumanoid({ leftHipPitch: v })} unit="°" color="#3B82F6" disabled={isAnimating} />
                <Slider label="Hip Roll" value={humanoid.leftHipRoll} min={-30} max={30}
                  onChange={(v) => setHumanoid({ leftHipRoll: v })} unit="°" color="#60A5FA" disabled={isAnimating} />
                <Slider label="Knee" value={humanoid.leftKnee} min={0} max={120}
                  onChange={(v) => setHumanoid({ leftKnee: v })} unit="°" color="#93C5FD" disabled={isAnimating} />
              </div>
            </div>
            {/* Right Leg */}
            <div>
              <div className="text-xs text-slate-500 mb-1">Right Leg</div>
              <div className="space-y-0.5">
                <Slider label="Hip Pitch" value={humanoid.rightHipPitch} min={-60} max={60}
                  onChange={(v) => setHumanoid({ rightHipPitch: v })} unit="°" color="#22C55E" disabled={isAnimating} />
                <Slider label="Hip Roll" value={humanoid.rightHipRoll} min={-30} max={30}
                  onChange={(v) => setHumanoid({ rightHipRoll: v })} unit="°" color="#4ADE80" disabled={isAnimating} />
                <Slider label="Knee" value={humanoid.rightKnee} min={0} max={120}
                  onChange={(v) => setHumanoid({ rightKnee: v })} unit="°" color="#86EFAC" disabled={isAnimating} />
              </div>
            </div>
          </div>
        )}

        {humanoidTab === 'arms' && (
          <div className="space-y-3">
            {/* Left Arm */}
            <div>
              <div className="text-xs text-slate-500 mb-1">Left Arm</div>
              <div className="space-y-0.5">
                <Slider label="Shoulder" value={humanoid.leftShoulderPitch} min={-180} max={60}
                  onChange={(v) => setHumanoid({ leftShoulderPitch: v })} unit="°" color="#8B5CF6" disabled={isAnimating} />
                <Slider label="Elbow" value={humanoid.leftElbow} min={0} max={135}
                  onChange={(v) => setHumanoid({ leftElbow: v })} unit="°" color="#A78BFA" disabled={isAnimating} />
                <Slider label="Wrist" value={humanoid.leftWrist} min={-90} max={90}
                  onChange={(v) => setHumanoid({ leftWrist: v })} unit="°" color="#C4B5FD" disabled={isAnimating} />
              </div>
            </div>
            {/* Right Arm */}
            <div>
              <div className="text-xs text-slate-500 mb-1">Right Arm</div>
              <div className="space-y-0.5">
                <Slider label="Shoulder" value={humanoid.rightShoulderPitch} min={-180} max={60}
                  onChange={(v) => setHumanoid({ rightShoulderPitch: v })} unit="°" color="#F97316" disabled={isAnimating} />
                <Slider label="Elbow" value={humanoid.rightElbow} min={0} max={135}
                  onChange={(v) => setHumanoid({ rightElbow: v })} unit="°" color="#FB923C" disabled={isAnimating} />
                <Slider label="Wrist" value={humanoid.rightWrist} min={-90} max={90}
                  onChange={(v) => setHumanoid({ rightWrist: v })} unit="°" color="#FDBA74" disabled={isAnimating} />
              </div>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setHumanoid({ isWalking: !humanoid.isWalking })}
            className={`px-2 py-1.5 text-xs rounded border transition-colors ${
              humanoid.isWalking
                ? 'bg-green-600/30 text-green-300 border-green-500/50'
                : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
            }`}
          >
            {humanoid.isWalking ? 'Stop Walk' : 'Walk'}
          </button>
          <button
            onClick={() => setHumanoid({
              leftHipPitch: 0, leftHipRoll: 0, leftHipYaw: 0, leftKnee: 0, leftAnklePitch: 0, leftAnkleRoll: 0,
              rightHipPitch: 0, rightHipRoll: 0, rightHipYaw: 0, rightKnee: 0, rightAnklePitch: 0, rightAnkleRoll: 0,
              leftShoulderPitch: 0, leftShoulderRoll: 0, leftShoulderYaw: 0, leftElbow: 0, leftWrist: 0,
              rightShoulderPitch: 0, rightShoulderRoll: 0, rightShoulderYaw: 0, rightElbow: 0, rightWrist: 0,
              isWalking: false,
            })}
            className="px-2 py-1.5 text-xs bg-slate-700/50 text-slate-400 rounded border border-slate-600/50 hover:bg-slate-600/50"
          >
            Reset Pose
          </button>
          <button
            onClick={() => setHumanoid({
              leftShoulderPitch: -45, rightShoulderPitch: -45,
              leftElbow: 90, rightElbow: 90,
            })}
            className="px-2 py-1.5 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-600/30 hover:bg-blue-600/30"
          >
            Wave
          </button>
          <button
            onClick={() => setHumanoid({
              leftKnee: 45, rightKnee: 45,
              leftHipPitch: -30, rightHipPitch: -30,
            })}
            className="px-2 py-1.5 text-xs bg-purple-600/20 text-purple-400 rounded border border-purple-600/30 hover:bg-purple-600/30"
          >
            Squat
          </button>
        </div>
      </div>
    );
  }

  return null;
};
