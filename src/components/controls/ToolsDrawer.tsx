/**
 * Tools Drawer
 *
 * Slide-out drawer containing all advanced tools.
 * Hidden by default, accessible via settings button.
 */

import React, { useState } from 'react';
import {
  X,
  Sliders,
  Gamepad2,
  ListChecks,
  Box,
  BarChart3,
  Wifi,
  Hand,
  Camera,
  HardDrive,
  Activity,
  Brain,
  Search,
  Play,
  Database,
} from 'lucide-react';

// Import panel components
import { JointControls } from './JointControls';
import { PresetButtons } from './PresetButtons';
import { EnvironmentSelector } from './EnvironmentSelector';
import { ObjectLibraryPanel } from './ObjectLibraryPanel';
import { JointTrajectoryGraph } from './JointTrajectoryGraph';
import { SerialConnectionPanel } from './SerialConnectionPanel';
import { HandTrackingPanel } from './HandTrackingPanel';
import { VisionPanel } from './VisionPanel';
import { SaveLoadPanel } from './SaveLoadPanel';
import { SensorPanel } from '../simulation/SensorPanel';
import { PolicyBrowserPanel } from './PolicyBrowserPanel';
import { VoiceControlPanel } from './VoiceControlPanel';
import { DatasetBrowserPanel } from './DatasetBrowserPanel';
import { DatasetPlayerPanel } from './DatasetPlayer';
import { DatasetRecorderPanel } from './DatasetRecorder';
import { ImageTo3DPanel } from './ImageTo3DPanel';
import { TrainingDashboard } from './TrainingDashboard';

interface ToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type DrawerSection = 'control' | 'hardware' | 'ai' | 'data';

interface SectionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export const ToolsDrawer: React.FC<ToolsDrawerProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<DrawerSection>('control');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const sections: Record<DrawerSection, { label: string; items: SectionItem[] }> = {
    control: {
      label: 'Control',
      items: [
        { id: 'joints', label: 'Joint Controls', icon: <Sliders className="w-4 h-4" />, content: <JointControls /> },
        { id: 'presets', label: 'Presets', icon: <ListChecks className="w-4 h-4" />, content: <PresetButtons /> },
        { id: 'environment', label: 'Environment', icon: <Gamepad2 className="w-4 h-4" />, content: <EnvironmentSelector /> },
        { id: 'objects', label: 'Object Library', icon: <Box className="w-4 h-4" />, content: <ObjectLibraryPanel /> },
        { id: 'trajectory', label: 'Trajectory', icon: <BarChart3 className="w-4 h-4" />, content: <JointTrajectoryGraph height={150} /> },
      ],
    },
    hardware: {
      label: 'Hardware',
      items: [
        { id: 'serial', label: 'Connect Robot', icon: <Wifi className="w-4 h-4" />, content: <SerialConnectionPanel /> },
        { id: 'hand', label: 'Hand Tracking', icon: <Hand className="w-4 h-4" />, content: <HandTrackingPanel /> },
        { id: 'sensors', label: 'Sensors', icon: <Activity className="w-4 h-4" />, content: <SensorPanel /> },
        { id: 'vision', label: 'Robot Vision', icon: <Camera className="w-4 h-4" />, content: <VisionPanel /> },
      ],
    },
    ai: {
      label: 'AI',
      items: [
        { id: 'voice', label: 'Voice Control', icon: <Brain className="w-4 h-4" />, content: <VoiceControlPanel /> },
        { id: 'policies', label: 'LeRobot Policies', icon: <Brain className="w-4 h-4" />, content: <PolicyBrowserPanel /> },
        { id: 'image3d', label: 'Image to 3D', icon: <Camera className="w-4 h-4" />, content: <ImageTo3DPanel /> },
      ],
    },
    data: {
      label: 'Data',
      items: [
        { id: 'training', label: 'Training Dashboard', icon: <BarChart3 className="w-4 h-4" />, content: <TrainingDashboard /> },
        { id: 'recorder', label: 'Manual Recording', icon: <Database className="w-4 h-4" />, content: <DatasetRecorderPanel /> },
        { id: 'browser', label: 'Browse Datasets', icon: <Search className="w-4 h-4" />, content: <DatasetBrowserPanel /> },
        { id: 'player', label: 'Play Dataset', icon: <Play className="w-4 h-4" />, content: <DatasetPlayerPanel /> },
        { id: 'save', label: 'Save / Load', icon: <HardDrive className="w-4 h-4" />, content: <SaveLoadPanel /> },
      ],
    },
  };

  return (
    <>
      {/* Drawer - slides in from right without darkening backdrop */}
      <div
        className={`fixed right-0 top-0 h-full w-80 bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Tools</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-slate-800">
          {(Object.keys(sections) as DrawerSection[]).map((key) => (
            <button
              key={key}
              onClick={() => {
                setActiveSection(key);
                setExpandedItem(null);
              }}
              className={`flex-1 py-2 text-xs font-medium transition ${
                activeSection === key
                  ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-900/20'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {sections[key].label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {sections[activeSection].items.map((item) => (
            <div key={item.id} className="border-b border-slate-800/50">
              <button
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-800/50 transition text-left"
              >
                <span className="text-slate-400">{item.icon}</span>
                <span className="text-sm text-slate-200 flex-1">{item.label}</span>
                <span className={`text-slate-500 transition-transform ${expandedItem === item.id ? 'rotate-90' : ''}`}>
                  ›
                </span>
              </button>
              {expandedItem === item.id && (
                <div className="px-3 pb-3 bg-slate-800/30">
                  {item.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
