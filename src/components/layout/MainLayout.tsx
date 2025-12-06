import React, { useState } from 'react';
import { SimulationViewport, SensorPanel } from '../simulation';
import { ChatPanel } from '../chat';
import { JointControls, PresetButtons, EnvironmentSelector, ChallengePanel, DatasetRecorderPanel, DatasetPlayerPanel, HandTrackingPanel, ShareButton, AdvancedControlsPanel, TaskTemplatesPanel, JointTrajectoryGraph, SerialConnectionPanel, PolicyBrowserPanel, SensorRealismPanel, VisionPanel, SaveLoadPanel } from '../controls';
import { CodeEditor, ArduinoEmulatorPanel } from '../editor';
import { ApiKeySettings } from '../settings/ApiKeySettings';
import { Bot, Code, Gamepad2, BookOpen, LogOut, Play, Square, Save, Settings, PanelRightOpen, PanelRightClose, ChevronDown, ChevronRight, Sliders, Brain, Database, Cpu, Activity, Hand, BarChart3, ListChecks, Wifi, Radio, Camera, HardDrive } from 'lucide-react';
import { Button, Select } from '../common';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAppStore } from '../../stores/useAppStore';
import { ROBOT_PROFILES } from '../../config/robots';

// Collapsible panel component for secondary controls
interface CollapsiblePanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({ title, icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-800/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/30 transition"
      >
        <span className="text-slate-400">{icon}</span>
        <span className="text-sm font-medium text-slate-300 flex-1">{title}</span>
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

type Tab = 'simulate' | 'code' | 'learn';

export const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('simulate');
  const [showSettings, setShowSettings] = useState(false);
  const { user, logout } = useAuthStore();
  const {
    selectedRobotId,
    setSelectedRobot,
    setActiveRobotType,
    simulation,
    setSimulationStatus,
    isAnimating,
  } = useAppStore();

  const tabs = [
    { id: 'simulate' as const, label: 'Simulate', icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'code' as const, label: 'Code', icon: <Code className="w-4 h-4" /> },
    { id: 'learn' as const, label: 'Learn', icon: <BookOpen className="w-4 h-4" /> },
  ];

  const robotOptions = ROBOT_PROFILES.map((robot) => ({
    value: robot.id,
    label: `${robot.manufacturer} ${robot.name}`,
    description: robot.description,
  }));

  const handleRobotChange = (robotId: string) => {
    setSelectedRobot(robotId);
    const profile = ROBOT_PROFILES.find((r) => r.id === robotId);
    if (profile) {
      setActiveRobotType(profile.type as 'arm' | 'wheeled' | 'drone');
    }
  };

  const handleRun = () => setSimulationStatus('running');
  const handleStop = () => setSimulationStatus('idle');

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col text-base">
      {/* Unified Header */}
      <header className="h-12 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-4">
        {/* Left: Logo + Tabs */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-blue-400" />
            <span className="text-lg font-bold text-white">RoboSim</span>
          </div>

          <div className="flex items-center gap-0.5 bg-slate-900/50 rounded-md p-0.5 ml-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Robot Selector + Run/Stop (only for simulate/code tabs) */}
        {(activeTab === 'simulate' || activeTab === 'code') && (
          <div className="flex items-center gap-3">
            <Select
              options={robotOptions}
              value={selectedRobotId}
              onChange={handleRobotChange}
              className="w-48"
            />
            {simulation.status === 'running' ? (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Square className="w-3.5 h-3.5" />}
                onClick={handleStop}
                disabled={isAnimating}
              >
                Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Play className="w-3.5 h-3.5" />}
                onClick={handleRun}
                disabled={isAnimating}
              >
                Run
              </Button>
            )}
          </div>
        )}

        {/* Right: Actions + User */}
        <div className="flex items-center gap-3">
          {(activeTab === 'simulate' || activeTab === 'code') && (
            <>
              <ShareButton />
              <Button variant="ghost" size="sm" leftIcon={<Save className="w-4 h-4" />}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4" />
              </Button>
              <div className="w-px h-6 bg-slate-700" />
            </>
          )}
          <span className="text-sm text-slate-400">
            {user?.name || user?.email}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 transition text-sm px-2 py-1 hover:bg-red-500/10 rounded"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'simulate' && <SimulateTab />}
        {activeTab === 'code' && <CodeTab />}
        {activeTab === 'learn' && <LearnTab />}
      </div>

      {/* Settings Modal */}
      <ApiKeySettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

const SimulateTab: React.FC = () => {
  const { setControlMode, setShowWorkspace } = useAppStore();
  const [showToolsPanel, setShowToolsPanel] = useState(false);

  return (
    <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="h-full flex">
        {/* Left: AI Chat */}
        <div className="w-80 flex-shrink-0 border-r border-slate-700/50 flex flex-col">
          <ChatPanel />
        </div>

        {/* Center: 3D Simulation (takes remaining space) */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <SimulationViewport />
          </div>
        </div>

        {/* Right: Collapsible Tools Panel */}
        <div className={`flex-shrink-0 border-l border-slate-700/50 transition-all duration-300 ${showToolsPanel ? 'w-80' : 'w-12'}`}>
          {showToolsPanel ? (
            <div className="h-full flex flex-col">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-slate-800/50">
                <span className="text-sm font-medium text-slate-300">Tools</span>
                <button
                  onClick={() => setShowToolsPanel(false)}
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition"
                  title="Collapse panel"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Tools */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {/* Joint Controls - Often used, default open */}
                <CollapsiblePanel title="Joint Controls" icon={<Sliders className="w-4 h-4" />} defaultOpen={true}>
                  <JointControls />
                </CollapsiblePanel>

                {/* Quick Presets */}
                <CollapsiblePanel title="Presets" icon={<ListChecks className="w-4 h-4" />}>
                  <PresetButtons />
                </CollapsiblePanel>

                {/* Environment */}
                <CollapsiblePanel title="Environment" icon={<Gamepad2 className="w-4 h-4" />}>
                  <EnvironmentSelector />
                </CollapsiblePanel>

                {/* Sensors */}
                <CollapsiblePanel title="Sensors" icon={<Activity className="w-4 h-4" />}>
                  <SensorPanel />
                </CollapsiblePanel>

                {/* Sensor Realism (Noise Models) */}
                <CollapsiblePanel title="Sensor Realism" icon={<Radio className="w-4 h-4" />}>
                  <SensorRealismPanel />
                </CollapsiblePanel>

                {/* Robot Vision (Camera/Blob Detection) */}
                <CollapsiblePanel title="Robot Vision" icon={<Camera className="w-4 h-4" />}>
                  <VisionPanel />
                </CollapsiblePanel>

                {/* Trajectory Graph */}
                <CollapsiblePanel title="Trajectory" icon={<BarChart3 className="w-4 h-4" />}>
                  <JointTrajectoryGraph height={120} />
                </CollapsiblePanel>

                {/* AI Policies */}
                <CollapsiblePanel title="LeRobot Policies" icon={<Brain className="w-4 h-4" />}>
                  <PolicyBrowserPanel />
                </CollapsiblePanel>

                {/* Advanced Controls */}
                <CollapsiblePanel title="Advanced Controls" icon={<Settings className="w-4 h-4" />}>
                  <AdvancedControlsPanel
                    onModeChange={setControlMode}
                    onShowWorkspace={setShowWorkspace}
                  />
                </CollapsiblePanel>

                {/* Task Templates */}
                <CollapsiblePanel title="Task Templates" icon={<ListChecks className="w-4 h-4" />}>
                  <TaskTemplatesPanel />
                </CollapsiblePanel>

                {/* Save/Load State */}
                <CollapsiblePanel title="Save / Load" icon={<HardDrive className="w-4 h-4" />}>
                  <SaveLoadPanel />
                </CollapsiblePanel>

                {/* Hardware Connection */}
                <CollapsiblePanel title="Serial Connection" icon={<Wifi className="w-4 h-4" />}>
                  <SerialConnectionPanel />
                </CollapsiblePanel>

                {/* Hand Tracking */}
                <CollapsiblePanel title="Hand Tracking" icon={<Hand className="w-4 h-4" />}>
                  <HandTrackingPanel />
                </CollapsiblePanel>

                {/* Dataset Recording */}
                <CollapsiblePanel title="Dataset Recorder" icon={<Database className="w-4 h-4" />}>
                  <DatasetRecorderPanel />
                </CollapsiblePanel>

                {/* Dataset Player */}
                <CollapsiblePanel title="Dataset Player" icon={<Play className="w-4 h-4" />}>
                  <DatasetPlayerPanel />
                </CollapsiblePanel>

                {/* Challenges */}
                <CollapsiblePanel title="Challenges" icon={<Cpu className="w-4 h-4" />}>
                  <ChallengePanel />
                </CollapsiblePanel>
              </div>
            </div>
          ) : (
            /* Collapsed state - just show expand button */
            <div className="h-full flex flex-col items-center pt-2">
              <button
                onClick={() => setShowToolsPanel(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition"
                title="Expand tools panel"
              >
                <PanelRightOpen className="w-5 h-5" />
              </button>
              {/* Vertical text hint */}
              <div className="mt-4 writing-mode-vertical text-xs text-slate-600 tracking-widest" style={{ writingMode: 'vertical-rl' }}>
                TOOLS
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CodeTab: React.FC = () => {
  return (
    <div className="flex-1 p-4 overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="h-full grid grid-cols-12 gap-4">
        {/* Code Editor - takes most space */}
        <div className="col-span-6 h-full">
          <CodeEditor />
        </div>

        {/* Middle: Arduino Emulator */}
        <div className="col-span-3 h-full">
          <ArduinoEmulatorPanel />
        </div>

        {/* Right: Small simulation preview + controls */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="flex-1 min-h-0">
            <SimulationViewport />
          </div>
          <div className="h-40 overflow-y-auto">
            <JointControls />
          </div>
        </div>
      </div>
    </div>
  );
};

const LearnTab: React.FC = () => {
  const tutorials = [
    {
      title: 'Getting Started',
      description: 'Learn the basics of robotic arm control',
      difficulty: 'Beginner',
      duration: '10 min',
    },
    {
      title: 'Pick and Place',
      description: 'Program your robot to pick up and move objects',
      difficulty: 'Beginner',
      duration: '15 min',
    },
    {
      title: 'Sensor Basics',
      description: 'Using ultrasonic and IR sensors for navigation',
      difficulty: 'Intermediate',
      duration: '20 min',
    },
    {
      title: 'Line Following',
      description: 'Build a line-following robot program',
      difficulty: 'Intermediate',
      duration: '25 min',
    },
    {
      title: 'Drone Flight',
      description: 'Master quadcopter control and waypoints',
      difficulty: 'Advanced',
      duration: '30 min',
    },
    {
      title: 'Export to Hardware',
      description: 'Deploy your code to real Arduino/ESP32',
      difficulty: 'Advanced',
      duration: '20 min',
    },
  ];

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Beginner': return 'text-green-400 bg-green-400/20';
      case 'Intermediate': return 'text-yellow-400 bg-yellow-400/20';
      case 'Advanced': return 'text-red-400 bg-red-400/20';
      default: return 'text-slate-400 bg-slate-400/20';
    }
  };

  return (
    <div className="flex-1 p-8 overflow-auto" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-3">Learn Robotics</h1>
        <p className="text-lg text-slate-400 mb-10">
          Step-by-step tutorials to master robotics programming
        </p>

        <div className="grid gap-4">
          {tutorials.map((tutorial, i) => (
            <div
              key={i}
              className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-blue-500/30 transition cursor-pointer flex items-center justify-between"
            >
              <div>
                <h3 className="text-lg text-white font-medium mb-1">{tutorial.title}</h3>
                <p className="text-base text-slate-400">{tutorial.description}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-base text-slate-500">{tutorial.duration}</span>
                <span className={`text-sm px-3 py-1 rounded-full ${getDifficultyColor(tutorial.difficulty)}`}>
                  {tutorial.difficulty}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-slate-600 text-base mt-10 text-center">
          More tutorials coming soon
        </p>
      </div>
    </div>
  );
};
