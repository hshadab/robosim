import React, { useState } from 'react';
import { SimulationViewport, SensorPanel } from '../simulation';
import { ChatPanel } from '../chat';
import { JointControls, PresetButtons, EnvironmentSelector, ChallengePanel, DatasetRecorderPanel, DatasetPlayerPanel, HandTrackingPanel, ShareButton, AdvancedControlsPanel, TaskTemplatesPanel, JointTrajectoryGraph, SerialConnectionPanel, PolicyBrowserPanel } from '../controls';
import { CodeEditor, ArduinoEmulatorPanel } from '../editor';
import { ApiKeySettings } from '../settings/ApiKeySettings';
import { Bot, Code, Gamepad2, BookOpen, LogOut, Play, Square, Save, Settings } from 'lucide-react';
import { Button, Select } from '../common';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAppStore } from '../../stores/useAppStore';
import { ROBOT_PROFILES } from '../../config/robots';

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
            className="flex items-center gap-1 text-slate-400 hover:text-white transition text-sm"
          >
            <LogOut className="w-4 h-4" />
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

  return (
    <div className="flex-1 p-4 overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="h-full grid grid-cols-12 gap-4">
        {/* Left Column: AI Assistant */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="flex-1 min-h-0">
            <ChatPanel />
          </div>
        </div>

        {/* Middle Column: 3D Simulation */}
        <div className="col-span-6 flex flex-col gap-4">
          <div className="flex-1 min-h-0">
            <SimulationViewport />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EnvironmentSelector />
            <SensorPanel />
          </div>
          <JointTrajectoryGraph height={150} />
        </div>

        {/* Right Column: Controls */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto">
          <JointControls />
          <PresetButtons />
          <AdvancedControlsPanel
            onModeChange={setControlMode}
            onShowWorkspace={setShowWorkspace}
          />
          <TaskTemplatesPanel />
          <PolicyBrowserPanel />
          <SerialConnectionPanel />
          <HandTrackingPanel />
          <DatasetRecorderPanel />
          <DatasetPlayerPanel />
          <div className="min-h-0 max-h-56 overflow-hidden">
            <ChallengePanel />
          </div>
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
