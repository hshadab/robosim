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
  Cpu,
  Globe,
  Sparkles,
  Target,
  Layers,
  GitBranch,
  Database,
  Upload,
  BarChart3,
  Users,
  Mic,
  Eye,
  Box,
  Code,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

interface LandingPageProps {
  onLogin: () => void;
  onLearnMore?: () => void;
  onHowToUse?: () => void;
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
type FeatureTab = 'chat' | 'policies' | 'control' | 'export' | 'voice' | 'vision' | 'copilot' | 'text3d';

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
      '20Hz real-time inference',
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
];

// Detailed workflow use cases with LeRobot/HuggingFace integration
type UseCaseTab = 'collect' | 'train' | 'deploy' | 'evaluate';

const USE_CASE_WORKFLOWS: Array<{
  id: UseCaseTab;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  steps: Array<{
    step: string;
    title: string;
    description: string;
    code?: string;
  }>;
  color: string;
}> = [
  {
    id: 'collect',
    icon: <Database className="w-6 h-6" />,
    title: 'Collect Training Data',
    subtitle: 'Record demonstrations for imitation learning',
    description: 'Use RoboSim to collect high-quality demonstration data. Control the robot manually and export datasets in LeRobot format for training.',
    steps: [
      {
        step: '1',
        title: 'Open Dataset Recorder',
        description: 'Click the "Dataset Recorder" panel in the right sidebar. Name your dataset and select recording options.',
      },
      {
        step: '2',
        title: 'Demonstrate the Task',
        description: 'Use keyboard (WASD), gamepad, or click-to-move IK to control the robot. Perform the task you want to teach.',
      },
      {
        step: '3',
        title: 'Record Multiple Episodes',
        description: 'Click "Start Recording", complete the task, then "Stop". Repeat 50-100 times for best results.',
      },
      {
        step: '4',
        title: 'Export to LeRobot Format',
        description: 'Click "Export" and choose "LeRobot v2.0". Downloads a ZIP with Parquet files ready for training.',
        code: 'dataset/\n├── meta/info.json\n├── data/episode_*.parquet\n└── videos/episode_*.mp4',
      },
      {
        step: '5',
        title: 'Upload to HuggingFace Hub',
        description: 'Use the HuggingFace CLI to upload your dataset for training or sharing with the community.',
        code: 'huggingface-cli upload your-username/so101-pick-place ./dataset',
      },
    ],
    color: 'blue',
  },
  {
    id: 'train',
    icon: <Brain className="w-6 h-6" />,
    title: 'Train with LeRobot',
    subtitle: 'Train ACT/Diffusion policies on your data',
    description: 'Take your collected dataset and train state-of-the-art imitation learning policies using the LeRobot framework.',
    steps: [
      {
        step: '1',
        title: 'Install LeRobot',
        description: 'Clone the LeRobot repository and install dependencies. Requires Python 3.10+ and a CUDA GPU.',
        code: 'git clone https://github.com/huggingface/lerobot\ncd lerobot && pip install -e .',
      },
      {
        step: '2',
        title: 'Configure Training',
        description: 'Create a training config for SO-101. Specify your dataset, policy type (ACT recommended), and hyperparameters.',
        code: 'python lerobot/scripts/train.py \\\n  --dataset.repo_id=your-username/so101-pick-place \\\n  --policy.name=act \\\n  --training.num_epochs=100',
      },
      {
        step: '3',
        title: 'Monitor Training',
        description: 'Use Weights & Biases or TensorBoard to track loss curves. Training typically takes 2-8 hours on a GPU.',
      },
      {
        step: '4',
        title: 'Export to ONNX',
        description: 'Convert your trained checkpoint to ONNX format for browser inference in RoboSim.',
        code: 'python scripts/export_onnx.py \\\n  --checkpoint=outputs/act_so101/checkpoint_100.pt \\\n  --output=policy.onnx',
      },
      {
        step: '5',
        title: 'Upload to HuggingFace',
        description: 'Push your trained policy to HuggingFace Hub. Include the ONNX file for browser deployment.',
        code: 'huggingface-cli upload your-username/act-so101-pick-place ./outputs',
      },
    ],
    color: 'purple',
  },
  {
    id: 'deploy',
    icon: <Upload className="w-6 h-6" />,
    title: 'Deploy & Run Policies',
    subtitle: 'Load trained policies in browser or hardware',
    description: 'Run your trained policies in RoboSim for evaluation, or deploy directly to real SO-101 hardware.',
    steps: [
      {
        step: '1',
        title: 'Load in RoboSim',
        description: 'Open the "LeRobot Policies" panel. Search for your model ID or paste the HuggingFace URL.',
      },
      {
        step: '2',
        title: 'Download ONNX Model',
        description: 'Click "Download" on your policy. RoboSim fetches the ONNX file and loads it into the browser.',
      },
      {
        step: '3',
        title: 'Run Inference',
        description: 'Click "Run" to start the policy. Watch the robot execute learned behaviors autonomously at 20Hz.',
      },
      {
        step: '4',
        title: 'Deploy to Real Hardware',
        description: 'For real robot deployment, use LeRobot\'s inference script with your checkpoint.',
        code: 'python lerobot/scripts/control_robot.py \\\n  --robot.type=so101 \\\n  --policy.path=your-username/act-so101-pick-place',
      },
      {
        step: '5',
        title: 'Live Serial Connection',
        description: 'Or use RoboSim\'s Web Serial to mirror simulation to hardware in real-time (Chrome/Edge).',
      },
    ],
    color: 'green',
  },
  {
    id: 'evaluate',
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Evaluate & Iterate',
    subtitle: 'Measure success rates and improve',
    description: 'Use RoboSim to evaluate policy performance, identify failure cases, and collect more targeted data.',
    steps: [
      {
        step: '1',
        title: 'Run Evaluation Episodes',
        description: 'Load your policy and run it on test scenarios. RoboSim tracks success/failure for each episode.',
      },
      {
        step: '2',
        title: 'Review Trajectories',
        description: 'Use the Joint Trajectory Graph to visualize policy outputs. Identify jerky or unstable behaviors.',
      },
      {
        step: '3',
        title: 'Identify Failure Modes',
        description: 'Note when the policy fails. Common issues: overshoot, collision, missed grasp. These guide data collection.',
      },
      {
        step: '4',
        title: 'Collect Targeted Data',
        description: 'Record demonstrations for the specific failure cases. Add 10-20 episodes focusing on the weak areas.',
      },
      {
        step: '5',
        title: 'Retrain & Compare',
        description: 'Fine-tune your policy on the expanded dataset. Compare success rates before/after in RoboSim.',
        code: 'python lerobot/scripts/train.py \\\n  --resume=outputs/act_so101/checkpoint_100.pt \\\n  --dataset.repo_id=your-username/so101-pick-place-v2',
      },
    ],
    color: 'orange',
  },
];

