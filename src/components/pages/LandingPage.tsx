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
  Mic,
  Eye,
  Box,
  Code,
  Database,
  Wand2,
  GraduationCap,
  Upload,
  Layers,
  Palette,
  Camera,
  Languages,
} from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
  onLearnMore?: () => void;
  onInstructions?: () => void;
  onComparison?: () => void;
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
type FeatureTab = 'quicktrain' | 'chat' | 'policies' | 'datasets' | 'control' | 'export' | 'voice' | 'vision' | 'copilot' | 'text3d' | 'image3d' | 'autogen' | 'challenges' | 'augment' | 'langlearn' | 'objects' | 'llmphysics';

const FEATURE_TABS: {
  id: FeatureTab;
  label: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  benefits: string[];
  howTo: string[];
  color: string;
}[] = [
  {
    id: 'quicktrain',
    label: 'Quick Train',
    icon: <Sparkles className="w-5 h-5" />,
    title: 'Photo to Trained Robot in Minutes',
    description: 'The fastest path from any object to a trained robot policy. One-click Demo Pick Up shows it working instantly, then chat to record your own demos.',
    benefits: [
      'One-click "Demo Pick Up" - see it work instantly',
      '34 standard objects sized for reliable grasping',
      'Photo to 3D via fal.ai (~20 seconds)',
      'Chat-based pickup with physics-tuned timing',
    ],
    howTo: [
      'Click "Demo Pick Up" to see instant success',
      'Or add an object and chat "pick up the cube"',
      'Watch physics-accurate grasping in action',
      'Click "Generate" then "Upload to HuggingFace"',
    ],
    color: 'gradient',
  },
  {
    id: 'chat',
    label: 'AI Chat',
    icon: <MessageSquare className="w-5 h-5" />,
    title: 'Natural Language Control',
    description: 'Talk to your robot like a teammate. Say "pick up the red cube" and watch physics-accurate grasping happen.',
    benefits: [
      'No coding required to get started',
      'Reliable physics-based pickup with IK solver',
      'Physics-tuned timing for real grasping',
      'Context-aware scene understanding',
    ],
    howTo: [
      'Open the Chat panel on the left',
      'Type "pick up the red cube" or "grab the block"',
      'Watch the robot grasp with realistic physics',
      'Try "stack it on the blue cube"',
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
    id: 'image3d',
    label: 'Image to 3D',
    icon: <Camera className="w-5 h-5" />,
    title: 'Photo to Training-Ready 3D Model',
    description: 'Upload a photo of any real object and convert it to a physics-ready 3D model with auto-estimated grasp points.',
    benefits: [
      'Upload any object photo',
      'CSM API generates accurate 3D mesh',
      'Auto-estimated grasp points for manipulation',
      'Generates training task templates automatically',
    ],
    howTo: [
      'Open the AI tab → Image to 3D panel',
      'Enter your CSM API key (free at csm.ai)',
      'Upload a photo and set real dimensions',
      'Generate model and add to scene for training',
    ],
    color: 'cyan',
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
  {
    id: 'langlearn',
    label: 'Language Training',
    icon: <Languages className="w-5 h-5" />,
    title: 'Language-Conditioned Robot Learning',
    description: 'Train robots to follow natural language instructions like RT-1, RT-2, and OpenVLA. The holy grail of robot learning.',
    benefits: [
      'Free-form language instructions per episode',
      'Compatible with RT-1, OpenVLA, LeRobot ACT',
      'Export to HuggingFace in standard format',
      'Train robots that understand human commands',
    ],
    howTo: [
      'Open Data tab → LeRobot Dataset panel',
      'Click Settings and enter a Language Instruction',
      'Record an episode while demonstrating the task',
      'Export with language_instruction in metadata',
    ],
    color: 'amber',
  },
  {
    id: 'objects',
    label: 'Object Library',
    icon: <Box className="w-5 h-5" />,
    title: 'Physics Object Library',
    description: 'Browse 34 physics-enabled objects including YCB benchmark items. Load scene presets for common manipulation tasks.',
    benefits: [
      '34 objects with realistic physics',
      'YCB benchmark objects (robotics standard)',
      '7 scene presets (stacking, sorting, pouring)',
      'One-click scene setup for training',
    ],
    howTo: [
      'Open Control tab → Object Library',
      'Choose a Scene Preset like "Block Stacking"',
      'Or browse categories and add individual objects',
      'Objects appear in scene ready for manipulation',
    ],
    color: 'purple',
  },
  {
    id: 'llmphysics',
    label: 'LLM → Physics',
    icon: <Wand2 className="w-5 h-5" />,
    title: 'Natural Language to Training Data',
    description: 'Type "Pick up the red cube" and watch reliable physics-based grasping with IK solver. Physics-tuned 4-step pickup sequence ensures consistent training data.',
    benefits: [
      'Natural language → IK solver → physics execution',
      'Simplified 4-step pickup (position → close → hold → lift)',
      '800ms gripper timing for reliable physics contact',
      'Language-conditioned datasets for RT-1/OpenVLA',
    ],
    howTo: [
      'Open Chat panel and add an object',
      'Type "Pick up the red cube"',
      'Watch physics-accurate grasping (not scripted!)',
      'Export recordings to LeRobot format',
    ],
    color: 'fuchsia',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onLearnMore, onInstructions, onComparison }) => {
  const [hoveredRobot, setHoveredRobot] = useState<string | null>(null);
  const [activeFeatureTab, setActiveFeatureTab] = useState<FeatureTab>('quicktrain');

  const handleEnterApp = () => {
    onLogin();
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

      {/* Navigation - Mobile responsive */}
      <nav className="relative flex items-center justify-between px-4 md:px-8 py-4 md:py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="p-1.5 md:p-2 bg-blue-500/20 border-2 border-blue-500">
            <Bot className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
          </div>
          <span className="text-xl md:text-2xl font-black text-white tracking-tight">ROBOSIM</span>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          {/* Desktop nav links - hidden on mobile */}
          <a href="#features" className="hidden md:inline text-slate-400 hover:text-white transition font-medium">
            Features
          </a>
          {onComparison && (
            <a
              href="/comparison"
              onClick={(e) => {
                e.preventDefault();
                onComparison();
              }}
              className="hidden lg:inline text-orange-400 hover:text-orange-300 transition font-medium"
            >
              Why RoboSim?
            </a>
          )}
          {onLearnMore && (
            <a
              href="/learnmore"
              onClick={(e) => {
                e.preventDefault();
                onLearnMore();
              }}
              className="hidden lg:inline text-slate-400 hover:text-white transition font-medium"
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
              className="hidden lg:inline text-slate-400 hover:text-white transition font-medium"
            >
              How to Use
            </a>
          )}
          <button
            onClick={handleEnterApp}
            className="bg-white text-black px-4 md:px-6 py-2 md:py-2.5 text-sm md:text-base font-bold transition hover:bg-blue-400 hover:text-white border-2 border-white hover:border-blue-400"
          >
            GET STARTED
          </button>
        </div>
      </nav>

      {/* Hero Section - Mobile responsive */}
      <section className="relative px-4 md:px-8 pt-8 md:pt-16 pb-8 md:pb-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 md:px-4 py-2 text-xs md:text-sm mb-4 md:mb-6 border border-blue-500/30 font-mono">
              <Zap className="w-3 h-3 md:w-4 md:h-4" />
              AI-NATIVE ROBOTICS
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 md:mb-6 leading-tight tracking-tight">
              From Chat to Real Robot
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400">
                In Your Browser
              </span>
            </h1>
            <p className="text-base md:text-xl text-slate-400 mb-6 md:mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
              No ROS. No MuJoCo. No GPU. Just open a URL and start building datasets for real robots.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 md:gap-4">
              <button
                onClick={handleEnterApp}
                className="group w-full sm:w-auto flex items-center justify-center gap-2 md:gap-3 bg-white text-black px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-bold transition hover:bg-blue-400 hover:text-white border-2 border-white hover:border-blue-400"
                style={{ boxShadow: '4px 4px 0 rgba(59, 130, 246, 0.4)' }}
              >
                <Play className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" />
                Start Building
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={onInstructions}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-slate-400 hover:text-white transition px-6 py-3 md:py-4 border-2 border-slate-700 hover:border-slate-500"
              >
                <Monitor className="w-4 h-4 md:w-5 md:h-5" />
                Watch Demo
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 md:gap-6 mt-6 md:mt-8 text-xs md:text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                Free to use
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                No install
              </span>
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                Works offline
              </span>
            </div>
          </div>
          <div className="relative hidden md:block">
            {/* Robot Preview - Hidden on small mobile */}
            <div
              className="relative cursor-pointer"
              onMouseEnter={() => setHoveredRobot('arm')}
              onMouseLeave={() => setHoveredRobot(null)}
              onClick={handleEnterApp}
            >
              <div className={`
                w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 mx-auto flex items-center justify-center
                bg-[#0a0f1a] border-2 border-blue-500/50
                transition-all duration-300
                ${hoveredRobot === 'arm' ? 'scale-105' : ''}
              `}
              style={{
                boxShadow: hoveredRobot === 'arm' ? '8px 8px 0 rgba(59, 130, 246, 0.3)' : '4px 4px 0 rgba(59, 130, 246, 0.2)',
              }}
              >
                <RobotArmSVG className="w-40 h-40 md:w-52 md:h-52 lg:w-64 lg:h-64" />
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 md:px-6 py-1.5 md:py-2 font-bold text-xs md:text-sm whitespace-nowrap">
                SO-101 ROBOT ARM
              </div>
              <div className="absolute -top-3 md:-top-4 -right-2 md:-right-4 bg-green-500 text-white px-2 md:px-3 py-1 text-xs font-bold">
                AVAILABLE
              </div>
            </div>
            {/* Floating badges - hidden on tablet */}
            <div className="hidden lg:block absolute top-8 -left-8 bg-slate-800 border border-slate-700 px-4 py-2 text-sm">
              <span className="text-purple-400 font-bold">6-DOF</span>
              <span className="text-slate-400 ml-2">Articulated</span>
            </div>
            <div className="hidden lg:block absolute bottom-20 -right-8 bg-slate-800 border border-slate-700 px-4 py-2 text-sm">
              <span className="text-green-400 font-bold">LeRobot</span>
              <span className="text-slate-400 ml-2">Compatible</span>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Highlight - Mobile responsive */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-3 md:mb-4">
          {[
            { icon: <Sparkles className="w-5 h-5 md:w-6 md:h-6" />, label: 'Quick Train', desc: 'Photo → Policy', color: 'purple' },
            { icon: <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />, label: 'Chat Control', desc: 'Natural language', color: 'blue' },
            { icon: <Mic className="w-5 h-5 md:w-6 md:h-6" />, label: 'Voice Control', desc: 'Hands-free', color: 'cyan' },
            { icon: <Eye className="w-5 h-5 md:w-6 md:h-6" />, label: 'Vision AI', desc: 'Scene understanding', color: 'pink' },
            { icon: <Box className="w-5 h-5 md:w-6 md:h-6" />, label: 'Object Library', desc: '34 objects', color: 'emerald' },
            { icon: <Camera className="w-5 h-5 md:w-6 md:h-6" />, label: 'Image to 3D', desc: 'Photo → 3D', color: 'teal' },
          ].map((item) => (
            <div
              key={item.label}
              className={`p-3 md:p-4 bg-slate-800/50 border-l-4 border-${item.color}-500 hover:bg-slate-800 transition`}
            >
              <div className={`text-${item.color}-400 mb-1 md:mb-2`}>{item.icon}</div>
              <div className="text-white font-bold text-sm md:text-base">{item.label}</div>
              <div className="text-slate-500 text-xs md:text-sm hidden sm:block">{item.desc}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {[
            { icon: <Languages className="w-5 h-5 md:w-6 md:h-6" />, label: 'Language Training', desc: 'RT-1/OpenVLA', color: 'amber' },
            { icon: <Wand2 className="w-5 h-5 md:w-6 md:h-6" />, label: 'Auto-Generate', desc: '100+ episodes', color: 'lime' },
            { icon: <GraduationCap className="w-5 h-5 md:w-6 md:h-6" />, label: 'Challenges', desc: 'Learn by doing', color: 'rose' },
            { icon: <Upload className="w-5 h-5 md:w-6 md:h-6" />, label: 'Hub Upload', desc: 'Direct publish', color: 'sky' },
            { icon: <Layers className="w-5 h-5 md:w-6 md:h-6" />, label: 'Augmentation', desc: '10x datasets', color: 'indigo' },
            { icon: <Palette className="w-5 h-5 md:w-6 md:h-6" />, label: 'Randomization', desc: 'Sim-to-real', color: 'violet' },
          ].map((item) => (
            <div
              key={item.label}
              className={`p-3 md:p-4 bg-slate-800/50 border-l-4 border-${item.color}-500 hover:bg-slate-800 transition`}
            >
              <div className={`text-${item.color}-400 mb-1 md:mb-2`}>{item.icon}</div>
              <div className="text-white font-bold text-sm md:text-base">{item.label}</div>
              <div className="text-slate-500 text-xs md:text-sm hidden sm:block">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why RoboSim? Mini Differentiators */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-center">
          <h3 className="text-lg font-bold text-white">Why RoboSim?</h3>
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-slate-400">Browser-first</span>
              <span className="text-slate-600">– no install</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span className="text-slate-400">LeRobot-native</span>
              <span className="text-slate-600">– Parquet + HF Hub</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-slate-400">Prompt-first</span>
              <span className="text-slate-600">– chat & voice control</span>
            </div>
          </div>
          {onComparison && (
            <button
              onClick={onComparison}
              className="text-orange-400 hover:text-orange-300 text-sm font-medium transition"
            >
              See full comparison →
            </button>
          )}
        </div>
      </section>

      {/* 3-Step Workflow */}
      <section className="relative px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">What You Can Do in an Afternoon</h2>
          <p className="text-slate-400">From zero to trained policy in three steps</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Step 1 */}
          <div className="relative bg-slate-800/50 border-2 border-slate-700 p-6 hover:border-blue-500/50 transition">
            <div className="absolute -top-4 left-6 bg-blue-500 text-white w-8 h-8 flex items-center justify-center font-black text-lg">
              1
            </div>
            <div className="mt-2">
              <h3 className="text-lg font-bold text-white mb-2">Teleoperate & Record</h3>
              <p className="text-slate-400 text-sm mb-4">
                Control the SO-101 with chat, keyboard, gamepad, or click-to-move IK.
                Connect real hardware via Web Serial.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">WASD Control</span>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Gamepad</span>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Web Serial</span>
              </div>
            </div>
          </div>
          {/* Step 2 */}
          <div className="relative bg-slate-800/50 border-2 border-slate-700 p-6 hover:border-purple-500/50 transition">
            <div className="absolute -top-4 left-6 bg-purple-500 text-white w-8 h-8 flex items-center justify-center font-black text-lg">
              2
            </div>
            <div className="mt-2">
              <h3 className="text-lg font-bold text-white mb-2">Generate Dataset</h3>
              <p className="text-slate-400 text-sm mb-4">
                Use task templates and auto-generation to create 100+ episodes.
                Add language instructions for RT-1/OpenVLA training.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">LeRobot Format</span>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Parquet</span>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">HF Upload</span>
              </div>
            </div>
          </div>
          {/* Step 3 */}
          <div className="relative bg-slate-800/50 border-2 border-slate-700 p-6 hover:border-green-500/50 transition">
            <div className="absolute -top-4 left-6 bg-green-500 text-white w-8 h-8 flex items-center justify-center font-black text-lg">
              3
            </div>
            <div className="mt-2">
              <h3 className="text-lg font-bold text-white mb-2">Train & Deploy</h3>
              <p className="text-slate-400 text-sm mb-4">
                Train ACT/Diffusion policies with LeRobot, load them back via ONNX Runtime Web,
                and run on sim or real hardware.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">ONNX Runtime</span>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">ACT Policy</span>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Sim2Real</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center mt-8">
          <button
            onClick={handleEnterApp}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 text-white px-8 py-3 font-bold hover:opacity-90 transition"
          >
            Start the Workflow
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Features Deep Dive with Tabs */}
      <section id="features" className="relative px-4 md:px-8 py-12 md:py-20 max-w-7xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-4xl font-black text-white mb-3 md:mb-4">Powerful Features</h2>
          <p className="text-base md:text-xl text-slate-400">Everything you need to build robot intelligence</p>
        </div>

        {/* Feature Tabs - Scrollable on mobile */}
        <div className="flex gap-2 mb-8 md:mb-12 overflow-x-auto pb-2 md:pb-0 md:flex-wrap md:justify-center scrollbar-hide">
          {FEATURE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFeatureTab(tab.id)}
              className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 font-bold transition border-2 whitespace-nowrap flex-shrink-0 text-sm md:text-base ${
                activeFeatureTab === tab.id
                  ? `bg-${tab.color}-500/20 border-${tab.color}-500 text-${tab.color}-400`
                  : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Active Feature Content - Benefits Only */}
        <div className="max-w-3xl mx-auto">
          <div className={`p-6 md:p-8 bg-slate-800/50 border-2 border-${activeFeature.color}-500/50`}>
            <div className={`inline-flex items-center gap-2 text-${activeFeature.color}-400 mb-4`}>
              {activeFeature.icon}
              <span className="font-bold uppercase tracking-wide">{activeFeature.label}</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">{activeFeature.title}</h3>
            <p className="text-base md:text-lg text-slate-400 mb-6">{activeFeature.description}</p>

            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-4">Benefits</h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {activeFeature.benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className={`w-5 h-5 text-${activeFeature.color}-400 flex-shrink-0 mt-0.5`} />
                  <span className="text-slate-300">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-700/50">
              <button
                onClick={handleEnterApp}
                className={`flex-1 flex items-center justify-center gap-2 py-3 bg-${activeFeature.color}-500 text-white font-bold hover:bg-${activeFeature.color}-400 transition`}
              >
                Try {activeFeature.label} Now
                <ChevronRight className="w-5 h-5" />
              </button>
              {onInstructions && (
                <button
                  onClick={onInstructions}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-slate-600 text-slate-300 font-bold hover:border-slate-500 hover:text-white transition"
                >
                  <Sparkles className="w-4 h-4" />
                  See How It Works
                </button>
              )}
            </div>
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

      {/* Footer - Mobile responsive */}
      <footer className="relative px-4 md:px-8 py-8 md:py-12 border-t-2 border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8 md:mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <Bot className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                <span className="text-lg md:text-xl font-bold text-white">ROBOSIM</span>
              </div>
              <p className="text-slate-500 text-sm">
                AI-native robotics simulation for education, research, and prototyping.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3 md:mb-4 text-sm md:text-base">Features</h4>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-slate-400">
                <li className="hover:text-white cursor-pointer">AI Chat Control</li>
                <li className="hover:text-white cursor-pointer">Voice Control</li>
                <li className="hover:text-white cursor-pointer">Vision-Language AI</li>
                <li className="hover:text-white cursor-pointer">Image to 3D (CSM)</li>
                <li className="hidden md:block hover:text-white cursor-pointer">Auto-Episode Generator</li>
                <li className="hidden md:block hover:text-white cursor-pointer">Guided Challenges</li>
                <li className="hidden md:block hover:text-white cursor-pointer">HuggingFace Upload</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3 md:mb-4 text-sm md:text-base">Resources</h4>
              <ul className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-slate-400">
                <li className="hover:text-white cursor-pointer">Documentation</li>
                <li className="hover:text-white cursor-pointer">API Reference</li>
                <li className="hover:text-white cursor-pointer">Tutorials</li>
                <li className="hover:text-white cursor-pointer">GitHub</li>
              </ul>
            </div>
            <div className="hidden md:block">
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
                  CSM.ai (Image to 3D)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  Web Serial API
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-6 md:pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-2 text-xs md:text-sm text-slate-600">
            <span>Built for learning robotics</span>
            <span>Open source on GitHub</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
