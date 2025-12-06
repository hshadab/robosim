import React, { useState } from 'react';
import {
  Bot, ArrowLeft, MousePointer2, Keyboard, Gamepad2, Package, LineChart,
  Usb, Play, Target, Layers, ChevronDown, ChevronRight, Zap, Hand,
  Code, Download, Settings, Brain, Cpu, CheckCircle
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
          description: 'In the right panel, find "Advanced Controls" and click the "Click" button (mouse icon) to enable click-to-move mode.',
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
          description: 'In "Advanced Controls", click the "Keys" button (keyboard icon). The panel turns purple when active.',
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
          description: 'Click the "Pad" button to activate gamepad control. It turns orange when active.',
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
          description: 'Scroll down in the right sidebar to find "Task Templates" (package icon).',
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
          description: 'The Joint Trajectory Graph is in the center column, below the environment and sensor panels.',
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
          description: 'In "Advanced Controls" panel, click the settings gear icon to expand options.',
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
      title: 'Hardware Connection (Web Serial)',
      icon: <Usb className="w-5 h-5" />,
      color: 'blue',
      benefit: 'Connect directly to your real SO-101 robot and mirror simulation movements in real-time!',
      steps: [
        {
          title: 'Check Browser Compatibility',
          description: 'Web Serial requires Chrome, Edge, or Opera. Firefox and Safari are not supported.',
        },
        {
          title: 'Find Hardware Connection Panel',
          description: 'In the right sidebar, find "Hardware Connection" (USB icon).',
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
      title: 'Hand Gesture Control',
      icon: <Hand className="w-5 h-5" />,
      color: 'pink',
      benefit: 'Control the robot arm naturally using your hand movements via webcam.',
      steps: [
        {
          title: 'Find Hand Tracking Panel',
          description: 'In the right sidebar, find "Hand Tracking" panel.',
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
      id: 'ai',
      title: 'AI Chat Programming',
      icon: <Brain className="w-5 h-5" />,
      color: 'pink',
      benefit: 'Describe what you want in plain English and let AI generate the robot commands.',
      steps: [
        {
          title: 'Configure API Key',
          description: 'Click the settings gear in the header and enter your Anthropic API key for Claude AI.',
        },
        {
          title: 'Open Chat Panel',
          description: 'The AI Chat panel is in the left column of the Simulate tab.',
        },
        {
          title: 'Describe Your Task',
          description: 'Type natural language commands like "pick up the red cube" or "wave hello".',
        },
        {
          title: 'Review Generated Code',
          description: 'The AI generates robot commands. Review them in the response before execution.',
        },
        {
          title: 'Run the Commands',
          description: 'Click "Run" to execute the generated robot program. Watch the arm move!',
          tip: 'Be specific about positions and objects for better results'
        },
      ],
    },
    {
      id: 'dataset',
      title: 'Dataset Recording (LeRobot)',
      icon: <Download className="w-5 h-5" />,
      color: 'cyan',
      benefit: 'Record robot movements for machine learning training in HuggingFace LeRobot format.',
      steps: [
        {
          title: 'Find Dataset Recorder',
          description: 'In the right sidebar, find "Dataset Recorder" panel.',
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
  ];

  const quickStartSteps = [
    { step: 1, title: 'Select Robot', description: 'Choose SO-101 Arm from the dropdown in the header', icon: <Bot className="w-5 h-5" /> },
    { step: 2, title: 'Try Manual Control', description: 'Use the joint sliders on the right to move each joint', icon: <Settings className="w-5 h-5" /> },
    { step: 3, title: 'Enable Keyboard Mode', description: 'Click "Keys" in Advanced Controls, then use WASD', icon: <Keyboard className="w-5 h-5" /> },
    { step: 4, title: 'Run a Task', description: 'Click play on "Pick & Place" in Task Templates', icon: <Play className="w-5 h-5" /> },
    { step: 5, title: 'Connect Hardware', description: 'If you have real hardware, use Serial Connection', icon: <Usb className="w-5 h-5" /> },
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

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 border-2 border-blue-500">
              <Bot className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">ROBOSIM</span>
          </div>
        </div>
        <button
          onClick={onGetStarted}
          className="bg-white text-black px-6 py-3 text-lg font-bold transition hover:bg-blue-400 hover:text-white border-2 border-white hover:border-blue-400"
        >
          LAUNCH SIMULATOR
        </button>
      </nav>

      {/* Hero */}
      <section className="relative px-8 pt-8 pb-12 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-transparent text-green-400 px-4 py-2 text-sm mb-6 border-2 border-green-500 font-mono">
          <Zap className="w-4 h-4" />
          STEP-BY-STEP GUIDE
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
          How to Use <span className="text-green-400">RoboSim</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-3xl">
          Complete guide to all features with step-by-step instructions.
          From basic joint control to hardware connection and AI programming.
        </p>
      </section>

      {/* Quick Start */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Play className="w-6 h-6 text-green-400" />
          Quick Start (5 Minutes)
        </h2>
        <div className="grid grid-cols-5 gap-4">
          {quickStartSteps.map((item) => (
            <div
              key={item.step}
              className="bg-slate-900/50 border-2 border-slate-700/50 p-4 relative hover:border-green-500/50 transition"
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-green-500 flex items-center justify-center font-black text-black">
                {item.step}
              </div>
              <div className="text-green-400 mb-2 mt-2">{item.icon}</div>
              <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Guides */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
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