// Steps for how it works
const HOW_IT_WORKS_STEPS = [
  {
    number: '01',
    title: 'Choose Your Robot',
    description: 'Start with the SO-101 robot arm. More robots coming soon.',
    icon: <Target className="w-6 h-6" />,
  },
  {
    number: '02',
    title: 'Control It Your Way',
    description: 'Use chat, sliders, keyboard, gamepad, or trained AI policies.',
    icon: <Gamepad2 className="w-6 h-6" />,
  },
  {
    number: '03',
    title: 'Record & Train',
    description: 'Capture demonstrations and export to LeRobot for training.',
    icon: <Layers className="w-6 h-6" />,
  },
  {
    number: '04',
    title: 'Deploy to Hardware',
    description: 'Export code or connect directly to your real robot.',
    icon: <Cpu className="w-6 h-6" />,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLearnMore, onHowToUse }) => {
  const [hoveredRobot, setHoveredRobot] = useState<string | null>(null);
  const [activeFeatureTab, setActiveFeatureTab] = useState<FeatureTab>('chat');
  const [activeUseCaseTab, setActiveUseCaseTab] = useState<UseCaseTab>('collect');
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
          <a href="#how-it-works" className="text-slate-400 hover:text-white transition font-medium">
            How It Works
          </a>
          {onLearnMore && (
            <button
              onClick={() => {
                window.location.hash = '';
                onLearnMore();
              }}
              className="text-slate-400 hover:text-white transition font-medium"
            >
              Learn More
            </button>
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
                onClick={onHowToUse}
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
            { icon: <Brain className="w-6 h-6" />, label: 'AI Policies', desc: 'HuggingFace Hub', color: 'purple' },
            { icon: <Cpu className="w-6 h-6" />, label: 'Browser ML', desc: 'ONNX Runtime', color: 'green' },
            { icon: <Users className="w-6 h-6" />, label: 'Multi-Robot', desc: 'Swarm simulation', color: 'slate' },
            { icon: <Sparkles className="w-6 h-6" />, label: 'AI Environments', desc: 'Gemini textures', color: 'violet' },
            { icon: <GitBranch className="w-6 h-6" />, label: 'Open Source', desc: 'LeRobot ready', color: 'orange' },
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

      {/* How It Works */}
      <section id="how-it-works" className="relative px-8 py-20 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">How It Works</h2>
            <p className="text-xl text-slate-400">From simulation to real robot in 4 steps</p>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <div key={step.number} className="relative">
                {/* Connector line */}
                {i < HOW_IT_WORKS_STEPS.length - 1 && (
                  <div className="absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-blue-500 to-transparent z-0" />
                )}
                <div className="relative z-10 p-6 bg-[#0a0f1a] border-2 border-slate-700 hover:border-blue-500/50 transition">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-4xl font-black text-blue-500/30">{step.number}</span>
                    <div className="p-2 bg-blue-500/20 text-blue-400">{step.icon}</div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases - LeRobot/HuggingFace Workflows */}
      <section id="use-cases" className="relative px-8 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-white mb-4">LeRobot Workflows</h2>
          <p className="text-xl text-slate-400">End-to-end robot learning with HuggingFace integration</p>
        </div>

        {/* Workflow Tabs */}
        <div className="flex justify-center gap-2 mb-12">
          {USE_CASE_WORKFLOWS.map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => setActiveUseCaseTab(workflow.id)}
              className={`flex items-center gap-2 px-6 py-3 font-bold transition border-2 ${
                activeUseCaseTab === workflow.id
                  ? `bg-${workflow.color}-500/20 border-${workflow.color}-500 text-${workflow.color}-400`
                  : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
              }`}
            >
              {workflow.icon}
              <span className="hidden sm:inline">{workflow.title}</span>
            </button>
          ))}
        </div>

        {/* Active Workflow Content */}
        {(() => {
          const activeWorkflow = USE_CASE_WORKFLOWS.find(w => w.id === activeUseCaseTab)!;
          return (
            <div className={`border-2 border-${activeWorkflow.color}-500/30 bg-slate-800/20`}>
              {/* Header */}
              <div className={`p-6 border-b border-${activeWorkflow.color}-500/30 bg-${activeWorkflow.color}-500/10`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 bg-${activeWorkflow.color}-500/20 text-${activeWorkflow.color}-400`}>
                    {activeWorkflow.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{activeWorkflow.title}</h3>
                    <p className={`text-${activeWorkflow.color}-400 font-medium`}>{activeWorkflow.subtitle}</p>
                  </div>
                </div>
                <p className="text-slate-400 mt-4">{activeWorkflow.description}</p>
              </div>

              {/* Steps */}
              <div className="p-6">
                <div className="space-y-6">
                  {activeWorkflow.steps.map((step, index) => (
                    <div key={index} className="flex gap-6">
                      {/* Step Number */}
                      <div className={`w-10 h-10 flex items-center justify-center bg-${activeWorkflow.color}-500/20 border-2 border-${activeWorkflow.color}-500/50 text-${activeWorkflow.color}-400 font-bold flex-shrink-0`}>
                        {step.step}
                      </div>

                      {/* Step Content */}
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-white mb-2">{step.title}</h4>
                        <p className="text-slate-400 mb-3">{step.description}</p>

                        {/* Code Block if present */}
                        {step.code && (
                          <div className="bg-[#0a0f1a] border border-slate-700 p-4 font-mono text-sm text-green-400 overflow-x-auto">
                            <pre>{step.code}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-8 pt-6 border-t border-slate-700 flex items-center justify-between">
                  <p className="text-slate-400">
                    {activeUseCaseTab === 'collect' && 'Start recording demonstrations in RoboSim now'}
                    {activeUseCaseTab === 'train' && 'Use your RoboSim datasets with LeRobot'}
                    {activeUseCaseTab === 'deploy' && 'Run policies in browser or on hardware'}
                    {activeUseCaseTab === 'evaluate' && 'Test and improve your robot policies'}
                  </p>
                  <button
                    onClick={handleEnterApp}
                    className={`flex items-center gap-2 px-6 py-3 bg-${activeWorkflow.color}-500/20 border-2 border-${activeWorkflow.color}-500/50 text-${activeWorkflow.color}-400 font-bold hover:bg-${activeWorkflow.color}-500/30 transition`}
                  >
                    Try It Now
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
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
                <li className="hover:text-white cursor-pointer">Code Copilot</li>
                <li className="hover:text-white cursor-pointer">Text to 3D</li>
                <li className="hover:text-white cursor-pointer">Policy Loading</li>
                <li className="hover:text-white cursor-pointer">Hardware Export</li>
                <li className="hover:text-white cursor-pointer">Multi-Robot Swarms</li>
                <li className="hover:text-white cursor-pointer">AI Environments</li>
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
