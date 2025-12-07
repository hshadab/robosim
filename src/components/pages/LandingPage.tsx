import { useState } from 'react';
import {
  Bot,
  Play,
  Zap,
  MessageSquare,
  Brain,
  Download,
  Gamepad2,
  Monitor,
  ChevronRight,
  Check,
  ArrowRight,
  Globe,
  Sparkles,
  GitBranch,
  Mic,
  Eye,
  Box,
  Code,
  Database,
  BookOpen,
  Wand2,
  GraduationCap,
  Upload,
  Layers,
  Palette,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

interface LandingPageProps {
  onLogin: () => void;
  onLearnMore?: () => void;
  onInstructions?: () => void;
}

// Brutalist Robot Arm SVG
const RobotArmSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none">
    <rect x="35" y="95" width="50" height="20" fill="#1e293b" stroke="#3b82f6" strokeWidth="3"/>
    <rect x="52" y="55" width="16" height="45" fill="#1e293b" stroke="#3b82f6" strokeWidth="3"/>
    <circle cx="60" cy="55" r="10" fill="#3b82f6" stroke="#1e293b" strokeWidth="2"/>
    <rect x="52" y="20" width="16" height="40" fill="#1e293b" stroke="#3b82f6" strokeWidth="3" transform="rotate(-15 60 55)"/>
    <circle cx="48" cy="22" r="8" fill="#3b82f6" stroke="#1e293b" strokeWidth="2"/>
    <rect x="38" y="8" width="20" height="12" fill="#1e293b" stroke="#3b82f6" strokeWidth="3"/>
    <rect x="35" y="2" width="6" height="10" fill="#3b82f6"/>
    <rect x="55" y="2" width="6" height="10" fill="#3b82f6"/>
    <circle cx="60" cy="100" r="3" fill="#3b82f6"/>
    <circle cx="60" cy="75" r="2" fill="#60a5fa"/>
  </svg>
);

// Feature tabs configuration
type FeatureTab = 'chat' | 'policies' | 'datasets' | 'control' | 'export' | 'voice' | 'vision' | 'copilot' | 'text3d' | 'autogen' | 'challenges' | 'augment';

