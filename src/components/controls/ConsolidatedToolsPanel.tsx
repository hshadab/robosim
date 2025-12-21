/**
 * Consolidated Tools Panel
 *
 * Organizes all control panels into categorized tabs to reduce UI clutter.
 * Categories: Control, AI, Data, Hardware, Settings
 */

import React, { useState } from 'react';
import {
  Sliders,
  Brain,
  Database,
  Wifi,
  Settings,
  Gamepad2,
  ListChecks,
  Activity,
  Camera,
  BarChart3,
  HardDrive,
  Hand,
  Play,
  Search,
  ChevronDown,
  ChevronRight,
  Box,
} from 'lucide-react';

// Import panel components (simplified set)
import { JointControls } from './JointControls';
import { PresetButtons } from './PresetButtons';
import { EnvironmentSelector } from './EnvironmentSelector';
import { JointTrajectoryGraph } from './JointTrajectoryGraph';
import { PolicyBrowserPanel } from './PolicyBrowserPanel';
import { VoiceControlPanel } from './VoiceControlPanel';
import { VisionAnalysisPanel } from './VisionAnalysisPanel';
import { DatasetRecorderPanel } from './DatasetRecorder';
import { DatasetPlayerPanel } from './DatasetPlayer';
import { DatasetBrowserPanel } from './DatasetBrowserPanel';
import { SerialConnectionPanel } from './SerialConnectionPanel';
import { HandTrackingPanel } from './HandTrackingPanel';
import { VisionPanel } from './VisionPanel';
import { SaveLoadPanel } from './SaveLoadPanel';
import { ImageTo3DPanel } from './ImageTo3DPanel';
import { ObjectLibraryPanel } from './ObjectLibraryPanel';
import { QuickTrainPanel } from './QuickTrainPanel';
import { SensorPanel } from '../simulation/SensorPanel';

// Tool category tabs
type ToolCategory = 'control' | 'ai' | 'data' | 'hardware' | 'settings';

interface CategoryTab {
  id: ToolCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const CATEGORIES: CategoryTab[] = [
  { id: 'control', label: 'Control', icon: <Sliders className="w-4 h-4" />, description: 'Robot control and movement' },
  { id: 'ai', label: 'AI', icon: <Brain className="w-4 h-4" />, description: 'AI features and policies' },
  { id: 'data', label: 'Data', icon: <Database className="w-4 h-4" />, description: 'Recording and datasets' },
  { id: 'hardware', label: 'Hardware', icon: <Wifi className="w-4 h-4" />, description: 'Hardware connections' },
  { id: 'settings', label: 'More', icon: <Settings className="w-4 h-4" />, description: 'Additional settings' },
];

// Collapsible section within a category
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-800/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/30 transition"
      >
        <span className="text-slate-400">{icon}</span>
        <span className="text-sm font-medium text-slate-300 flex-1">{title}</span>
        {badge && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {badge}
          </span>
        )}
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-slate-700/50">
          {children}
        </div>
      )}
    </div>
  );
};

type ControlMode = 'manual' | 'click-to-move' | 'keyboard' | 'gamepad';

interface ConsolidatedToolsPanelProps {
  onModeChange?: (mode: ControlMode) => void;
  onShowWorkspace?: (show: boolean) => void;
}

