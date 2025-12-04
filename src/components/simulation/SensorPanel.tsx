import React, { useState } from 'react';
import {
  Activity,
  Battery,
  Gauge,
  Compass,
  Navigation,
  Thermometer,
  Hand,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { useSensorSimulation } from '../../hooks';

type SensorTab = 'basic' | 'motion' | 'position';

export const SensorPanel: React.FC = () => {
  const { sensors, joints, isAnimating } = useAppStore();
  const [activeTab, setActiveTab] = useState<SensorTab>('basic');
  const [isExpanded, setIsExpanded] = useState(true);

  // Run sensor simulation
  useSensorSimulation(50);

  const tabs: { id: SensorTab; label: string }[] = [
    { id: 'basic', label: 'Basic' },
    { id: 'motion', label: 'Motion' },
    { id: 'position', label: 'Position' },
  ];

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-slate-800/80 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-slate-300">Sensors</h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isAnimating
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-green-500/20 text-green-400'
            }`}
          >
            {isAnimating ? 'Moving' : 'Ready'}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {isExpanded && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/50'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {activeTab === 'basic' && (
              <BasicSensors sensors={sensors} joints={joints} />
            )}
            {activeTab === 'motion' && <MotionSensors sensors={sensors} />}
            {activeTab === 'position' && <PositionSensors sensors={sensors} />}
          </div>
        </>
      )}
    </div>
  );
};

// Basic Sensors Tab
const BasicSensors: React.FC<{
  sensors: ReturnType<typeof useAppStore>['sensors'];
  joints: ReturnType<typeof useAppStore>['joints'];
}> = ({ sensors, joints }) => (
  <div className="space-y-3">
    {/* Gripper */}
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">Gripper</span>
        <span className="text-slate-300">{joints.gripper.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${joints.gripper}%` }}
        />
      </div>
    </div>

    {/* Ultrasonic */}
    <SensorRow
      label="Ultrasonic"
      value={`${sensors.ultrasonic?.toFixed(1) ?? '--'} cm`}
      icon={<Gauge className="w-3 h-3" />}
    />

    {/* IR Sensors */}
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">IR Sensors</span>
      <div className="flex gap-1">
        <IRIndicator active={sensors.leftIR} label="L" />
        <IRIndicator active={sensors.centerIR} label="C" />
        <IRIndicator active={sensors.rightIR} label="R" />
      </div>
    </div>

    {/* Touch Sensors */}
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400 flex items-center gap-1">
        <Hand className="w-3 h-3" />
        Touch
      </span>
      <div className="flex gap-1">
        <TouchIndicator active={sensors.touchSensors?.gripperLeft} label="GL" />
        <TouchIndicator active={sensors.touchSensors?.gripperRight} label="GR" />
        <TouchIndicator active={sensors.touchSensors?.base} label="B" />
      </div>
    </div>

    {/* Temperature */}
    <SensorRow
      label="Temperature"
      value={`${sensors.temperature?.toFixed(1) ?? '--'}°C`}
      icon={<Thermometer className="w-3 h-3" />}
      valueColor={
        (sensors.temperature ?? 25) > 60
          ? 'text-red-400'
          : (sensors.temperature ?? 25) > 40
          ? 'text-yellow-400'
          : 'text-green-400'
      }
    />

    {/* Battery */}
    <SensorRow
      label="Battery"
      value={`${sensors.battery?.toFixed(0) ?? '--'}%`}
      icon={<Battery className="w-3 h-3" />}
      valueColor={
        (sensors.battery ?? 100) > 20 ? 'text-green-400' : 'text-red-400'
      }
    />
  </div>
);

