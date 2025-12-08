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
  Radio,
  Camera,
  Sparkles,
  BarChart3,
  Crosshair,
  HardDrive,
  Users,
  Hand,
  Play,
  Cpu,
  Search,
  ChevronDown,
  ChevronRight,
  Layers,
  GraduationCap,
  Upload,
} from 'lucide-react';

// Import all panel components
import { JointControls } from './JointControls';
import { PresetButtons } from './PresetButtons';
import { EnvironmentSelector } from './EnvironmentSelector';
import { AdvancedControlsPanel } from './AdvancedControlsPanel';
import { NumericalIKPanel } from './NumericalIKPanel';
import { TaskTemplatesPanel } from './TaskTemplatesPanel';
import { ParameterizedTaskPanel } from './ParameterizedTaskPanel';
import { VisualRandomizationPanel } from './VisualRandomizationPanel';
import { DatasetAugmentationPanel } from './DatasetAugmentationPanel';
import { AutoEpisodePanel } from './AutoEpisodePanel';
import { GuidedChallengePanel } from './GuidedChallengePanel';
import { JointTrajectoryGraph } from './JointTrajectoryGraph';
import { PolicyBrowserPanel } from './PolicyBrowserPanel';
import { VoiceControlPanel } from './VoiceControlPanel';
import type { Episode } from '../../lib/datasetExporter';
import { VisionAnalysisPanel } from './VisionAnalysisPanel';
import { TextTo3DPanel } from './TextTo3DPanel';
import { AIEnvironmentPanel } from './AIEnvironmentPanel';
import { DatasetRecorderPanel } from './DatasetRecorder';
import { DatasetPlayerPanel } from './DatasetPlayer';
import { DatasetBrowserPanel } from './DatasetBrowserPanel';
import { DatasetStatsPanel } from './DatasetStatsPanel';
import { TutorialPanel } from './TutorialPanel';
import { SerialConnectionPanel } from './SerialConnectionPanel';
import { HandTrackingPanel } from './HandTrackingPanel';
import { MultiRobotPanel } from './MultiRobotPanel';
import { SensorRealismPanel } from './SensorRealismPanel';
import { VisionPanel } from './VisionPanel';
import { SaveLoadPanel } from './SaveLoadPanel';
import { ChallengePanel } from './ChallengePanel';
import { HuggingFaceUploadPanel } from './HuggingFaceUploadPanel';
import { ImageTo3DPanel } from './ImageTo3DPanel';
import { SensorPanel } from '../simulation/SensorPanel';
import { useAppStore } from '../../stores/useAppStore';

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

