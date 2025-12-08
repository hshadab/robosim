import React, { useState, useCallback } from 'react';
import { SimulationViewport } from '../simulation';
import { ChatPanel } from '../chat';
import { JointControls, ShareButton, ConsolidatedToolsPanel } from '../controls';
import { CodeEditor, ArduinoEmulatorPanel } from '../editor';
import { ApiKeySettings } from '../settings/ApiKeySettings';
import { FirstRunModal, useFirstRun } from '../onboarding/FirstRunModal';
import { Bot, Code, Gamepad2, BookOpen, LogOut, Play, Square, Save, Settings, PanelRightOpen, PanelRightClose, Brain, Database, Mic, Eye, Box, Sparkles, FileText, Clock, CheckCircle, AlertCircle, Menu, X, MessageSquare, Wrench } from 'lucide-react';
import { Button, Select } from '../common';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAppStore } from '../../stores/useAppStore';
import { ROBOT_PROFILES } from '../../config/robots';
import { useIsMobile, useIsTablet } from '../../hooks/useMediaQuery';
import { MobileDrawer, MobileNav, type MobileTab } from '../mobile';

type Tab = 'simulate' | 'code' | 'learn' | 'docs';

export const MainLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('simulate');
  const [showSettings, setShowSettings] = useState(false);
  const [triggerTutorial, setTriggerTutorial] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, logout } = useAuthStore();
  const {
    selectedRobotId,
    setSelectedRobot,
    setActiveRobotType,
    simulation,
    setSimulationStatus,
    isAnimating,
  } = useAppStore();
  const { showModal, markComplete } = useFirstRun();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  const handleStartTutorial = useCallback(() => {
    markComplete();
    setActiveTab('simulate');
    // Trigger tutorial opening in SimulateTab
    setTriggerTutorial(true);
    setTimeout(() => setTriggerTutorial(false), 100);
  }, [markComplete]);

  const handleSkipOnboarding = useCallback(() => {
    markComplete();
  }, [markComplete]);

  const tabs = [
    { id: 'simulate' as const, label: 'Simulate', icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'code' as const, label: 'Code', icon: <Code className="w-4 h-4" /> },
    { id: 'learn' as const, label: 'Learn', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'docs' as const, label: 'Docs', icon: <FileText className="w-4 h-4" /> },
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
      {/* Unified Header - Responsive */}
      <header className="h-12 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-2 md:px-4">
        {/* Left: Logo + Tabs (tabs hidden on mobile) */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile menu button */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-1 rounded-lg hover:bg-slate-700/50 transition"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-300" />
              ) : (
                <Menu className="w-5 h-5 text-slate-300" />
              )}
            </button>
          )}

          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
            <span className="text-base md:text-lg font-bold text-white">RoboSim</span>
          </div>

          {/* Tabs - hidden on mobile */}
          {!isMobile && (
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
                  {!isTablet && tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: Robot Selector + Run/Stop (only for simulate/code tabs) - hidden on mobile */}
        {!isMobile && (activeTab === 'simulate' || activeTab === 'code') && (
          <div className="flex items-center gap-2 md:gap-3">
            <Select
              options={robotOptions}
              value={selectedRobotId}
              onChange={handleRobotChange}
              className="w-32 md:w-48"
            />
            {simulation.status === 'running' ? (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Square className="w-3.5 h-3.5" />}
                onClick={handleStop}
                disabled={isAnimating}
              >
                {!isTablet && 'Stop'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Play className="w-3.5 h-3.5" />}
                onClick={handleRun}
                disabled={isAnimating}
              >
                {!isTablet && 'Run'}
              </Button>
            )}
          </div>
        )}

        {/* Right: Actions + User - simplified on mobile */}
        <div className="flex items-center gap-1 md:gap-3">
          {!isMobile && (activeTab === 'simulate' || activeTab === 'code') && (
            <>
              <ShareButton />
              {!isTablet && (
                <Button variant="ghost" size="sm" leftIcon={<Save className="w-4 h-4" />}>
                  Save
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4" />
              </Button>
              <div className="w-px h-6 bg-slate-700" />
            </>
          )}
          {isMobile ? (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg hover:bg-slate-700/50 transition"
            >
              <Settings className="w-5 h-5 text-slate-400" />
            </button>
          ) : (
            <>
              <span className="text-sm text-slate-400 hidden md:inline">
                {profile?.full_name || user?.email}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 transition text-sm px-2 py-1 hover:bg-red-500/10 rounded"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobile && mobileMenuOpen && (
        <div className="absolute top-12 left-0 right-0 z-50 bg-slate-800 border-b border-slate-700 shadow-lg">
          <div className="p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                {tab.icon}
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
            <div className="border-t border-slate-700 my-2" />
            <div className="px-4 py-2 text-sm text-slate-400">
              {profile?.full_name || user?.email}
            </div>
            <button
              onClick={() => {
                logout();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'simulate' && <SimulateTab openTutorial={triggerTutorial} />}
        {activeTab === 'code' && <CodeTab />}
        {activeTab === 'learn' && <LearnTab />}
        {activeTab === 'docs' && <DocsTab />}
      </div>

      {/* Settings Modal */}
      <ApiKeySettings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* First Run Onboarding Modal */}
      {showModal && (
        <FirstRunModal
          onStartTutorial={handleStartTutorial}
          onSkip={handleSkipOnboarding}
        />
      )}
    </div>
  );
};

interface SimulateTabProps {
  openTutorial?: boolean;
}

const SimulateTab: React.FC<SimulateTabProps> = ({ openTutorial }) => {
  const { setControlMode, setShowWorkspace } = useAppStore();
  const [showToolsPanel, setShowToolsPanel] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>('viewport');
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // When openTutorial triggers, we could emit an event or set a global state
  // For now, the TutorialPanel in ConsolidatedToolsPanel will handle its own visibility
  React.useEffect(() => {
    if (openTutorial) {
      // Ensure tools panel is visible when tutorial is triggered
      setShowToolsPanel(true);
      if (isMobile) {
        setShowToolsDrawer(true);
        setMobileTab('tools');
      }
    }
  }, [openTutorial, isMobile]);

  // Handle mobile tab changes
  const handleMobileTabChange = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === 'chat') {
      setShowChatDrawer(true);
      setShowToolsDrawer(false);
    } else if (tab === 'tools') {
      setShowToolsDrawer(true);
      setShowChatDrawer(false);
    } else if (tab === 'camera') {
      // Open Image-to-3D panel directly
      setShowToolsDrawer(true);
      setShowChatDrawer(false);
    } else {
      setShowChatDrawer(false);
      setShowToolsDrawer(false);
    }
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex-1 flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
        {/* 3D Viewport - Full width */}
        <div className="flex-1 min-h-0">
          <SimulationViewport />
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileNav
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
          showCamera={true}
        />

        {/* Chat Drawer */}
        <MobileDrawer
          isOpen={showChatDrawer}
          onClose={() => {
            setShowChatDrawer(false);
            setMobileTab('viewport');
          }}
          title="AI Chat"
          defaultSnap="half"
        >
          <ChatPanel />
        </MobileDrawer>

        {/* Tools Drawer */}
        <MobileDrawer
          isOpen={showToolsDrawer}
          onClose={() => {
            setShowToolsDrawer(false);
            setMobileTab('viewport');
          }}
          title={mobileTab === 'camera' ? 'Image to 3D' : 'Tools'}
          defaultSnap="half"
        >
          <ConsolidatedToolsPanel
            onModeChange={setControlMode}
            onShowWorkspace={setShowWorkspace}
          />
        </MobileDrawer>

        {/* Safe area padding for bottom nav */}
        <div className="h-14" />
      </div>
    );
  }

  // Tablet Layout - Single collapsible sidebar
  if (isTablet) {
    return (
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>
        <div className="h-full flex">
          {/* Center: 3D Simulation */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 min-h-0">
              <SimulationViewport />
            </div>
          </div>

          {/* Right: Toggle between Chat and Tools */}
          <div className={`flex-shrink-0 border-l border-slate-700/50 transition-all duration-300 ${showToolsPanel ? 'w-72' : 'w-12'}`}>
            {showToolsPanel ? (
              <div className="h-full flex flex-col">
                {/* Toggle Header */}
                <div className="flex items-center justify-between px-2 py-2 border-b border-slate-700/50 bg-slate-800/50">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setMobileTab('chat')}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                        mobileTab === 'chat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setMobileTab('tools')}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                        mobileTab === 'tools' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      <Wrench className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setShowToolsPanel(false)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition"
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  {mobileTab === 'chat' ? (
                    <ChatPanel />
                  ) : (
                    <ConsolidatedToolsPanel
                      onModeChange={setControlMode}
                      onShowWorkspace={setShowWorkspace}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center pt-2">
                <button
                  onClick={() => setShowToolsPanel(true)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition"
                >
                  <PanelRightOpen className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop Layout - Full 3-panel
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

        {/* Right: Consolidated Tools Panel */}
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

              {/* Consolidated Tools with Categorized Tabs */}
              <div className="flex-1 overflow-hidden">
                <ConsolidatedToolsPanel
                  onModeChange={setControlMode}
                  onShowWorkspace={setShowWorkspace}
                />
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

const DocsTab: React.FC = () => {
  const robots = [
    {
      id: 'so101',
      name: 'SO-101 Robot Arm',
      manufacturer: 'The Robot Company',
      status: 'available',
      description: '6-DOF articulated robot arm with gripper. Perfect for pick and place, assembly, and learning robotics.',
      specs: [
        { label: 'Degrees of Freedom', value: '6 (+ gripper)' },
        { label: 'Reach', value: '~300mm' },
        { label: 'Payload', value: '~100g' },
        { label: 'Control', value: 'Position, Velocity' },
        { label: 'Interface', value: 'Serial, LeRobot' },
      ],
      features: [
        'Inverse Kinematics (click-to-move)',
        'Keyboard & Gamepad teleoperation',
        'Hand tracking control',
        'AI Chat programming',
        'LeRobot policy loading',
        'Hardware export (Arduino, Python)',
      ],
    },
    {
      id: 'wheeled',
      name: 'Wheeled Robot',
      manufacturer: 'Generic',
      status: 'coming_soon',
      description: 'Differential drive mobile robot with sensors. Great for navigation, line following, and obstacle avoidance.',
      specs: [
        { label: 'Drive Type', value: 'Differential (2WD)' },
        { label: 'Sensors', value: 'Ultrasonic, IR' },
        { label: 'Speed', value: 'Variable' },
        { label: 'Control', value: 'Velocity' },
      ],
      features: [
        'Line following',
        'Obstacle avoidance',
        'Waypoint navigation',
        'Sensor simulation',
      ],
    },
    {
      id: 'drone',
      name: 'Quadcopter Drone',
      manufacturer: 'Generic',
      status: 'coming_soon',
      description: 'Simulated quadcopter for learning drone programming and autonomous flight.',
      specs: [
        { label: 'Type', value: 'Quadcopter' },
        { label: 'Control', value: 'Attitude, Position' },
        { label: 'Sensors', value: 'IMU, Altimeter' },
        { label: 'Modes', value: 'Manual, Auto' },
      ],
      features: [
        'Takeoff/Landing',
        'Waypoint missions',
        'Altitude hold',
        'Position control',
      ],
    },
    {
      id: 'humanoid',
      name: 'Humanoid Robot',
      manufacturer: 'Generic',
      status: 'coming_soon',
      description: 'Bipedal humanoid robot for advanced robotics research and education.',
      specs: [
        { label: 'Degrees of Freedom', value: '22+' },
        { label: 'Height', value: '~50cm' },
        { label: 'Control', value: 'Joint, Walking' },
        { label: 'Balance', value: 'Simulated' },
      ],
      features: [
        'Walking gaits',
        'Gesture control',
        'Balance control',
        'Full body IK',
      ],
    },
  ];

  const aiFeatures = [
    {
      name: 'AI Chat Control',
      description: 'Natural language robot control with Claude AI',
      status: 'available',
      icon: <Brain className="w-5 h-5" />,
    },
    {
      name: 'Voice Control',
      description: 'Hands-free control with Web Speech API',
      status: 'available',
      icon: <Mic className="w-5 h-5" />,
    },
    {
      name: 'Vision-Language AI',
      description: 'Scene understanding and object detection',
      status: 'available',
      icon: <Eye className="w-5 h-5" />,
    },
    {
      name: 'Code Copilot',
      description: 'AI-powered code completion and generation',
      status: 'available',
      icon: <Code className="w-5 h-5" />,
    },
    {
      name: 'Text to 3D',
      description: 'Generate 3D objects from text descriptions',
      status: 'available',
      icon: <Box className="w-5 h-5" />,
    },
    {
      name: 'AI Environment',
      description: 'Generate backgrounds and textures with Gemini',
      status: 'available',
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      name: 'LeRobot Policies',
      description: 'Load trained policies from HuggingFace Hub',
      status: 'available',
      icon: <Database className="w-5 h-5" />,
    },
  ];

  return (
    <div className="flex-1 p-8 overflow-auto" style={{ height: 'calc(100vh - 48px)' }}>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-3">Documentation</h1>
        <p className="text-lg text-slate-400 mb-10">
          Complete reference for all robots, features, and APIs in RoboSim
        </p>

        {/* Robots Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Bot className="w-6 h-6 text-blue-400" />
            Supported Robots
          </h2>

          <div className="grid gap-6">
            {robots.map((robot) => (
              <div
                key={robot.id}
                className={`bg-slate-800/50 rounded-xl border transition ${
                  robot.status === 'available'
                    ? 'border-green-500/30 hover:border-green-500/50'
                    : 'border-slate-700/50 opacity-75'
                }`}
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-700/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{robot.name}</h3>
                        {robot.status === 'available' ? (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                            <CheckCircle className="w-3 h-3" />
                            Available
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{robot.manufacturer}</p>
                    </div>
                  </div>
                  <p className="text-slate-400 mt-3">{robot.description}</p>
                </div>

                {/* Specs & Features */}
                <div className="p-6 grid md:grid-cols-2 gap-6">
                  {/* Specifications */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-3">
                      Specifications
                    </h4>
                    <div className="space-y-2">
                      {robot.specs.map((spec, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-500">{spec.label}</span>
                          <span className="text-white font-medium">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Features */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-3">
                      Features
                    </h4>
                    <ul className="space-y-1">
                      {robot.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                          <CheckCircle className={`w-3 h-3 ${robot.status === 'available' ? 'text-green-400' : 'text-slate-600'}`} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Coming Soon Notice */}
                {robot.status === 'coming_soon' && (
                  <div className="px-6 pb-6">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <p className="text-sm text-amber-300">
                        This robot is currently in development. Basic simulation is available, but full feature support is coming soon.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* AI Features Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-400" />
            AI Features
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiFeatures.map((feature) => (
              <div
                key={feature.name}
                className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-purple-500/30 transition"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-500/20 text-purple-400 rounded-lg">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{feature.name}</h3>
                    <span className="text-xs text-green-400">Available</span>
                  </div>
                </div>
                <p className="text-sm text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Links */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <FileText className="w-6 h-6 text-cyan-400" />
            Resources
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <a
              href="https://github.com/hshadab/robotics-simulation"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-cyan-500/30 transition block"
            >
              <h3 className="text-white font-medium mb-2">GitHub Repository</h3>
              <p className="text-sm text-slate-400">Source code, issues, and contributions</p>
            </a>
            <a
              href="https://huggingface.co/lerobot"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-cyan-500/30 transition block"
            >
              <h3 className="text-white font-medium mb-2">LeRobot Framework</h3>
              <p className="text-sm text-slate-400">HuggingFace robot learning toolkit</p>
            </a>
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
              <h3 className="text-white font-medium mb-2">API Reference</h3>
              <p className="text-sm text-slate-400">Coming soon - Robot API documentation</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