// Motion Sensors Tab
const MotionSensors: React.FC<{
  sensors: ReturnType<typeof useAppStore>['sensors'];
}> = ({ sensors }) => (
  <div className="space-y-3">
    {/* IMU / Orientation */}
    <div>
      <div className="flex items-center gap-1 mb-2">
        <Compass className="w-3 h-3 text-slate-400" />
        <span className="text-xs text-slate-400">IMU Orientation</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Vector3Display
          label="Roll"
          value={sensors.imu?.roll ?? 0}
          unit="°"
          color="text-red-400"
        />
        <Vector3Display
          label="Pitch"
          value={sensors.imu?.pitch ?? 0}
          unit="°"
          color="text-green-400"
        />
        <Vector3Display
          label="Yaw"
          value={sensors.imu?.yaw ?? 0}
          unit="°"
          color="text-blue-400"
        />
      </div>
    </div>

    {/* Accelerometer */}
    <div>
      <div className="flex items-center gap-1 mb-2">
        <Activity className="w-3 h-3 text-slate-400" />
        <span className="text-xs text-slate-400">Accelerometer (m/s²)</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Vector3Display
          label="X"
          value={sensors.accelerometer?.x ?? 0}
          color="text-red-400"
        />
        <Vector3Display
          label="Y"
          value={sensors.accelerometer?.y ?? 0}
          color="text-green-400"
        />
        <Vector3Display
          label="Z"
          value={sensors.accelerometer?.z ?? 0}
          color="text-blue-400"
        />
      </div>
    </div>

    {/* Gyroscope */}
    <div>
      <div className="flex items-center gap-1 mb-2">
        <Gauge className="w-3 h-3 text-slate-400" />
        <span className="text-xs text-slate-400">Gyroscope (°/s)</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Vector3Display
          label="X"
          value={sensors.gyroscope?.x ?? 0}
          color="text-red-400"
        />
        <Vector3Display
          label="Y"
          value={sensors.gyroscope?.y ?? 0}
          color="text-green-400"
        />
        <Vector3Display
          label="Z"
          value={sensors.gyroscope?.z ?? 0}
          color="text-blue-400"
        />
      </div>
    </div>
  </div>
);

// Position Sensors Tab
const PositionSensors: React.FC<{
  sensors: ReturnType<typeof useAppStore>['sensors'];
}> = ({ sensors }) => (
  <div className="space-y-3">
    {/* GPS Position */}
    <div>
      <div className="flex items-center gap-1 mb-2">
        <Navigation className="w-3 h-3 text-slate-400" />
        <span className="text-xs text-slate-400">GPS Position (meters)</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Vector3Display
          label="X"
          value={sensors.gps?.x ?? 0}
          precision={3}
          color="text-red-400"
        />
        <Vector3Display
          label="Y"
          value={sensors.gps?.y ?? 0}
          precision={3}
          color="text-green-400"
        />
        <Vector3Display
          label="Z"
          value={sensors.gps?.z ?? 0}
          precision={3}
          color="text-blue-400"
        />
      </div>
    </div>

    {/* Position Visual */}
    <div className="bg-slate-900/50 rounded-lg p-2">
      <div className="text-xs text-slate-500 mb-2">Top-Down View</div>
      <div className="relative w-full h-24 bg-slate-800 rounded border border-slate-700">
        {/* Grid */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="border border-slate-700/30" />
          ))}
        </div>
        {/* Robot position dot */}
        <div
          className="absolute w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-blue-500/50"
          style={{
            left: `${50 + (sensors.gps?.x ?? 0) * 200}%`,
            top: `${50 - (sensors.gps?.z ?? 0) * 200}%`,
          }}
        />
        {/* Center marker */}
        <div className="absolute left-1/2 top-1/2 w-1 h-1 bg-slate-600 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>

    {/* Height indicator */}
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">Height (Y)</span>
        <span className="text-slate-300 font-mono">
          {((sensors.gps?.y ?? 0) * 100).toFixed(1)} cm
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all duration-200"
          style={{ width: `${Math.min(100, (sensors.gps?.y ?? 0) * 250)}%` }}
        />
      </div>
    </div>
  </div>
);

// Helper Components
const SensorRow: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueColor?: string;
}> = ({ label, value, icon, valueColor = 'text-slate-300' }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-slate-400 flex items-center gap-1">
      {icon}
      {label}
    </span>
    <span className={`text-xs font-mono ${valueColor}`}>{value}</span>
  </div>
);

const Vector3Display: React.FC<{
  label: string;
  value: number;
  unit?: string;
  precision?: number;
  color?: string;
}> = ({ label, value, unit = '', precision = 1, color = 'text-slate-300' }) => (
  <div className="bg-slate-900/50 rounded px-2 py-1">
    <div className="text-slate-500 text-[10px]">{label}</div>
    <div className={`font-mono ${color}`}>
      {value.toFixed(precision)}
      {unit}
    </div>
  </div>
);

const IRIndicator: React.FC<{ active?: boolean; label: string }> = ({
  active,
  label,
}) => (
  <div
    className={`w-6 h-5 rounded text-[10px] flex items-center justify-center font-medium ${
      active
        ? 'bg-red-500/30 text-red-400 border border-red-500/50'
        : 'bg-slate-700/50 text-slate-500 border border-slate-600/50'
    }`}
  >
    {label}
  </div>
);

const TouchIndicator: React.FC<{ active?: boolean; label: string }> = ({
  active,
  label,
}) => (
  <div
    className={`w-6 h-5 rounded text-[10px] flex items-center justify-center font-medium ${
      active
        ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
        : 'bg-slate-700/50 text-slate-500 border border-slate-600/50'
    }`}
  >
    {label}
  </div>
);