export const ConsolidatedToolsPanel: React.FC<ConsolidatedToolsPanelProps> = () => {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('control');

  return (
    <div className="h-full flex flex-col bg-slate-900/50">
      {/* Category Tabs */}
      <div className="flex border-b border-slate-700/50 bg-slate-800/50">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 transition text-xs ${
              activeCategory === cat.id
                ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
            title={cat.description}
          >
            {cat.icon}
            <span className="font-medium">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Category Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {activeCategory === 'control' && (
          <>
            {/* Joint Controls - Primary, always visible */}
            <CollapsibleSection
              title="Joint Controls"
              icon={<Sliders className="w-4 h-4" />}
              defaultOpen={true}
            >
              <JointControls />
            </CollapsibleSection>

            {/* Presets - Quick access */}
            <CollapsibleSection title="Presets" icon={<ListChecks className="w-4 h-4" />} defaultOpen={true}>
              <PresetButtons />
            </CollapsibleSection>

            {/* Object Library - Top level for easy access */}
            <CollapsibleSection title="Object Library" icon={<Box className="w-4 h-4" />} defaultOpen={true}>
              <ObjectLibraryPanel />
            </CollapsibleSection>

            {/* Advanced - Everything else hidden */}
            <CollapsibleSection title="More Options" icon={<Settings className="w-4 h-4" />} defaultOpen={false}>
              <div className="p-2 space-y-2">
                <CollapsibleSection title="Environment" icon={<Gamepad2 className="w-4 h-4" />}>
                  <EnvironmentSelector />
                </CollapsibleSection>
                <CollapsibleSection title="Trajectory" icon={<BarChart3 className="w-4 h-4" />}>
                  <JointTrajectoryGraph height={120} />
                </CollapsibleSection>
              </div>
            </CollapsibleSection>
          </>
        )}

        {activeCategory === 'ai' && (
          <>
            {/* Voice Control - Primary */}
            <VoiceControlPanel />

            {/* Image to 3D - For Quick Train */}
            <CollapsibleSection title="Image to 3D" icon={<Camera className="w-4 h-4" />} defaultOpen={true}>
              <ImageTo3DPanel />
            </CollapsibleSection>

            {/* More AI Tools */}
            <CollapsibleSection title="More AI Tools" icon={<Settings className="w-4 h-4" />} defaultOpen={false}>
              <div className="p-2 space-y-2">
                <CollapsibleSection title="LeRobot Policies" icon={<Brain className="w-4 h-4" />}>
                  <PolicyBrowserPanel />
                </CollapsibleSection>
                <CollapsibleSection title="Vision Analysis" icon={<Camera className="w-4 h-4" />}>
                  <VisionAnalysisPanel />
                </CollapsibleSection>
              </div>
            </CollapsibleSection>
          </>
        )}

        {activeCategory === 'data' && (
          <>
            {/* Quick Train - THE main experience */}
            <QuickTrainPanel />

            {/* Advanced Tools - Hidden by default */}
            <CollapsibleSection
              title="Advanced Tools"
              icon={<Settings className="w-4 h-4" />}
              defaultOpen={false}
            >
              <div className="p-2 space-y-2">
                <CollapsibleSection
                  title="Manual Recording"
                  icon={<Database className="w-4 h-4" />}
                  defaultOpen={false}
                >
                  <DatasetRecorderPanel />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Browse Hub"
                  icon={<Search className="w-4 h-4" />}
                  defaultOpen={false}
                >
                  <DatasetBrowserPanel />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Play Dataset"
                  icon={<Play className="w-4 h-4" />}
                  defaultOpen={false}
                >
                  <DatasetPlayerPanel />
                </CollapsibleSection>
              </div>
            </CollapsibleSection>
          </>
        )}

        {activeCategory === 'hardware' && (
          <>
            {/* Serial Connection - Primary */}
            <CollapsibleSection
              title="Connect Real Robot"
              icon={<Wifi className="w-4 h-4" />}
              defaultOpen={true}
            >
              <SerialConnectionPanel />
            </CollapsibleSection>

            {/* Hand Tracking */}
            <CollapsibleSection title="Hand Tracking" icon={<Hand className="w-4 h-4" />} defaultOpen={false}>
              <HandTrackingPanel />
            </CollapsibleSection>
          </>
        )}

        {activeCategory === 'settings' && (
          <>
            {/* Save/Load - Most useful */}
            <CollapsibleSection title="Save / Load" icon={<HardDrive className="w-4 h-4" />} defaultOpen={true}>
              <SaveLoadPanel />
            </CollapsibleSection>

            {/* Sensors */}
            <CollapsibleSection title="Sensors" icon={<Activity className="w-4 h-4" />} defaultOpen={false}>
              <SensorPanel />
            </CollapsibleSection>

            {/* Robot Vision */}
            <CollapsibleSection title="Robot Vision" icon={<Camera className="w-4 h-4" />} defaultOpen={false}>
              <VisionPanel />
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
};