export const ConsolidatedToolsPanel: React.FC<ConsolidatedToolsPanelProps> = ({
  onModeChange,
  onShowWorkspace,
}) => {
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('control');
  const { activeRobotType } = useAppStore();

  // Mock episodes for stats/augmentation panel demo (empty for now, populated from recording)
  const mockEpisodes: Episode[] = [];

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
            {/* Tutorial for new users */}
            {activeRobotType === 'arm' && <TutorialPanel />}

            {/* Guided Challenges */}
            {activeRobotType === 'arm' && (
              <CollapsibleSection title="Guided Challenges" icon={<GraduationCap className="w-4 h-4" />} badge="NEW">
                <GuidedChallengePanel />
              </CollapsibleSection>
            )}

            {/* Joint Controls - Primary */}
            <CollapsibleSection
              title="Joint Controls"
              icon={<Sliders className="w-4 h-4" />}
              defaultOpen={true}
            >
              <JointControls />
            </CollapsibleSection>

            {/* Presets */}
            <CollapsibleSection title="Presets" icon={<ListChecks className="w-4 h-4" />}>
              <PresetButtons />
            </CollapsibleSection>

            {/* Environment */}
            <CollapsibleSection title="Environment" icon={<Gamepad2 className="w-4 h-4" />}>
              <EnvironmentSelector />
            </CollapsibleSection>

            {/* Task Templates */}
            <CollapsibleSection title="Task Templates" icon={<ListChecks className="w-4 h-4" />}>
              <TaskTemplatesPanel />
            </CollapsibleSection>

            {/* Parameterized Tasks */}
            <CollapsibleSection title="Parameterized Tasks" icon={<Sliders className="w-4 h-4" />} badge="NEW">
              <ParameterizedTaskPanel />
            </CollapsibleSection>

            {/* Trajectory Graph */}
            <CollapsibleSection title="Trajectory" icon={<BarChart3 className="w-4 h-4" />}>
              <JointTrajectoryGraph height={120} />
            </CollapsibleSection>

            {/* Numerical IK */}
            <CollapsibleSection title="Numerical IK" icon={<Crosshair className="w-4 h-4" />}>
              <NumericalIKPanel />
            </CollapsibleSection>

            {/* Advanced Controls */}
            <CollapsibleSection title="Advanced Controls" icon={<Settings className="w-4 h-4" />}>
              <AdvancedControlsPanel
                onModeChange={onModeChange}
                onShowWorkspace={onShowWorkspace}
              />
            </CollapsibleSection>
          </>
        )}

        {activeCategory === 'ai' && (
          <>
            {/* LeRobot Policies */}
            <CollapsibleSection
              title="LeRobot Policies"
              icon={<Brain className="w-4 h-4" />}
              badge="ONNX"
            >
              <PolicyBrowserPanel />
            </CollapsibleSection>

            {/* Voice Control */}
            <VoiceControlPanel />

            {/* Vision Analysis */}
            <VisionAnalysisPanel />

            {/* Text to 3D */}
            <TextTo3DPanel />

            {/* Image to 3D */}
            <CollapsibleSection title="Image to 3D" icon={<Camera className="w-4 h-4" />} badge="CSM" defaultOpen={true}>
              <ImageTo3DPanel />
            </CollapsibleSection>

            {/* AI Environment */}
            <CollapsibleSection title="AI Environment" icon={<Sparkles className="w-4 h-4" />}>
              <AIEnvironmentPanel />
            </CollapsibleSection>
          </>
        )}

        {activeCategory === 'data' && (
          <>
            {/* Dataset Recorder - Primary */}
            <CollapsibleSection
              title="Record Dataset"
              icon={<Database className="w-4 h-4" />}
              defaultOpen={true}
            >
              <DatasetRecorderPanel />
            </CollapsibleSection>

            {/* Dataset Stats */}
            <DatasetStatsPanel episodes={mockEpisodes} />

            {/* Dataset Augmentation */}
            <CollapsibleSection title="Augmentation" icon={<Layers className="w-4 h-4" />} badge="NEW">
              <DatasetAugmentationPanel episodes={mockEpisodes} />
            </CollapsibleSection>

            {/* Auto-Episode Generator */}
            <CollapsibleSection title="Auto-Generate" icon={<Sparkles className="w-4 h-4" />} badge="NEW">
              <AutoEpisodePanel />
            </CollapsibleSection>

            {/* Dataset Browser */}
            <CollapsibleSection
              title="Browse Datasets"
              icon={<Search className="w-4 h-4" />}
              badge="Hub"
            >
              <DatasetBrowserPanel />
            </CollapsibleSection>

            {/* Dataset Player */}
            <CollapsibleSection title="Play Dataset" icon={<Play className="w-4 h-4" />}>
              <DatasetPlayerPanel />
            </CollapsibleSection>

            {/* Challenges */}
            <CollapsibleSection title="Challenges" icon={<Cpu className="w-4 h-4" />}>
              <ChallengePanel />
            </CollapsibleSection>

            {/* HuggingFace Upload */}
            <CollapsibleSection title="Upload to Hub" icon={<Upload className="w-4 h-4" />} badge="NEW">
              <HuggingFaceUploadPanel episodes={mockEpisodes} />
            </CollapsibleSection>
          </>
        )}

        {activeCategory === 'hardware' && (
          <>
            {/* Serial Connection - Primary */}
            <CollapsibleSection
              title="Serial Connection"
              icon={<Wifi className="w-4 h-4" />}
              defaultOpen={true}
            >
              <SerialConnectionPanel />
            </CollapsibleSection>

            {/* Hand Tracking */}
            <CollapsibleSection title="Hand Tracking" icon={<Hand className="w-4 h-4" />}>
              <HandTrackingPanel />
            </CollapsibleSection>

            {/* Multi-Robot */}
            <CollapsibleSection title="Multi-Robot" icon={<Users className="w-4 h-4" />}>
              <MultiRobotPanel />
            </CollapsibleSection>
          </>
        )}

        {activeCategory === 'settings' && (
          <>
            {/* Sensors */}
            <CollapsibleSection
              title="Sensors"
              icon={<Activity className="w-4 h-4" />}
              defaultOpen={true}
            >
              <SensorPanel />
            </CollapsibleSection>

            {/* Sensor Realism */}
            <CollapsibleSection title="Sensor Realism" icon={<Radio className="w-4 h-4" />}>
              <SensorRealismPanel />
            </CollapsibleSection>

            {/* Visual Randomization */}
            <CollapsibleSection title="Visual Randomization" icon={<Sparkles className="w-4 h-4" />} badge="NEW">
              <VisualRandomizationPanel />
            </CollapsibleSection>

            {/* Robot Vision */}
            <CollapsibleSection title="Robot Vision" icon={<Camera className="w-4 h-4" />}>
              <VisionPanel />
            </CollapsibleSection>

            {/* Save/Load */}
            <CollapsibleSection title="Save / Load" icon={<HardDrive className="w-4 h-4" />}>
              <SaveLoadPanel />
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
};