const FEATURE_TABS: Array<{
  id: FeatureTab;
  label: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  benefits: string[];
  howTo: string[];
  color: string;
}> = [
  {
    id: 'chat',
    label: 'AI Chat',
    icon: <MessageSquare className="w-5 h-5" />,
    title: 'Natural Language Control',
    description: 'Talk to your robot like a teammate. Describe what you want in plain English and watch it happen.',
    benefits: [
      'No coding required to get started',
      'Context-aware - understands "move left from here"',
      'Real-time feedback in chat',
      'Learns from your instructions',
    ],
    howTo: [
      'Open the Chat panel on the left',
      'Type a command like "wave hello" or "pick up the block"',
      'Watch the robot execute in real-time',
      'Ask questions like "where is the gripper?"',
    ],
    color: 'blue',
  },
  {
    id: 'policies',
    label: 'AI Policies',
    icon: <Brain className="w-5 h-5" />,
    title: 'Load Trained Policies from HuggingFace',
    description: 'Browse and run pre-trained robot policies directly in your browser. No GPU or server required.',
    benefits: [
      'Access to LeRobot community policies',
      'ACT, Diffusion, and more architectures',
      'Runs locally with ONNX Runtime',
      'SafeTensors model format support',
    ],
    howTo: [
      'Open the "LeRobot Policies" panel',
      'Search for SO-101 compatible policies',
      'Click Download on a policy with ONNX',
      'Click Run to start autonomous control',
    ],
    color: 'purple',
  },
  {
    id: 'datasets',
    label: 'Datasets',
    icon: <Database className="w-5 h-5" />,
    title: 'Record & Share Training Datasets',
    description: 'Record demonstrations, export to LeRobot format, and upload directly to HuggingFace Hub.',
    benefits: [
      'Real Apache Parquet file export',
      'Multi-camera recording support',
      'Dataset quality analysis dashboard',
      'Direct upload to HuggingFace Hub',
    ],
    howTo: [
      'Open the Data tab in the Tools panel',
      'Click Record and demonstrate a task',
      'Mark success or failure when done',
      'Export to LeRobot or upload to Hub',
    ],
    color: 'teal',
  },
  {
    id: 'control',
    label: 'Manual Control',
    icon: <Gamepad2 className="w-5 h-5" />,
    title: 'Multiple Control Modes',
    description: 'Control your robot with sliders, keyboard, gamepad, or click-to-move inverse kinematics.',
    benefits: [
      'Joint sliders for precise positioning',
      'WASD + arrow keys for teleoperation',
      'Full gamepad support',
      'Click anywhere in 3D to move gripper',
    ],
    howTo: [
      'Use the Joint Controls panel for direct control',
      'Enable "Keyboard" mode in Advanced Controls',
      'Connect a gamepad for analog control',
      'Click "IK Mode" to point-and-click move',
    ],
    color: 'green',
  },
  {
    id: 'export',
    label: 'Hardware Export',
    icon: <Download className="w-5 h-5" />,
    title: 'Deploy to Real Hardware',
    description: 'Export your simulation code to run on actual robots. Support for LeRobot, Arduino, and more.',
    benefits: [
      'LeRobot Python for SO-101 hardware',
      'Arduino C++ for DIY projects',
      'MicroPython for ESP32/Pico',
      'Web Serial for direct connection',
    ],
    howTo: [
      'Build your robot program in simulation',
      'Click Export and choose your platform',
      'Copy the generated code to your robot',
      'Or connect via Web Serial for live sync',
    ],
    color: 'orange',
  },
  {
    id: 'voice',
    label: 'Voice Control',
    icon: <Mic className="w-5 h-5" />,
    title: 'Hands-Free Robot Control',
    description: 'Control your robot using voice commands. Say "wave hello" or "pick up the block" and watch it happen.',
    benefits: [
      'Web Speech API integration',
      'Wake word support ("Hey Robot")',
      'Voice feedback and confirmations',
      'Works in Chrome and Edge browsers',
    ],
    howTo: [
      'Open the Voice Control panel',
      'Click the microphone button to start',
      'Speak commands like "move left"',
      'Enable wake word for hands-free use',
    ],
    color: 'cyan',
  },
  {
    id: 'vision',
    label: 'Vision AI',
    icon: <Eye className="w-5 h-5" />,
    title: 'Scene Understanding with AI',
    description: 'Ask "What\'s in the scene?" and get intelligent answers. Uses local models + Claude Vision for analysis.',
    benefits: [
      'Object detection with DETR',
      'Scene classification',
      'Graspable object recognition',
      'Spatial queries ("where is the red object?")',
    ],
    howTo: [
      'Open the Vision Analysis panel',
      'Click "Analyze Scene" to capture',
      'Ask questions about the scene',
      'Get suggested robot actions',
    ],
    color: 'pink',
  },
  {
    id: 'copilot',
    label: 'Code Copilot',
    icon: <Code className="w-5 h-5" />,
    title: 'AI-Powered Code Editor',
    description: 'Get intelligent code completions, generate code from comments, and explain robot programs.',
    benefits: [
      'Robot API autocomplete',
      'Generate code from comments',
      'Explain selected code',
      'Fix errors with AI suggestions',
    ],
    howTo: [
      'Write a comment like "// wave hello"',
      'Press Ctrl+Shift+G to generate code',
      'Select code and press Ctrl+Shift+E',
      'Get intelligent completions as you type',
    ],
    color: 'yellow',
  },
  {
    id: 'text3d',
    label: 'Text to 3D',
    icon: <Box className="w-5 h-5" />,
    title: 'Generate 3D Objects from Text',
    description: 'Describe objects like "red apple" or "wooden box" and generate interactive 3D models.',
    benefits: [
      'Natural language input',
      'Multiple styles (realistic, cartoon, low-poly)',
      'AI-generated textures with Gemini',
      'Physics-enabled for robot interaction',
    ],
    howTo: [
      'Open the Text to 3D panel',
      'Type a description like "blue ball"',
      'Choose style and click generate',
      'Object appears in the scene',
    ],
    color: 'emerald',
  },
  {
    id: 'autogen',
    label: 'Auto-Generate',
    icon: <Wand2 className="w-5 h-5" />,
    title: 'One-Click Synthetic Data Generation',
    description: 'Generate 100+ training episodes instantly from parameterized task templates with automatic augmentation.',
    benefits: [
      'Generate 100+ episodes in seconds',
      'Randomized task parameters for variety',
      'Built-in trajectory augmentation',
      'Direct LeRobot format export',
    ],
    howTo: [
      'Open the Data tab and Auto-Generate panel',
      'Select task templates to use',
      'Configure episode count and augmentation',
      'Click Generate and export to Hub',
    ],
    color: 'lime',
  },
  {
    id: 'challenges',
    label: 'Challenges',
    icon: <GraduationCap className="w-5 h-5" />,
    title: 'Interactive Guided Challenges',
    description: 'Learn robot control through hands-on challenges with real-time position validation and progress tracking.',
    benefits: [
      'Three difficulty levels',
      'Real-time position feedback',
      'Step-by-step guidance with hints',
      'Auto-advance on completion',
    ],
    howTo: [
      'Open the Control tab and Guided Challenges',
      'Select a challenge to start',
      'Follow the instructions to move joints',
      'Match target positions to progress',
    ],
    color: 'rose',
  },
  {
    id: 'augment',
    label: 'Augmentation',
    icon: <Layers className="w-5 h-5" />,
    title: 'Dataset Augmentation & Domain Randomization',
    description: 'Multiply your datasets with trajectory variations and visual randomization for robust sim-to-real transfer.',
    benefits: [
      'Action noise and time stretching',
      'Lighting and material randomization',
      'Preview before applying',
      '2x-10x dataset expansion',
    ],
    howTo: [
      'Record some demonstration episodes',
      'Open the Augmentation panel',
      'Configure noise and variation settings',
      'Generate augmented dataset',
    ],
    color: 'indigo',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLearnMore, onInstructions }) => {
  const [hoveredRobot, setHoveredRobot] = useState<string | null>(null);
  const [activeFeatureTab, setActiveFeatureTab] = useState<FeatureTab>('chat');
  const login = useAuthStore((state) => state.login);

  const handleEnterApp = () => {
    login('demo@robosim.dev');
  };

  const activeFeature = FEATURE_TABS.find(f => f.id === activeFeatureTab)!;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-base overflow-x-hidden">
      {/* Grid background */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #fff 1px, transparent 1px),
            linear-gradient(to bottom, #fff 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Navigation */}
      <nav className="relative flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 border-2 border-blue-500">
            <Bot className="w-8 h-8 text-blue-400" />
          </div>
          <span className="text-2xl font-black text-white tracking-tight">ROBOSIM</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-slate-400 hover:text-white transition font-medium">
            Features
          </a>
          {onLearnMore && (
            <a
              href="/learnmore"
              onClick={(e) => {
                e.preventDefault();
                onLearnMore();
              }}
              className="text-slate-400 hover:text-white transition font-medium"
            >
              Learn More
            </a>
          )}
          {onInstructions && (
            <a
              href="/how-to-use"
              onClick={(e) => {
                e.preventDefault();
                onInstructions();
              }}
              className="text-slate-400 hover:text-white transition font-medium"
            >
              How to Use
            </a>
          )}
          <button
            onClick={handleEnterApp}
            className="bg-white text-black px-6 py-2.5 font-bold transition hover:bg-blue-400 hover:text-white border-2 border-white hover:border-blue-400"
          >
            GET STARTED
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-8 pt-16 pb-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 text-sm mb-6 border border-blue-500/30 font-mono">
              <Zap className="w-4 h-4" />
              AI-NATIVE ROBOTICS SIMULATION
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight tracking-tight">
              Build Robot Skills
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400">
                In Your Browser
              </span>
            </h1>
            <p className="text-xl text-slate-400 mb-8 leading-relaxed">
              Simulate, program, and deploy robots with natural language control,
              pre-trained AI policies, and one-click hardware export.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={handleEnterApp}
                className="group flex items-center gap-3 bg-white text-black px-8 py-4 text-lg font-bold transition hover:bg-blue-400 hover:text-white border-2 border-white hover:border-blue-400"
                style={{ boxShadow: '4px 4px 0 rgba(59, 130, 246, 0.4)' }}
              >
                <Play className="w-5 h-5" fill="currentColor" />
                Start Building
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={onInstructions}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition px-6 py-4 border-2 border-slate-700 hover:border-slate-500"
              >
                <Monitor className="w-5 h-5" />
                Watch Demo
              </button>
            </div>
            <div className="flex items-center gap-6 mt-8 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                Free to use
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                No install required
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                Works offline
              </span>
            </div>
          </div>
          <div className="relative">
            {/* Robot Preview */}
            <div
              className="relative cursor-pointer"
              onMouseEnter={() => setHoveredRobot('arm')}
              onMouseLeave={() => setHoveredRobot(null)}
              onClick={handleEnterApp}
            >
              <div className={`
                w-80 h-80 mx-auto flex items-center justify-center
                bg-[#0a0f1a] border-2 border-blue-500/50
                transition-all duration-300
                ${hoveredRobot === 'arm' ? 'scale-105' : ''}
              `}
              style={{
                boxShadow: hoveredRobot === 'arm' ? '8px 8px 0 rgba(59, 130, 246, 0.3)' : '4px 4px 0 rgba(59, 130, 246, 0.2)',
              }}
              >
                <RobotArmSVG className="w-64 h-64" />
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-6 py-2 font-bold text-sm">
                SO-101 ROBOT ARM
              </div>
              <div className="absolute -top-4 -right-4 bg-green-500 text-white px-3 py-1 text-xs font-bold">
                AVAILABLE NOW
              </div>
            </div>
            {/* Floating badges */}
            <div className="absolute top-8 -left-8 bg-slate-800 border border-slate-700 px-4 py-2 text-sm">
              <span className="text-purple-400 font-bold">6-DOF</span>
              <span className="text-slate-400 ml-2">Articulated</span>
            </div>
            <div className="absolute bottom-20 -right-8 bg-slate-800 border border-slate-700 px-4 py-2 text-sm">
              <span className="text-green-400 font-bold">LeRobot</span>
              <span className="text-slate-400 ml-2">Compatible</span>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Highlight */}
      <section className="relative px-8 py-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-5 gap-4 mb-4">
          {[
            { icon: <MessageSquare className="w-6 h-6" />, label: 'Chat Control', desc: 'Natural language', color: 'blue' },
            { icon: <Mic className="w-6 h-6" />, label: 'Voice Control', desc: 'Hands-free', color: 'cyan' },
            { icon: <Eye className="w-6 h-6" />, label: 'Vision AI', desc: 'Scene understanding', color: 'pink' },
            { icon: <Code className="w-6 h-6" />, label: 'Code Copilot', desc: 'AI autocomplete', color: 'yellow' },
            { icon: <Box className="w-6 h-6" />, label: 'Text to 3D', desc: 'Generate objects', color: 'emerald' },
          ].map((item) => (
            <div
              key={item.label}
              className={`p-4 bg-slate-800/50 border-l-4 border-${item.color}-500 hover:bg-slate-800 transition`}
            >
              <div className={`text-${item.color}-400 mb-2`}>{item.icon}</div>
              <div className="text-white font-bold">{item.label}</div>
              <div className="text-slate-500 text-sm">{item.desc}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[
            { icon: <Wand2 className="w-6 h-6" />, label: 'Auto-Generate', desc: '100+ episodes', color: 'lime' },
            { icon: <GraduationCap className="w-6 h-6" />, label: 'Challenges', desc: 'Learn by doing', color: 'rose' },
            { icon: <Upload className="w-6 h-6" />, label: 'Hub Upload', desc: 'Direct publish', color: 'sky' },
            { icon: <Layers className="w-6 h-6" />, label: 'Augmentation', desc: '10x datasets', color: 'indigo' },
            { icon: <Palette className="w-6 h-6" />, label: 'Randomization', desc: 'Sim-to-real', color: 'violet' },
          ].map((item) => (
            <div
              key={item.label}
              className={`p-4 bg-slate-800/50 border-l-4 border-${item.color}-500 hover:bg-slate-800 transition`}
            >
              <div className={`text-${item.color}-400 mb-2`}>{item.icon}</div>
              <div className="text-white font-bold">{item.label}</div>
              <div className="text-slate-500 text-sm">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Deep Dive with Tabs */}
      <section id="features" className="relative px-8 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-white mb-4">Powerful Features</h2>
          <p className="text-xl text-slate-400">Everything you need to build robot intelligence</p>
        </div>

        {/* Feature Tabs */}
        <div className="flex justify-center gap-2 mb-12">
          {FEATURE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFeatureTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-bold transition border-2 ${
                activeFeatureTab === tab.id
                  ? `bg-${tab.color}-500/20 border-${tab.color}-500 text-${tab.color}-400`
                  : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Feature Content */}
        <div className="grid grid-cols-2 gap-12">
          {/* Left: Description & Benefits */}
          <div className={`p-8 bg-slate-800/50 border-2 border-${activeFeature.color}-500/50`}>
            <div className={`inline-flex items-center gap-2 text-${activeFeature.color}-400 mb-4`}>
              {activeFeature.icon}
              <span className="font-bold uppercase tracking-wide">{activeFeature.label}</span>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">{activeFeature.title}</h3>
            <p className="text-lg text-slate-400 mb-8">{activeFeature.description}</p>

            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-4">Benefits</h4>
            <ul className="space-y-3">
              {activeFeature.benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className={`w-5 h-5 text-${activeFeature.color}-400 flex-shrink-0 mt-0.5`} />
                  <span className="text-slate-300">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: How to Use */}
          <div className="p-8 bg-[#0a0f1a] border-2 border-slate-700">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-6 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              How to Use
            </h4>
            <ol className="space-y-6">
              {activeFeature.howTo.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className={`w-8 h-8 flex items-center justify-center bg-${activeFeature.color}-500/20 border border-${activeFeature.color}-500/50 text-${activeFeature.color}-400 font-bold text-sm flex-shrink-0`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <span className="text-white">{step}</span>
                  </div>
                </li>
              ))}
            </ol>
            <button
              onClick={handleEnterApp}
              className={`mt-8 w-full flex items-center justify-center gap-2 py-3 bg-${activeFeature.color}-500/20 border-2 border-${activeFeature.color}-500/50 text-${activeFeature.color}-400 font-bold hover:bg-${activeFeature.color}-500/30 transition`}
            >
              Try {activeFeature.label} Now
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="relative px-8 py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-2">Powered By</h2>
          </div>
          <div className="flex justify-center items-center gap-12 flex-wrap">
            {[
              { name: 'React', desc: 'UI Framework' },
              { name: 'Three.js', desc: '3D Graphics' },
              { name: 'Rapier', desc: 'Physics Engine' },
              { name: 'ONNX Runtime', desc: 'ML Inference' },
              { name: 'HuggingFace', desc: 'Model Hub' },
              { name: 'LeRobot', desc: 'Robot Learning' },
            ].map((tech) => (
              <div key={tech.name} className="text-center">
                <div className="text-lg font-bold text-white">{tech.name}</div>
                <div className="text-sm text-slate-500">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-8 py-24 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 text-green-400 mb-6">
          <Globe className="w-5 h-5" />
          <span className="font-bold">100% Browser-Based</span>
        </div>
        <h2 className="text-5xl font-black text-white mb-6">
          Ready to Build Your
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            Robot Intelligence?
          </span>
        </h2>
        <p className="text-xl text-slate-400 mb-10">
          No downloads, no setup, no GPU required. Start building in seconds.
        </p>
        <button
          onClick={handleEnterApp}
          className="group inline-flex items-center gap-3 bg-white text-black px-12 py-5 text-xl font-black transition-all duration-200 hover:bg-blue-400 hover:text-white border-4 border-white hover:border-blue-400 uppercase tracking-wide"
          style={{ boxShadow: '6px 6px 0 rgba(59, 130, 246, 0.5)' }}
        >
          <Play className="w-6 h-6" fill="currentColor" />
          Launch RoboSim
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
        <p className="text-slate-500 mt-6">
          Free forever for personal use
        </p>
      </section>

      {/* Footer */}
      <footer className="relative px-8 py-12 border-t-2 border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Bot className="w-6 h-6 text-blue-400" />
                <span className="text-xl font-bold text-white">ROBOSIM</span>
              </div>
              <p className="text-slate-500 text-sm">
                AI-native robotics simulation for education, research, and prototyping.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Features</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="hover:text-white cursor-pointer">AI Chat Control</li>
                <li className="hover:text-white cursor-pointer">Voice Control</li>
                <li className="hover:text-white cursor-pointer">Vision-Language AI</li>
                <li className="hover:text-white cursor-pointer">Auto-Episode Generator</li>
                <li className="hover:text-white cursor-pointer">Guided Challenges</li>
                <li className="hover:text-white cursor-pointer">HuggingFace Upload</li>
                <li className="hover:text-white cursor-pointer">Domain Randomization</li>
                <li className="hover:text-white cursor-pointer">Dataset Augmentation</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="hover:text-white cursor-pointer">Documentation</li>
                <li className="hover:text-white cursor-pointer">API Reference</li>
                <li className="hover:text-white cursor-pointer">Tutorials</li>
                <li className="hover:text-white cursor-pointer">GitHub</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Integrations</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  HuggingFace Hub
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  LeRobot Framework
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  ONNX Runtime
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  Web Serial API
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 flex items-center justify-between text-sm text-slate-600">
            <span>Built for learning robotics</span>
            <span>Open source on GitHub</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
