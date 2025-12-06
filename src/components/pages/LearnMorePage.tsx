import React from 'react';
import {
  Bot, ArrowLeft, Code, Cpu, Brain, Camera, Database, Download,
  Gamepad2, Layers, Zap, Smartphone, Terminal, BookOpen, Settings, Hand
} from 'lucide-react';

interface LearnMorePageProps {
  onBack: () => void;
  onGetStarted: () => void;
}

export const LearnMorePage: React.FC<LearnMorePageProps> = ({ onBack, onGetStarted }) => {
  const techStack = [
    { name: 'React + TypeScript', desc: 'Modern UI framework', icon: <Code className="w-5 h-5" /> },
    { name: 'Three.js + React Three Fiber', desc: '3D rendering', icon: <Layers className="w-5 h-5" /> },
    { name: 'Rapier Physics', desc: 'Real-time physics simulation', icon: <Zap className="w-5 h-5" /> },
    { name: 'Claude AI (Anthropic)', desc: 'Natural language to robot commands', icon: <Brain className="w-5 h-5" /> },
    { name: 'MediaPipe Vision', desc: 'Hand and pose tracking', icon: <Camera className="w-5 h-5" /> },
    { name: 'Transformers.js', desc: 'Browser-based ML models', icon: <Brain className="w-5 h-5" /> },
    { name: 'avr8js', desc: 'Arduino ATmega328p emulation', icon: <Cpu className="w-5 h-5" /> },
    { name: 'urdf-loader', desc: 'URDF robot model parsing', icon: <Bot className="w-5 h-5" /> },
    { name: 'Monaco Editor', desc: 'VS Code-like code editing', icon: <Terminal className="w-5 h-5" /> },
    { name: 'Zustand', desc: 'Lightweight state management', icon: <Database className="w-5 h-5" /> },
  ];

  const robots = [
    {
      name: 'SO-101 Robot Arm (6-DOF)',
      desc: 'Open-source desktop arm from The Robot Studio. Realistic 3D model from official URDF with STS3215 servo motors (1/345 gear ratio). Export to LeRobot Python for real hardware.',
      joints: ['Base/Shoulder Pan (±110°)', 'Shoulder Lift (±100°)', 'Elbow Flex (±97°)', 'Wrist Flex (±95°)', 'Wrist Roll (-157° to 163°)', 'Gripper (0-100%)'],
      useCases: ['Pick and place', 'LeRobot teleoperation', 'AI/ML research', 'Imitation learning'],
      color: 'blue'
    },
    {
      name: '4WD Wheeled Robot',
      desc: 'Four-wheel drive mobile robot with sensors. Simulates differential drive with skid steering.',
      joints: ['Left Wheels', 'Right Wheels', 'Head Servo (camera pan)'],
      useCases: ['Line following', 'Obstacle avoidance', 'Maze solving', 'Autonomous navigation'],
      color: 'green'
    },
    {
      name: 'Quadcopter Drone',
      desc: 'Four-rotor aerial vehicle with 6-DOF movement. Full position and orientation control.',
      joints: ['Throttle (altitude)', 'Roll', 'Pitch', 'Yaw'],
      useCases: ['Aerial photography', 'Waypoint navigation', 'Terrain mapping', 'Inspection tasks'],
      color: 'purple'
    },
    {
      name: 'Berkeley Humanoid Lite (22-DOF)',
      desc: 'Open-source bipedal robot inspired by Berkeley Humanoid. 0.8m tall, 16kg. Arms, legs, and torso articulation.',
      joints: ['Hip pitch/roll/yaw', 'Knee', 'Ankle pitch/roll', 'Shoulder', 'Elbow', 'Wrist'],
      useCases: ['Walking patterns', 'Balance control', 'Human-robot interaction', 'Gesture recognition'],
      color: 'orange'
    },
  ];

  const programmingMethods = [
    {
      title: 'Natural Language (AI Chat)',
      icon: <Brain className="w-6 h-6" />,
      description: 'Describe what you want in plain English. The AI assistant converts your instructions into robot commands.',
      example: '"Pick up the red cube and place it on the blue platform"',
      color: 'blue'
    },
    {
      title: 'TypeScript/JavaScript',
      icon: <Code className="w-6 h-6" />,
      description: 'Write code directly using our robot API. Full control with intellisense support.',
      example: 'robot.moveTo({ base: 45, shoulder: 30, elbow: -60 })',
      color: 'green'
    },
    {
      title: 'Hand Gesture Control',
      icon: <Hand className="w-6 h-6" />,
      description: 'Use your webcam to control robots with hand gestures via MediaPipe tracking.',
      example: 'Move your hand to control arm position, pinch to close gripper',
      color: 'pink'
    },
    {
      title: 'Arduino Code',
      icon: <Cpu className="w-6 h-6" />,
      description: 'Write Arduino sketches and run them in the browser-based ATmega328p emulator.',
      example: 'myservo.write(90); // Move servo to 90 degrees',
      color: 'cyan'
    },
  ];

  const exportOptions = [
    {
      platform: 'LeRobot Python (SO-101)',
      desc: 'Export to HuggingFace LeRobot framework with FeetechMotorsBus for real SO-101 hardware.',
      format: '.py',
      icon: <Bot className="w-5 h-5" />
    },
    {
      platform: 'Arduino (ATmega328p)',
      desc: 'Export C++ code with Servo library. Compatible with Arduino Uno, Nano, Mega.',
      format: '.ino',
      icon: <Cpu className="w-5 h-5" />
    },
    {
      platform: 'ESP32 / ESP8266',
      desc: 'WiFi-enabled microcontroller code with AsyncWebServer for remote control.',
      format: '.ino',
      icon: <Smartphone className="w-5 h-5" />
    },
    {
      platform: 'Raspberry Pi',
      desc: 'Python code using pigpio for GPIO control. Flask server for web interface.',
      format: '.py',
      icon: <Terminal className="w-5 h-5" />
    },
    {
      platform: 'MicroPython',
      desc: 'Lightweight Python for embedded systems. ESP32/ESP8266/Pico compatible.',
      format: '.py',
      icon: <Code className="w-5 h-5" />
    },
    {
      platform: 'LeRobot Dataset',
      desc: 'Export telemetry data in LeRobot format for imitation learning and training.',
      format: '.json',
      icon: <Database className="w-5 h-5" />
    },
  ];

  const useCases = [
    {
      title: 'Education',
      desc: 'Learn robotics programming without expensive hardware. Perfect for schools and bootcamps.',
      icon: <BookOpen className="w-6 h-6" />,
    },
    {
      title: 'Prototyping',
      desc: 'Test robot programs before deploying to real hardware. Save time and prevent damage.',
      icon: <Settings className="w-6 h-6" />,
    },
    {
      title: 'AI Training Data',
      desc: 'Generate training datasets for imitation learning and reinforcement learning models.',
      icon: <Brain className="w-6 h-6" />,
    },
    {
      title: 'Competition Prep',
      desc: 'Practice for robotics competitions. Test strategies without physical robots.',
      icon: <Gamepad2 className="w-6 h-6" />,
    },
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
          GET STARTED
        </button>
      </nav>

      {/* Hero */}
      <section className="relative px-8 pt-8 pb-16 max-w-5xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
          How <span className="text-blue-400">RoboSim</span> Works
        </h1>
        <p className="text-xl text-slate-400 max-w-3xl">
          RoboSim is an AI-native robotics simulation platform that runs entirely in your browser.
          Program robots using natural language, code, or hand gestures, then export to real hardware.
        </p>
      </section>

      {/* Tech Stack */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Layers className="w-6 h-6 text-purple-400" />
          Technology Stack
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {techStack.map((tech) => (
            <div
              key={tech.name}
              className="bg-slate-900/50 border border-slate-700/50 p-4 hover:border-purple-500/50 transition"
            >
              <div className="text-purple-400 mb-2">{tech.icon}</div>
              <h3 className="text-sm font-bold text-white">{tech.name}</h3>
              <p className="text-xs text-slate-500">{tech.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Robots */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Bot className="w-6 h-6 text-blue-400" />
          Available Robots
        </h2>
        <div className="space-y-6">
          {robots.map((robot) => (
            <div
              key={robot.name}
              className={`bg-slate-900/50 border-2 border-${robot.color}-500/30 p-6 hover:border-${robot.color}-500/60 transition`}
            >
              <h3 className={`text-xl font-bold text-${robot.color}-400 mb-2`}>{robot.name}</h3>
              <p className="text-slate-400 mb-4">{robot.desc}</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">Control Joints</h4>
                  <ul className="text-sm text-slate-500 space-y-1">
                    {robot.joints.map((joint, i) => (
                      <li key={i}>• {joint}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">Use Cases</h4>
                  <ul className="text-sm text-slate-500 space-y-1">
                    {robot.useCases.map((uc, i) => (
                      <li key={i}>• {uc}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Programming Methods */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Code className="w-6 h-6 text-green-400" />
          Ways to Program Robots
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {programmingMethods.map((method) => (
            <div
              key={method.title}
              className={`bg-slate-900/50 border-2 border-${method.color}-500/30 p-6`}
            >
              <div className={`text-${method.color}-400 mb-3`}>{method.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2">{method.title}</h3>
              <p className="text-slate-400 text-sm mb-3">{method.description}</p>
              <div className="bg-slate-950 p-3 rounded font-mono text-xs text-slate-300">
                {method.example}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Export Options */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Download className="w-6 h-6 text-cyan-400" />
          Export to Hardware
        </h2>
        <p className="text-slate-400 mb-6">
          Once you've developed and tested your robot program, export it to run on real hardware.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {exportOptions.map((opt) => (
            <div
              key={opt.platform}
              className="bg-slate-900/50 border border-slate-700/50 p-4 hover:border-cyan-500/50 transition"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-cyan-400">{opt.icon}</span>
                <span className="text-sm font-bold text-white">{opt.platform}</span>
                <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">{opt.format}</span>
              </div>
              <p className="text-xs text-slate-500">{opt.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Gamepad2 className="w-6 h-6 text-orange-400" />
          Use Cases
        </h2>
        <div className="grid md:grid-cols-4 gap-4">
          {useCases.map((uc) => (
            <div
              key={uc.title}
              className="bg-slate-900/50 border border-slate-700/50 p-5 hover:border-orange-500/50 transition text-center"
            >
              <div className="text-orange-400 mb-3 flex justify-center">{uc.icon}</div>
              <h3 className="text-sm font-bold text-white mb-2">{uc.title}</h3>
              <p className="text-xs text-slate-500">{uc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Features */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Brain className="w-6 h-6 text-pink-400" />
          AI-Powered Features
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-pink-500/30 p-6">
            <h3 className="text-lg font-bold text-pink-400 mb-3">Claude AI Integration</h3>
            <p className="text-slate-400 text-sm mb-4">
              Connect your Anthropic API key to use Claude for natural language robot programming.
              Describe tasks in plain English and the AI converts them to executable robot commands.
            </p>
            <ul className="text-sm text-slate-500 space-y-1">
              <li>• "Move arm to pick up the cube"</li>
              <li>• "Navigate to waypoint A avoiding obstacles"</li>
              <li>• "Wave hello then point at the camera"</li>
            </ul>
          </div>
          <div className="bg-slate-900/50 border border-pink-500/30 p-6">
            <h3 className="text-lg font-bold text-pink-400 mb-3">Computer Vision (Transformers.js)</h3>
            <p className="text-slate-400 text-sm mb-4">
              Browser-based ML models for object detection, image classification, and depth estimation.
              No server required - all processing happens locally.
            </p>
            <ul className="text-sm text-slate-500 space-y-1">
              <li>• DETR object detection</li>
              <li>• ViT image classification</li>
              <li>• CLIP zero-shot classification</li>
              <li>• DPT depth estimation</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="relative px-8 py-16 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-black text-white mb-4">Ready to Start Building?</h2>
        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
          Jump into the simulator and start programming robots in minutes.
          No installation required - everything runs in your browser.
        </p>
        <button
          onClick={onGetStarted}
          className="bg-blue-500 text-white px-10 py-4 text-xl font-bold transition hover:bg-blue-400 border-2 border-blue-500"
          style={{ boxShadow: '4px 4px 0 rgba(59, 130, 246, 0.3)' }}
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
