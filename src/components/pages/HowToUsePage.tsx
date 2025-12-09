import React, { useState } from 'react';
import {
  Bot, ArrowLeft, MousePointer2, Keyboard, Gamepad2, Package, LineChart,
  Usb, Play, Target, Layers, ChevronDown, ChevronRight, Zap, Hand,
  Code, Download, Settings, Brain, Cpu, CheckCircle, Mic, Eye, Box,
  Camera, Wand2, GraduationCap, Upload, Palette, Languages, Sparkles,
  MessageSquare, Image
} from 'lucide-react';

interface HowToUsePageProps {
  onBack: () => void;
  onGetStarted: () => void;
}

interface FeatureSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  benefit: string;
  steps: {
    title: string;
    description: string;
    tip?: string;
  }[];
}

export const HowToUsePage: React.FC<HowToUsePageProps> = ({ onBack, onGetStarted }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('ik');

  const features: FeatureSection[] = [
    {
      id: 'ik',
      title: 'Click-to-Move (Inverse Kinematics)',
      icon: <MousePointer2 className="w-5 h-5" />,
      color: 'green',
      benefit: 'Move the robot arm by clicking anywhere in 3D space - no math required!',
      steps: [
        {
          title: 'Enable Click-to-Move Mode',
          description: 'Go to the Control tab in the Tools panel (right side), open "Advanced Controls" and click the "Click" button (mouse icon).',
          tip: 'The button turns green when active'
        },
        {
          title: 'Hover Over the 3D View',
          description: 'Move your mouse over the 3D simulation area. You\'ll see a target marker following your cursor.',
        },
        {
          title: 'Check Reachability',
          description: 'Green marker = position is reachable. Red marker = out of arm\'s reach. The arm can only reach positions within its workspace envelope.',
          tip: 'Enable "Show Workspace" in settings to see the reachable area'
        },
        {
          title: 'Click to Move',
          description: 'Click on any green (reachable) position. The arm automatically calculates joint angles using inverse kinematics and moves smoothly to that position.',
        },
      ],
    },
    {
      id: 'keyboard',
      title: 'Keyboard Teleoperation',
      icon: <Keyboard className="w-5 h-5" />,
      color: 'purple',
      benefit: 'Control the robot arm like a video game using your keyboard for precise real-time movement.',
      steps: [
        {
          title: 'Enable Keyboard Mode',
          description: 'Go to the Control tab → Advanced Controls, click the "Keys" button (keyboard icon). The panel turns purple when active.',
        },
        {
          title: 'Focus the Application',
          description: 'Click anywhere in the RoboSim window to ensure keyboard input is captured.',
        },
        {
          title: 'Use WASD for Base & Shoulder',
          description: 'W/S = Shoulder up/down, A/D = Base rotate left/right. Hold keys for continuous movement.',
        },
        {
          title: 'Use Arrow Keys for Elbow & Wrist',
          description: 'Up/Down = Elbow angle, Left/Right = Wrist angle.',
        },
        {
          title: 'Use Q/E for Wrist Roll',
          description: 'Q = Roll left, E = Roll right. Fine-tune the gripper orientation.',
        },
        {
          title: 'Use Space/Shift for Gripper',
          description: 'Space = Open gripper, Shift = Close gripper. Perfect for pick and place tasks.',
          tip: 'Combine multiple keys for diagonal/complex movements'
        },
      ],
    },
    {
      id: 'gamepad',
      title: 'Gamepad Controller Support',
      icon: <Gamepad2 className="w-5 h-5" />,
      color: 'orange',
      benefit: 'Use any USB/Bluetooth game controller for intuitive analog control with smooth precision.',
      steps: [
        {
          title: 'Connect Your Gamepad',
          description: 'Plug in a USB controller or pair via Bluetooth. Xbox, PlayStation, and generic controllers are supported.',
        },
        {
          title: 'Verify Detection',
          description: 'The "Pad" button in Advanced Controls shows a green dot when a gamepad is detected.',
        },
        {
          title: 'Enable Gamepad Mode',
          description: 'Go to Control tab → Advanced Controls, click the "Pad" button. It turns orange when active.',
        },
        {
          title: 'Left Stick: Base & Shoulder',
          description: 'Left stick X-axis = Base rotation, Y-axis = Shoulder angle.',
        },
        {
          title: 'Right Stick: Elbow & Wrist',
          description: 'Right stick X-axis = Wrist angle, Y-axis = Elbow angle.',
        },
        {
          title: 'Triggers & Bumpers',
          description: 'Left/Right triggers = Close/Open gripper. Bumpers = Wrist roll left/right.',
          tip: 'Analog triggers give proportional gripper control'
        },
      ],
    },
    {
      id: 'tasks',
      title: 'Task Templates (Pick & Place)',
      icon: <Package className="w-5 h-5" />,
      color: 'orange',
      benefit: 'Run pre-programmed robot sequences for common tasks with one click.',
      steps: [
        {
          title: 'Find Task Templates Panel',
          description: 'Go to the Control tab in the Tools panel (right side), then open "Task Templates".',
        },
        {
          title: 'Browse Available Tasks',
          description: 'View 6 pre-built sequences: Pick & Place (Left/Right), Stack Objects, Arc Scan, Wave Hello, Demo Cycle.',
        },
        {
          title: 'Run a Task',
          description: 'Click the play button next to any task. The robot executes the full waypoint sequence with smooth motion.',
        },
        {
          title: 'Control Playback',
          description: 'Use pause/resume and stop buttons to control execution. A progress bar shows completion status.',
          tip: 'Watch the Joint Trajectory Graph to see how joints move during tasks'
        },
      ],
    },
    {
      id: 'trajectory',
      title: 'Joint Trajectory Graph',
      icon: <LineChart className="w-5 h-5" />,
      color: 'cyan',
      benefit: 'Visualize real-time joint positions over time - essential for debugging and analysis.',
      steps: [
        {
          title: 'Locate the Graph',
          description: 'Go to the Control tab in the Tools panel (right side), then open "Trajectory".',
        },
        {
          title: 'Understand the Display',
          description: 'X-axis = Time (last 10 seconds), Y-axis = Joint angle (-100° to +100°). Each joint has a different color.',
        },
        {
          title: 'Toggle Joint Visibility',
          description: 'Click the colored joint buttons (Base, Shoulder, Elbow, etc.) to show/hide specific joints.',
        },
        {
          title: 'Pause Recording',
          description: 'Click the pause icon to freeze the display. Click again to resume recording.',
        },
        {
          title: 'Clear History',
          description: 'Click the trash icon to clear all recorded data and start fresh.',
          tip: 'Use this to compare "before and after" when tuning movements'
        },
      ],
    },
    {
      id: 'workspace',
      title: 'Workspace Visualization',
      icon: <Layers className="w-5 h-5" />,
      color: 'blue',
      benefit: 'See exactly where the robot arm can reach with a 3D visualization of its workspace envelope.',
      steps: [
        {
          title: 'Open Advanced Controls Settings',
          description: 'Go to Control tab → Advanced Controls, click the settings gear icon to expand options.',
        },
        {
          title: 'Enable Workspace Toggle',
          description: 'Turn on "Show Workspace" to display the workspace visualization.',
        },
        {
          title: 'Understand the Visualization',
          description: 'Blue semi-transparent dome = reachable area. Red inner zone = too close to base (unreachable).',
        },
        {
          title: 'Use for Planning',
          description: 'When placing objects in the environment, ensure they fall within the blue dome for the arm to reach them.',
          tip: 'Rotate the 3D view to see the workspace from different angles'
        },
      ],
    },
    {
      id: 'serial',
      title: 'Serial Connection',
      icon: <Usb className="w-5 h-5" />,
      color: 'blue',
      benefit: 'Connect directly to your real SO-101 robot and mirror simulation movements in real-time!',
      steps: [
        {
          title: 'Check Browser Compatibility',
          description: 'Web Serial requires Chrome, Edge, or Opera. Firefox and Safari are not supported.',
        },
        {
          title: 'Find Serial Connection Panel',
          description: 'Go to the Hardware tab in the Tools panel (right side), then open "Serial Connection".',
        },
        {
          title: 'Connect Your Robot',
          description: 'Click "Connect" and select your USB serial port from the browser dialog.',
          tip: 'Usually /dev/ttyUSB0 on Linux, COM3+ on Windows'
        },
        {
          title: 'Configure Baud Rate',
          description: 'Default is 115200. Click settings gear to change if your hardware uses a different rate.',
        },
        {
          title: 'Enable Auto-Sync',
          description: 'Turn on "Auto-sync" to mirror every simulation movement to real hardware at 30-60 Hz.',
        },
        {
          title: 'Manual Send',
          description: 'With auto-sync off, click "Send" to manually push current position to hardware.',
          tip: 'Command format: J0:1500,J1:1500,J2:1500,J3:1500,J4:1500,J5:1500'
        },
      ],
    },
    {
      id: 'hand',
      title: 'Hand Tracking',
      icon: <Hand className="w-5 h-5" />,
      color: 'pink',
      benefit: 'Control the robot arm naturally using your hand movements via webcam.',
      steps: [
        {
          title: 'Find Hand Tracking Panel',
          description: 'Go to the Hardware tab in the Tools panel (right side), then open "Hand Tracking".',
        },
        {
          title: 'Enable Camera Access',
          description: 'Click "Start Tracking" and allow camera permission when prompted.',
        },
        {
          title: 'Position Your Hand',
          description: 'Hold your hand in front of the camera with fingers spread. A skeleton overlay shows detection.',
        },
        {
          title: 'Move the Arm',
          description: 'Move your hand in 3D space - the robot arm follows your hand position.',
        },
        {
          title: 'Control the Gripper',
          description: 'Pinch your thumb and index finger together to close the gripper. Spread them to open.',
          tip: 'Good lighting improves tracking accuracy'
        },
      ],
    },
    {
      id: 'dataset',
      title: 'Record Dataset',
      icon: <Download className="w-5 h-5" />,
      color: 'cyan',
      benefit: 'Record robot movements for machine learning training in HuggingFace LeRobot format.',
      steps: [
        {
          title: 'Find Record Dataset Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "Record Dataset".',
        },
        {
          title: 'Start Recording',
          description: 'Click "Record" to begin capturing joint positions at 30 Hz.',
        },
        {
          title: 'Perform Actions',
          description: 'Teleoperate the robot using any control method (keyboard, gamepad, hand tracking).',
        },
        {
          title: 'Stop Recording',
          description: 'Click "Stop" when your demonstration is complete.',
        },
        {
          title: 'Export Dataset',
          description: 'Click "Export" to download in LeRobot format (.json with joint trajectories).',
          tip: 'Use for imitation learning with HuggingFace LeRobot framework'
        },
      ],
    },
    {
      id: 'code',
      title: 'Code Editor',
      icon: <Code className="w-5 h-5" />,
      color: 'green',
      benefit: 'Write and run JavaScript/TypeScript code to program precise robot behaviors.',
      steps: [
        {
          title: 'Switch to Code Tab',
          description: 'Click "Code" tab in the header navigation bar.',
        },
        {
          title: 'Write Robot Code',
          description: 'Use the Monaco editor to write code using the robot API (robot.moveJoint, robot.goHome, etc.).',
        },
        {
          title: 'Run Your Program',
          description: 'Click the green "Run" button to execute your code. Watch the simulation viewport.',
        },
        {
          title: 'Debug with Console',
          description: 'Check the console panel for errors and console.log output.',
        },
        {
          title: 'Export to Hardware',
          description: 'Use the export dropdown to generate Arduino, Python, or MicroPython code.',
          tip: 'Templates are available for common tasks'
        },
      ],
    },
    {
      id: 'autogen',
      title: 'Auto-Generate',
      icon: <Wand2 className="w-5 h-5" />,
      color: 'lime',
      benefit: 'Generate 100+ training episodes instantly with one click - no manual demos needed.',
      steps: [
        {
          title: 'Open Auto-Generate Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "Auto-Generate".',
        },
        {
          title: 'Select Task Templates',
          description: 'Choose which parameterized tasks to generate episodes for.',
        },
        {
          title: 'Configure Settings',
          description: 'Set episode count, randomization ranges, and augmentation multiplier.',
        },
        {
          title: 'Generate Episodes',
          description: 'Click Generate. Episodes are created with randomized parameters.',
        },
        {
          title: 'Export Dataset',
          description: 'Export to LeRobot format or upload directly to HuggingFace Hub.',
          tip: 'Combined with augmentation, can generate 1000+ episodes in minutes'
        },
      ],
    },
    {
      id: 'challenges',
      title: 'Guided Challenges',
      icon: <GraduationCap className="w-5 h-5" />,
      color: 'rose',
      benefit: 'Learn robot control through interactive challenges with real-time feedback.',
      steps: [
        {
          title: 'Open Guided Challenges',
          description: 'In the Control tab, find "Guided Challenges" panel.',
        },
        {
          title: 'Select a Challenge',
          description: 'Choose from Basic Movement, Reach Position, or Pick Motion challenges.',
        },
        {
          title: 'Follow Instructions',
          description: 'Each step shows target joint positions you need to match.',
        },
        {
          title: 'Match Positions',
          description: 'Move joints using sliders or keyboard. Green indicators show when you match.',
        },
        {
          title: 'Complete the Challenge',
          description: 'Steps auto-advance when matched. Complete all steps to finish.',
          tip: 'Great for learning joint relationships and robot capabilities'
        },
      ],
    },
    {
      id: 'augment',
      title: 'Augmentation',
      icon: <Layers className="w-5 h-5" />,
      color: 'indigo',
      benefit: 'Multiply your recorded datasets 2-10x with automatic trajectory variations.',
      steps: [
        {
          title: 'Record Some Episodes',
          description: 'First record demonstration episodes using Record Dataset.',
        },
        {
          title: 'Open Augmentation Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "Augmentation".',
        },
        {
          title: 'Select Augmentation Types',
          description: 'Choose from: Action Noise, Time Stretch, Spatial Jitter, Temporal Dropout, Mirror.',
        },
        {
          title: 'Set Multiplier',
          description: 'Choose how many augmented copies to create (2x to 10x).',
        },
        {
          title: 'Generate Augmented Data',
          description: 'Click Augment. New episodes are created with variations applied.',
          tip: 'Augmentation helps policies generalize better to real hardware'
        },
      ],
    },
    {
      id: 'randomization',
      title: 'Visual Randomization',
      icon: <Palette className="w-5 h-5" />,
      color: 'violet',
      benefit: 'Randomize lighting, materials, and camera to prepare policies for real-world transfer.',
      steps: [
        {
          title: 'Open Visual Randomization',
          description: 'Go to the More tab in the Tools panel (right side), then open "Visual Randomization".',
        },
        {
          title: 'Adjust Lighting',
          description: 'Randomize ambient intensity, directional light, and shadow softness.',
        },
        {
          title: 'Vary Materials',
          description: 'Adjust metalness, roughness, and color tinting ranges.',
        },
        {
          title: 'Camera Jitter',
          description: 'Add FOV and position variations for viewpoint diversity.',
        },
        {
          title: 'Enable Auto-Randomize',
          description: 'Turn on continuous randomization during recording for domain-randomized datasets.',
          tip: 'Use presets: Bright Studio, Moody, Outdoor, Factory'
        },
      ],
    },
    {
      id: 'upload',
      title: 'Upload to Hub',
      icon: <Upload className="w-5 h-5" />,
      color: 'sky',
      benefit: 'Upload your recorded datasets directly to HuggingFace Hub - no CLI required.',
      steps: [
        {
          title: 'Record Episodes',
          description: 'Use Record Dataset or Auto-Generate to create training data.',
        },
        {
          title: 'Open Upload to Hub Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "Upload to Hub".',
        },
        {
          title: 'Enter HuggingFace Token',
          description: 'Get a write token from huggingface.co/settings/tokens and paste it.',
        },
        {
          title: 'Name Your Dataset',
          description: 'Enter a dataset name. A repository will be created automatically.',
        },
        {
          title: 'Upload',
          description: 'Click Upload. Progress shows as files are pushed to Hub.',
          tip: 'Dataset card with metadata is auto-generated'
        },
      ],
    },
    {
      id: 'langlearn',
      title: 'Language-Conditioned Training',
      icon: <Languages className="w-5 h-5" />,
      color: 'amber',
      benefit: 'Train robots to follow natural language instructions - the key to models like RT-1, RT-2, and OpenVLA.',
      steps: [
        {
          title: 'Open LeRobot Dataset Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "LeRobot Dataset".',
        },
        {
          title: 'Expand Settings',
          description: 'Click the settings arrow to expand the configuration panel.',
        },
        {
          title: 'Enter Language Instruction',
          description: 'In the "Language Instruction" field, type a natural language description like "Pick up the red cube and place it on the green target".',
          tip: 'Be specific and descriptive - this is what the robot learns to understand'
        },
        {
          title: 'Record Your Demonstration',
          description: 'Click Record, then perform the task using any control method (keyboard, gamepad, etc.). Click Success when done.',
        },
        {
          title: 'Export with Language Data',
          description: 'Export to LeRobot format. The language_instruction is included in episodes.jsonl metadata.',
        },
        {
          title: 'Train Language-Conditioned Policy',
          description: 'Use the dataset with LeRobot ACT/Diffusion policy or fine-tune OpenVLA for language-conditioned control.',
          tip: 'Each episode can have a unique instruction for diverse training data'
        },
      ],
    },
    {
      id: 'objects',
      title: 'Object Library',
      icon: <Box className="w-5 h-5" />,
      color: 'purple',
      benefit: 'Load physics-enabled objects and scene presets for robot manipulation tasks - no manual setup needed.',
      steps: [
        {
          title: 'Open Object Library',
          description: 'Go to the Control tab in the Tools panel (right side), then open "Object Library".',
        },
        {
          title: 'Load a Scene Preset',
          description: 'Choose from 7 presets: Block Stacking, Multi-Stack, Cup Pouring, Color Sorting, Fruit Pick & Place, Can Lineup, Office Desk.',
          tip: 'Presets load multiple objects in useful configurations for common tasks'
        },
        {
          title: 'Or Add Individual Objects',
          description: 'Browse 6 categories: Containers, Food, Tools, Toys, Kitchen, Office. Click any object to add it.',
        },
        {
          title: 'Manage Scene Objects',
          description: 'View all objects in scene. Click trash icon to remove individual objects, or Clear All to reset.',
        },
        {
          title: 'Interact with Physics',
          description: 'Objects have realistic physics - use the gripper to grab and manipulate them.',
          tip: 'Great for recording diverse manipulation demonstrations'
        },
      ],
    },
    {
      id: 'llmphysics',
      title: 'LLM → Physics Recording',
      icon: <Wand2 className="w-5 h-5" />,
      color: 'fuchsia',
      benefit: 'Generate training data by describing tasks in natural language - AI executes in physics simulation with camera recording.',
      steps: [
        {
          title: 'Open LLM → Physics Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "LLM → Physics".',
        },
        {
          title: 'Select a Scene Preset',
          description: 'Choose a scene preset (e.g., Block Stacking) to load objects for the task.',
        },
        {
          title: 'Enter Task Instruction',
          description: 'Type a natural language instruction like "Pick up the red block and stack it on the blue block".',
          tip: 'Use the Quick Tasks buttons for common instructions'
        },
        {
          title: 'Configure Generation',
          description: 'Set episode count (1-50) and toggle camera capture for vision training.',
        },
        {
          title: 'Generate Episodes',
          description: 'Click Generate. AI creates motion plan, physics sim executes, camera captures frames.',
        },
        {
          title: 'Export Training Data',
          description: 'Export to LeRobot format with language instructions + camera images for RT-1/OpenVLA training.',
          tip: 'Language instruction is embedded in dataset metadata'
        },
      ],
    },
  ];

  const quickStartSteps = [
    { step: 1, title: 'Select Robot', description: 'Choose SO-101 Arm from the dropdown in the header', icon: <Bot className="w-5 h-5" /> },
    { step: 2, title: 'Try Manual Control', description: 'In the Control tab, use Joint Controls to move each joint', icon: <Settings className="w-5 h-5" /> },
    { step: 3, title: 'Enable Keyboard Mode', description: 'In Control tab → Advanced Controls, click "Keys" for WASD control', icon: <Keyboard className="w-5 h-5" /> },
    { step: 4, title: 'Run a Task', description: 'In Control tab → Task Templates, click play on "Pick & Place"', icon: <Play className="w-5 h-5" /> },
    { step: 5, title: 'Connect Hardware', description: 'In Hardware tab → Serial Connection, connect your robot', icon: <Usb className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-base overflow-x-hidden">
      {/* Grid background */}
      <div
        className="fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #fff 1px, transparent 1px),
            linear-gradient(to bottom, #fff 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Nav - Mobile responsive */}
      <nav className="relative flex items-center justify-between px-4 md:px-8 py-4 md:py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 md:gap-2 text-slate-400 hover:text-white transition text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-blue-500/20 border-2 border-blue-500">
              <Bot className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
            </div>
            <span className="text-lg md:text-xl font-black text-white tracking-tight">ROBOSIM</span>
          </div>
        </div>
        <button
          onClick={onGetStarted}
          className="bg-white text-black px-4 md:px-6 py-2 md:py-3 text-sm md:text-lg font-bold transition hover:bg-blue-400 hover:text-white border-2 border-white hover:border-blue-400"
        >
          <span className="hidden sm:inline">LAUNCH SIMULATOR</span>
          <span className="sm:hidden">START</span>
        </button>
      </nav>

      {/* Hero - Mobile responsive */}
      <section className="relative px-4 md:px-8 pt-6 md:pt-8 pb-8 md:pb-12 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-transparent text-green-400 px-3 md:px-4 py-2 text-xs md:text-sm mb-4 md:mb-6 border-2 border-green-500 font-mono">
          <Zap className="w-3 h-3 md:w-4 md:h-4" />
          STEP-BY-STEP GUIDE
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 md:mb-6 leading-tight">
          How to Use <span className="text-green-400">RoboSim</span>
        </h1>
        <p className="text-base md:text-xl text-slate-400 max-w-3xl">
          Complete guide to all features with step-by-step instructions.
          From basic joint control to hardware connection and AI programming.
        </p>
      </section>

      {/* Quick Start - Mobile responsive */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-5xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
          <Play className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
          Quick Start (5 Minutes)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {quickStartSteps.map((item) => (
            <div
              key={item.step}
              className="bg-slate-900/50 border-2 border-slate-700/50 p-3 md:p-4 relative hover:border-green-500/50 transition"
            >
              <div className="absolute -top-2 -left-2 md:-top-3 md:-left-3 w-6 h-6 md:w-8 md:h-8 bg-green-500 flex items-center justify-center font-black text-black text-sm md:text-base">
                {item.step}
              </div>
              <div className="text-green-400 mb-2 mt-2">{item.icon}</div>
              <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Guides - Mobile responsive */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-5xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
          <Target className="w-6 h-6 text-purple-400" />
          Feature Guides
        </h2>

        <div className="space-y-4">
          {features.map((feature) => (
            <div
              key={feature.id}
              className={`bg-slate-900/50 border-2 transition-all ${
                expandedSection === feature.id
                  ? `border-${feature.color}-500/60`
                  : 'border-slate-700/50 hover:border-slate-600'
              }`}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedSection(expandedSection === feature.id ? null : feature.id)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-${feature.color}-500/20 text-${feature.color}-400`}>
                    {feature.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.benefit}</p>
                  </div>
                </div>
                {expandedSection === feature.id ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* Steps */}
              {expandedSection === feature.id && (
                <div className="px-4 pb-4 border-t border-slate-700/50">
                  <div className="mt-4 space-y-4">
                    {feature.steps.map((step, index) => (
                      <div key={index} className="flex gap-4">
                        <div className={`flex-shrink-0 w-8 h-8 bg-${feature.color}-500/20 text-${feature.color}-400 flex items-center justify-center font-bold text-sm border border-${feature.color}-500/30`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-white mb-1">{step.title}</h4>
                          <p className="text-sm text-slate-400">{step.description}</p>
                          {step.tip && (
                            <div className="mt-2 flex items-start gap-2 text-xs">
                              <CheckCircle className={`w-4 h-4 text-${feature.color}-400 flex-shrink-0 mt-0.5`} />
                              <span className="text-slate-500">
                                <span className="text-slate-400 font-medium">Tip:</span> {step.tip}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* AI Features Section */}
      <section className="relative px-4 md:px-8 py-12 md:py-16 bg-gradient-to-b from-slate-900/50 to-transparent max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-4 flex items-center justify-center gap-3">
            <Brain className="w-7 h-7 md:w-8 md:h-8 text-pink-400" />
            AI-Powered Features
          </h2>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
            12 integrated AI capabilities spanning control, vision, generation, and training
          </p>
        </div>

        {/* Overview Panel */}
        <div className="bg-slate-800/50 border-2 border-pink-500/30 p-4 md:p-6 mb-8">
          <h3 className="text-lg font-bold text-pink-400 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Features Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm">
            <div className="text-center p-3 bg-slate-900/50 rounded">
              <div className="text-2xl font-black text-blue-400">4</div>
              <div className="text-slate-400">Control Modes</div>
            </div>
            <div className="text-center p-3 bg-slate-900/50 rounded">
              <div className="text-2xl font-black text-purple-400">3</div>
              <div className="text-slate-400">Vision Models</div>
            </div>
            <div className="text-center p-3 bg-slate-900/50 rounded">
              <div className="text-2xl font-black text-emerald-400">3</div>
              <div className="text-slate-400">Generation Tools</div>
            </div>
            <div className="text-center p-3 bg-slate-900/50 rounded">
              <div className="text-2xl font-black text-amber-400">2</div>
              <div className="text-slate-400">Training Systems</div>
            </div>
          </div>
        </div>

        {/* AI Control Section */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            AI Control & Interaction
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-blue-500/30 p-5 hover:border-blue-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <h4 className="font-bold text-white">AI Chat Control</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Natural language robot control with Claude AI. Describe tasks in plain English and watch them execute.
              </p>
              <div className="bg-slate-950/50 p-2 rounded text-xs text-slate-500 font-mono">
                "Pick up the red block and place it on the blue one"
              </div>
            </div>
            <div className="bg-slate-900/50 border border-cyan-500/30 p-5 hover:border-cyan-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <Mic className="w-5 h-5 text-cyan-400" />
                <h4 className="font-bold text-white">Voice Control</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Hands-free robot operation with Web Speech API. Wake word support and voice feedback.
              </p>
              <div className="bg-slate-950/50 p-2 rounded text-xs text-slate-500 font-mono">
                "Hey Robot, wave hello"
              </div>
            </div>
            <div className="bg-slate-900/50 border border-yellow-500/30 p-5 hover:border-yellow-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <Code className="w-5 h-5 text-yellow-400" />
                <h4 className="font-bold text-white">Code Copilot</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                AI-powered code editor with smart completions, comment-to-code generation, and error fixing.
              </p>
              <div className="bg-slate-950/50 p-2 rounded text-xs text-slate-500 font-mono">
                // wave hello → Ctrl+Shift+G generates code
              </div>
            </div>
            <div className="bg-slate-900/50 border border-pink-500/30 p-5 hover:border-pink-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <Hand className="w-5 h-5 text-pink-400" />
                <h4 className="font-bold text-white">Hand Tracking</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                MediaPipe-powered gesture control. Move your hand to control the robot arm in real-time.
              </p>
              <div className="bg-slate-950/50 p-2 rounded text-xs text-slate-500 font-mono">
                Pinch gesture → Close gripper
              </div>
            </div>
          </div>
        </div>

        {/* AI Vision Section */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-400" />
            AI Vision & Understanding
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-purple-500/30 p-5 hover:border-purple-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <Eye className="w-5 h-5 text-purple-400" />
                <h4 className="font-bold text-white">Vision Analysis</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Ask questions about the scene. Uses DETR for object detection + Claude Vision for understanding.
              </p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Object detection (DETR)</li>
                <li>• Scene classification</li>
                <li>• Spatial queries</li>
              </ul>
            </div>
            <div className="bg-slate-900/50 border border-purple-500/30 p-5 hover:border-purple-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <Camera className="w-5 h-5 text-purple-400" />
                <h4 className="font-bold text-white">Blob Detection</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Real-time color-based object tracking. HSV filtering with configurable thresholds.
              </p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Color presets (RGB, etc.)</li>
                <li>• Bounding boxes</li>
                <li>• Centroid tracking</li>
              </ul>
            </div>
            <div className="bg-slate-900/50 border border-purple-500/30 p-5 hover:border-purple-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <Brain className="w-5 h-5 text-purple-400" />
                <h4 className="font-bold text-white">Transformers.js</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Browser-based ML models. No GPU required - all inference runs locally.
              </p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• ViT classification</li>
                <li>• CLIP zero-shot</li>
                <li>• DPT depth estimation</li>
              </ul>
            </div>
          </div>
        </div>

        {/* AI Generation Section */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Box className="w-5 h-5 text-emerald-400" />
            AI Content Generation
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-emerald-500/30 p-5 hover:border-emerald-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <Box className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-white">Text to 3D</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Generate 3D objects from descriptions. Procedural meshes with optional AI textures.
              </p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• "red apple" → 3D model</li>
                <li>• Realistic/Cartoon styles</li>
                <li>• Physics-enabled objects</li>
              </ul>
            </div>
            <div className="bg-slate-900/50 border border-emerald-500/30 p-5 hover:border-emerald-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <Image className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-white">Image to 3D (CSM)</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Upload real object photos → CSM.ai generates accurate 3D models with auto grasp points.
              </p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Photo → 3D mesh</li>
                <li>• Auto grasp estimation</li>
                <li>• Training task generation</li>
              </ul>
            </div>
            <div className="bg-slate-900/50 border border-emerald-500/30 p-5 hover:border-emerald-500/60 transition">
              <div className="flex items-center gap-3 mb-3">
                <Wand2 className="w-5 h-5 text-emerald-400" />
                <h4 className="font-bold text-white">AI Environments</h4>
              </div>
              <p className="text-slate-400 text-sm mb-3">
                Generate scene backdrops and textures with Gemini AI. Warehouse, garden, lab presets.
              </p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Background generation</li>
                <li>• Floor/wall textures</li>
                <li>• Object textures</li>
              </ul>
            </div>
          </div>
        </div>

        {/* AI Training Section */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Languages className="w-5 h-5 text-amber-400" />
            AI Training & Data Generation
            <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">NEW</span>
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border-2 border-fuchsia-500/50 p-5 md:p-6 hover:border-fuchsia-500/80 transition">
              <div className="flex items-center gap-3 mb-3">
                <Wand2 className="w-6 h-6 text-fuchsia-400" />
                <div>
                  <h4 className="font-bold text-white text-lg">LLM → Physics Recording</h4>
                  <span className="text-xs text-fuchsia-400 font-medium">Language-Conditioned Data Generation</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Type natural language instructions → AI generates motion plan → Physics simulation executes with real Rapier physics →
                Camera captures frames at 30 FPS → Export language-conditioned datasets for RT-1/OpenVLA training.
              </p>
              <div className="bg-slate-950/50 p-3 rounded mb-4">
                <div className="text-xs text-fuchsia-400 mb-2">Example Workflow:</div>
                <div className="font-mono text-xs text-slate-300 space-y-1">
                  <div>1. "Stack the red block on blue"</div>
                  <div>2. AI parses → motion plan</div>
                  <div>3. Physics sim executes</div>
                  <div>4. Camera records frames</div>
                  <div>5. Export with language</div>
                </div>
              </div>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Natural language instructions embedded in metadata</li>
                <li>• Real physics interactions (Rapier engine)</li>
                <li>• Camera capture at 30 FPS</li>
                <li>• LeRobot v3.0 format export</li>
                <li>• Compatible with RT-1, OpenVLA, ACT</li>
              </ul>
            </div>
            <div className="bg-slate-900/50 border-2 border-amber-500/50 p-5 md:p-6 hover:border-amber-500/80 transition">
              <div className="flex items-center gap-3 mb-3">
                <Languages className="w-6 h-6 text-amber-400" />
                <div>
                  <h4 className="font-bold text-white text-lg">Language-Conditioned Training</h4>
                  <span className="text-xs text-amber-400 font-medium">Train Robots to Understand Commands</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                The holy grail of robot learning: robots that understand natural language. Record demonstrations with free-form instructions,
                export to LeRobot format, and train policies that follow human commands.
              </p>
              <div className="bg-slate-950/50 p-3 rounded mb-4">
                <div className="text-xs text-amber-400 mb-2">Supported Models:</div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded">RT-1</span>
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded">RT-2</span>
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded">OpenVLA</span>
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded">LeRobot ACT</span>
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded">Diffusion</span>
                </div>
              </div>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Free-form instructions per episode</li>
                <li>• Auto-episode generator (100+ episodes)</li>
                <li>• Dataset augmentation (2-10x expansion)</li>
                <li>• Direct HuggingFace Hub upload</li>
                <li>• Object Library with YCB benchmark items</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Object Library Callout */}
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 p-4 md:p-6 rounded-lg">
          <div className="flex flex-col md:flex-row items-start gap-4">
            <div className="p-3 bg-purple-500/20 rounded">
              <Box className="w-8 h-8 text-purple-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-white mb-2">Object Library for Manipulation Tasks</h4>
              <p className="text-slate-400 text-sm mb-4">
                34 physics-enabled objects including YCB benchmark items (standard robotics research objects).
                7 scene presets for common manipulation tasks.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-900/50 p-2 rounded text-center">
                  <div className="text-purple-400 font-bold">16</div>
                  <div className="text-slate-500">Primitives</div>
                </div>
                <div className="bg-slate-900/50 p-2 rounded text-center">
                  <div className="text-purple-400 font-bold">18</div>
                  <div className="text-slate-500">YCB Objects</div>
                </div>
                <div className="bg-slate-900/50 p-2 rounded text-center">
                  <div className="text-purple-400 font-bold">7</div>
                  <div className="text-slate-500">Scene Presets</div>
                </div>
                <div className="bg-slate-900/50 p-2 rounded text-center">
                  <div className="text-purple-400 font-bold">6</div>
                  <div className="text-slate-500">Categories</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Keyboard Reference */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Keyboard className="w-6 h-6 text-purple-400" />
          Keyboard Controls Reference
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-purple-500/30 p-6">
            <h3 className="text-lg font-bold text-purple-400 mb-4">SO-101 Arm</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Base rotate</span>
                <span className="font-mono text-white">A / D</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Shoulder</span>
                <span className="font-mono text-white">W / S</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Elbow</span>
                <span className="font-mono text-white">Up / Down</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wrist</span>
                <span className="font-mono text-white">Left / Right</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wrist Roll</span>
                <span className="font-mono text-white">Q / E</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gripper Open</span>
                <span className="font-mono text-white">Space</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gripper Close</span>
                <span className="font-mono text-white">Shift</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-orange-500/30 p-6">
            <h3 className="text-lg font-bold text-orange-400 mb-4">Gamepad (Xbox Layout)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Base/Shoulder</span>
                <span className="font-mono text-white">Left Stick</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Elbow/Wrist</span>
                <span className="font-mono text-white">Right Stick</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wrist Roll</span>
                <span className="font-mono text-white">LB / RB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Close Gripper</span>
                <span className="font-mono text-white">LT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Open Gripper</span>
                <span className="font-mono text-white">RT</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Serial Protocol */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Cpu className="w-6 h-6 text-cyan-400" />
          Hardware Protocol Reference
        </h2>
        <div className="bg-slate-900/50 border border-cyan-500/30 p-6">
          <h3 className="text-lg font-bold text-cyan-400 mb-4">Serial Command Format</h3>
          <p className="text-slate-400 text-sm mb-4">
            RoboSim sends servo positions as PWM microsecond values over serial at the configured baud rate.
          </p>
          <div className="bg-slate-950 p-4 rounded font-mono text-sm">
            <code className="text-cyan-300">J0:1500,J1:1500,J2:1500,J3:1500,J4:1500,J5:1500\n</code>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-bold text-white mb-2">Joint Mapping</h4>
              <ul className="text-slate-500 space-y-1">
                <li>J0 = Base (shoulder_pan)</li>
                <li>J1 = Shoulder (shoulder_lift)</li>
                <li>J2 = Elbow (elbow_flex)</li>
                <li>J3 = Wrist (wrist_flex)</li>
                <li>J4 = Wrist Roll (wrist_roll)</li>
                <li>J5 = Gripper</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-2">PWM Range</h4>
              <ul className="text-slate-500 space-y-1">
                <li>500 = Joint minimum</li>
                <li>1500 = Joint center</li>
                <li>2500 = Joint maximum</li>
                <li>Newline terminates each command</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-8 py-16 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-black text-white mb-4">Ready to Start?</h2>
        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
          Jump into the simulator and try these features yourself.
          No installation required - everything runs in your browser.
        </p>
        <button
          onClick={onGetStarted}
          className="bg-green-500 text-white px-10 py-4 text-xl font-bold transition hover:bg-green-400 border-2 border-green-500"
          style={{ boxShadow: '4px 4px 0 rgba(34, 197, 94, 0.3)' }}
        >
          Launch Simulator
        </button>
      </section>

      {/* Footer */}
      <footer className="relative px-8 py-10 border-t-2 border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-500">
            <Bot className="w-6 h-6" />
            <span className="text-lg font-bold tracking-tight">ROBOSIM</span>
          </div>
          <p className="text-slate-600 font-medium">
            Built for learning robotics
          </p>
        </div>
      </footer>
    </div>
  );
};
