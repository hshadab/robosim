import React from 'react';
import {
  Bot,
  ArrowLeft,
  Zap,
  Globe,
  MessageSquare,
  Database,
  Cpu,
  Play,
  Check,
  X,
  Minus,
  Download,
  DollarSign,
  Clock,
  Wrench,
  Monitor,
  Cloud,
  Users,
  GraduationCap,
  FlaskConical,
  BookOpen,
  Shuffle,
  Activity,
  Settings,
} from 'lucide-react';

interface ComparisonPageProps {
  onBack: () => void;
  onGetStarted: () => void;
}

interface ComparisonRow {
  aspect: string;
  robosim: {
    text: string;
    highlight?: boolean;
  };
  gazebo: string;
  webots: string;
  isaac: string;
}

const comparisonData: ComparisonRow[] = [
  {
    aspect: 'Install & Platform',
    robosim: {
      text: 'Runs in the browser (React, Three.js, Rapier). Only Node.js needed for local dev.',
      highlight: true,
    },
    gazebo: 'Native desktop install; commonly used with ROS/ROS 2 on Linux (Ubuntu).',
    webots: 'Desktop application; full IDE-like environment for robot modeling and simulation.',
    isaac: 'Heavyweight desktop app built on Omniverse; typically needs a discrete GPU.',
  },
  {
    aspect: 'Primary Focus',
    robosim: {
      text: 'Robot learning + data for SO-101 and similar arms: LeRobot datasets, HuggingFace integration.',
      highlight: true,
    },
    gazebo: 'General-purpose multi-robot simulation, ROS testing, CI, multi-vehicle scenarios.',
    webots: 'General-purpose robotics (wheeled, humanoid, etc.), education, research, ROS integration.',
    isaac: 'Industrial-grade physics and synthetic data pipelines for perception & autonomy.',
  },
  {
    aspect: 'Interface Paradigm',
    robosim: {
      text: 'Prompt-first: chat, voice, and JS editor controlling a semantic robot API.',
      highlight: true,
    },
    gazebo: 'GUI + config files + plugins + ROS topics/services.',
    webots: 'GUI-centric IDE with scene tree, controller code, and optional WebGL streaming.',
    isaac: 'Omniverse-based UI, Python scripting, Replicator tools, ROS bridges.',
  },
  {
    aspect: 'LeRobot / HF Integration',
    robosim: {
      text: 'Native: exports true Parquet LeRobot datasets, uploads to HF, loads LeRobot policies via ONNX Runtime Web.',
      highlight: true,
    },
    gazebo: 'None out-of-the-box (can be integrated via custom scripts).',
    webots: 'None out-of-the-box (can be integrated via custom scripts).',
    isaac: 'Can generate synthetic data used with HF, but no direct LeRobot dataset tooling built-in.',
  },
  {
    aspect: 'Hardware Focus',
    robosim: {
      text: 'Optimized for SO-101 arm: URDF-based model, real servo specs, Web Serial hardware sync, LeRobot Python export.',
      highlight: true,
    },
    gazebo: 'Broad robot support via URDF/SDF, mostly ROS-driven; not tied to a specific low-cost arm.',
    webots: 'Large library of robots and sensors; not specifically targeted at SO-101 / LeRobot.',
    isaac: 'Broad industrial and research platforms (manipulators, mobile robots, humanoids).',
  },
  {
    aspect: 'AI / LLM Features',
    robosim: {
      text: 'Built-in: AI chat assistant, voice control, vision-language scene analysis, AI code copilot, text-to-3D and image-to-3D.',
      highlight: true,
    },
    gazebo: 'No native LLM integration (possible via external tools / ROS nodes).',
    webots: 'No native LLM integration; focus on classic control + ROS.',
    isaac: 'Deep synthetic-data and perception tooling; LLMs used externally rather than as the main interface.',
  },
  {
    aspect: 'Best Suited For',
    robosim: {
      text: 'People who want a browser-first LeRobot playground for SO-101: generate datasets, train policies, and go sim-to-real fast.',
      highlight: true,
    },
    gazebo: 'ROS/ROS 2 users who need high-fidelity, scripted simulations and CI for many robots.',
    webots: 'Education and research labs that need a rich desktop simulator with many robot models.',
    isaac: 'Teams building large-scale synthetic data pipelines and high-fidelity industrial simulations.',
  },
];

interface FeatureComparisonItem {
  feature: string;
  robosim: boolean | 'partial';
  gazebo: boolean | 'partial';
  webots: boolean | 'partial';
  isaac: boolean | 'partial';
}

const featureChecklist: FeatureComparisonItem[] = [
  { feature: 'Browser-based (no install)', robosim: true, gazebo: false, webots: false, isaac: false },
  { feature: 'LeRobot dataset export', robosim: true, gazebo: false, webots: false, isaac: 'partial' },
  { feature: 'HuggingFace Hub upload', robosim: true, gazebo: false, webots: false, isaac: false },
  { feature: 'Natural language control', robosim: true, gazebo: false, webots: false, isaac: false },
  { feature: 'Voice commands', robosim: true, gazebo: false, webots: false, isaac: false },
  { feature: 'Vision-language AI', robosim: true, gazebo: false, webots: false, isaac: 'partial' },
  { feature: 'Text/Image to 3D', robosim: true, gazebo: false, webots: false, isaac: 'partial' },
  { feature: 'Language-conditioned training', robosim: true, gazebo: false, webots: false, isaac: false },
  { feature: 'Web Serial hardware sync', robosim: true, gazebo: false, webots: false, isaac: false },
  { feature: 'ROS/ROS 2 integration', robosim: false, gazebo: true, webots: true, isaac: true },
  { feature: 'Multi-robot simulation', robosim: 'partial', gazebo: true, webots: true, isaac: true },
  { feature: 'High-fidelity physics', robosim: 'partial', gazebo: true, webots: true, isaac: true },
  { feature: 'Synthetic data at scale', robosim: 'partial', gazebo: 'partial', webots: 'partial', isaac: true },
];

const FeatureIcon: React.FC<{ value: boolean | 'partial' }> = ({ value }) => {
  if (value === true) {
    return <Check className="w-5 h-5 text-green-400" />;
  }
  if (value === 'partial') {
    return <Minus className="w-5 h-5 text-yellow-400" />;
  }
  return <X className="w-5 h-5 text-slate-600" />;
};

export const ComparisonPage: React.FC<ComparisonPageProps> = ({ onBack, onGetStarted }) => {
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
          <span className="hidden sm:inline">TRY ROBOSIM FREE</span>
          <span className="sm:hidden">START</span>
        </button>
      </nav>

      {/* Hero */}
      <section className="relative px-4 md:px-8 pt-6 md:pt-8 pb-8 md:pb-12 max-w-7xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-transparent text-orange-400 px-3 md:px-4 py-2 text-xs md:text-sm mb-4 md:mb-6 border-2 border-orange-500 font-mono">
          <Zap className="w-3 h-3 md:w-4 md:h-4" />
          SIMULATOR COMPARISON
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 md:mb-6 leading-tight">
          Why <span className="text-orange-400">RoboSim</span>?
        </h1>
        <p className="text-base md:text-xl text-slate-400 max-w-3xl">
          See how RoboSim compares to other popular robot simulators.
          Choose the right tool for your robotics learning and development needs.
        </p>
      </section>

      {/* The Problem vs Solution */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">
          {/* The Problem */}
          <div className="bg-red-500/5 border border-red-500/30 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500 flex items-center justify-center rounded">
                <X className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">The Problem</h3>
                <p className="text-red-400 text-sm">Traditional robot training is painful</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: DollarSign, label: 'Hardware', value: '$500-2000' },
                { icon: Clock, label: 'Setup', value: 'Hours/days' },
                { icon: Wrench, label: 'Data', value: '50-200 demos' },
                { icon: Cpu, label: 'Training', value: '$100s/mo GPU' },
              ].map((item, i) => (
                <div key={i} className="p-3 bg-red-500/10 border border-red-500/20 rounded">
                  <item.icon className="w-4 h-4 text-red-400 mb-1" />
                  <p className="text-white text-sm font-medium">{item.label}</p>
                  <p className="text-red-300 text-xs">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          {/* The Solution */}
          <div className="bg-green-500/5 border border-green-500/30 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500 flex items-center justify-center rounded">
                <Check className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">RoboSim Solution</h3>
                <p className="text-green-400 text-sm">Zero cost, zero friction</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Monitor, label: 'Setup', value: 'Open browser' },
                { icon: Cloud, label: 'Hardware', value: 'None needed' },
                { icon: Zap, label: 'Data', value: '1-click demos' },
                { icon: Cpu, label: 'Training', value: 'Free Colab' },
              ].map((item, i) => (
                <div key={i} className="p-3 bg-green-500/10 border border-green-500/20 rounded">
                  <item.icon className="w-4 h-4 text-green-400 mb-1" />
                  <p className="text-white text-sm font-medium">{item.label}</p>
                  <p className="text-green-300 text-xs">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Time to Success */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { time: '< 1 min', action: 'Generate 10 demos' },
            { time: '< 1 min', action: 'Upload to HuggingFace' },
            { time: '~2 hours', action: 'Train on Colab' },
            { time: 'Same day', action: 'Deploy to SO-101' },
          ].map((step, i) => (
            <div key={i} className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-center">
              <p className="text-xl font-black text-blue-400">{step.time}</p>
              <p className="text-slate-400 text-xs mt-1">{step.action}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Key Differentiators */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Globe className="w-6 h-6 text-blue-400" />
          Key Differentiators
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border-l-4 border-blue-500 p-4">
            <Globe className="w-6 h-6 text-blue-400 mb-2" />
            <h3 className="text-white font-bold mb-1">Browser-First</h3>
            <p className="text-slate-400 text-sm">No install, no GPU required. Works on any device with a browser.</p>
          </div>
          <div className="bg-slate-800/50 border-l-4 border-purple-500 p-4">
            <Database className="w-6 h-6 text-purple-400 mb-2" />
            <h3 className="text-white font-bold mb-1">LeRobot Native</h3>
            <p className="text-slate-400 text-sm">Direct Parquet export, HuggingFace upload, ONNX policy execution.</p>
          </div>
          <div className="bg-slate-800/50 border-l-4 border-green-500 p-4">
            <MessageSquare className="w-6 h-6 text-green-400 mb-2" />
            <h3 className="text-white font-bold mb-1">Prompt-First</h3>
            <p className="text-slate-400 text-sm">Chat, voice, and AI copilot as primary interfaces - not afterthoughts.</p>
          </div>
          <div className="bg-slate-800/50 border-l-4 border-orange-500 p-4">
            <Cpu className="w-6 h-6 text-orange-400 mb-2" />
            <h3 className="text-white font-bold mb-1">SO-101 Optimized</h3>
            <p className="text-slate-400 text-sm">Built specifically for the LeRobot ecosystem and affordable arms.</p>
          </div>
        </div>
      </section>

      {/* Feature Checklist */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Check className="w-6 h-6 text-green-400" />
          Feature Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Feature</th>
                <th className="text-center py-3 px-4 text-blue-400 font-bold">RoboSim</th>
                <th className="text-center py-3 px-4 text-slate-400 font-medium">Gazebo</th>
                <th className="text-center py-3 px-4 text-slate-400 font-medium">Webots</th>
                <th className="text-center py-3 px-4 text-slate-400 font-medium">Isaac Sim</th>
              </tr>
            </thead>
            <tbody>
              {featureChecklist.map((item, idx) => (
                <tr
                  key={item.feature}
                  className={`border-b border-slate-800 ${idx % 2 === 0 ? 'bg-slate-900/30' : ''}`}
                >
                  <td className="py-3 px-4 text-white text-sm">{item.feature}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <FeatureIcon value={item.robosim} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <FeatureIcon value={item.gazebo} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <FeatureIcon value={item.webots} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      <FeatureIcon value={item.isaac} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Check className="w-4 h-4 text-green-400" /> Full support
          </span>
          <span className="flex items-center gap-1">
            <Minus className="w-4 h-4 text-yellow-400" /> Partial / Limited
          </span>
          <span className="flex items-center gap-1">
            <X className="w-4 h-4 text-slate-600" /> Not available
          </span>
        </div>
      </section>

      {/* Detailed Comparison Table */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Download className="w-6 h-6 text-purple-400" />
          Detailed Comparison
        </h2>
        <div className="space-y-4">
          {comparisonData.map((row) => (
            <div key={row.aspect} className="bg-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden">
              <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700/50">
                <h3 className="text-white font-bold">{row.aspect}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-700/50">
                <div className={`p-4 ${row.robosim.highlight ? 'bg-blue-500/10' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-blue-400 font-bold text-sm">RoboSim</span>
                  </div>
                  <p className={`text-sm ${row.robosim.highlight ? 'text-white' : 'text-slate-400'}`}>
                    {row.robosim.text}
                  </p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-slate-500 rounded-full" />
                    <span className="text-slate-400 font-bold text-sm">Gazebo</span>
                  </div>
                  <p className="text-sm text-slate-500">{row.gazebo}</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-slate-500 rounded-full" />
                    <span className="text-slate-400 font-bold text-sm">Webots</span>
                  </div>
                  <p className="text-sm text-slate-500">{row.webots}</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-slate-500 rounded-full" />
                    <span className="text-slate-400 font-bold text-sm">Isaac Sim</span>
                  </div>
                  <p className="text-sm text-slate-500">{row.isaac}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* When to use what */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6">When to Use Each Simulator</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-500/10 border-2 border-blue-500/50 p-6 rounded-lg">
            <h3 className="text-blue-400 font-bold text-lg mb-3">Choose RoboSim if you want to...</h3>
            <ul className="space-y-2 text-slate-300 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                Start training robots in minutes without any installation
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                Generate LeRobot-compatible datasets for imitation learning
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                Control robots with natural language (chat, voice)
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                Work with SO-101 or similar affordable robot arms
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                Train language-conditioned policies (RT-1, OpenVLA style)
              </li>
            </ul>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-lg">
            <h3 className="text-slate-300 font-bold text-lg mb-3">Choose other simulators if you need...</h3>
            <ul className="space-y-2 text-slate-400 text-sm">
              <li className="flex items-start gap-2">
                <Minus className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <span><strong>Gazebo:</strong> Full ROS/ROS 2 integration, multi-robot scenarios, CI pipelines</span>
              </li>
              <li className="flex items-start gap-2">
                <Minus className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <span><strong>Webots:</strong> Rich desktop IDE, large robot library, education focus</span>
              </li>
              <li className="flex items-start gap-2">
                <Minus className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <span><strong>Isaac Sim:</strong> Industrial-grade physics, massive synthetic data, GPU rendering</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Sim-to-Real Transfer */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Shuffle className="w-6 h-6 text-orange-400" />
          Sim-to-Real Transfer
        </h2>
        <p className="text-slate-400 mb-6">
          RoboSim generates training data that actually transfers to real robots with domain randomization and calibration.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-5 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <Shuffle className="w-8 h-8 text-orange-400 mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Visual Randomization</h3>
            <ul className="text-slate-400 text-sm space-y-1">
              <li>• Lighting intensity & color</li>
              <li>• Procedural floor textures</li>
              <li>• Random distractor objects</li>
              <li>• Camera position jitter</li>
            </ul>
          </div>
          <div className="p-5 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <Activity className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Motion Quality</h3>
            <ul className="text-slate-400 text-sm space-y-1">
              <li>• Minimum-jerk trajectories</li>
              <li>• Approach angle variation</li>
              <li>• Speed factor (0.7-1.3x)</li>
              <li>• Recovery behaviors (40%)</li>
            </ul>
          </div>
          <div className="p-5 bg-green-500/10 border border-green-500/30 rounded-lg">
            <Settings className="w-8 h-8 text-green-400 mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">Calibration</h3>
            <ul className="text-slate-400 text-sm space-y-1">
              <li>• Per-joint physics params</li>
              <li>• Sim-to-real action mapping</li>
              <li>• PWM servo calibration</li>
              <li>• Camera config matching</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Users className="w-6 h-6 text-orange-400" />
          Who It's For
        </h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { icon: GraduationCap, user: 'Students', pain: "Can't afford robot + GPU", solution: 'Free sim + Colab' },
            { icon: Wrench, user: 'Hobbyists', pain: 'ROS is too complex', solution: 'Browser, no code' },
            { icon: FlaskConical, user: 'Researchers', pain: 'Data collection takes weeks', solution: 'Synthetic batch demos' },
            { icon: BookOpen, user: 'Educators', pain: 'Lab setup is expensive', solution: 'Any browser works' },
          ].map((item, i) => (
            <div key={i} className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-orange-500/50 transition">
              <item.icon className="w-6 h-6 text-orange-400 mb-2" />
              <h3 className="text-white font-bold mb-1">{item.user}</h3>
              <p className="text-red-400 text-xs mb-1">Pain: {item.pain}</p>
              <p className="text-green-400 text-xs">Solution: {item.solution}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-4 md:px-8 py-16 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-black text-white mb-4">Ready to Try the Browser-First Approach?</h2>
        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
          No installation, no GPU, no setup. Start generating LeRobot datasets and training robot policies in seconds.
        </p>
        <button
          onClick={onGetStarted}
          className="group inline-flex items-center gap-3 bg-blue-500 text-white px-10 py-4 text-xl font-bold transition hover:bg-blue-400 border-2 border-blue-500"
          style={{ boxShadow: '4px 4px 0 rgba(59, 130, 246, 0.3)' }}
        >
          <Play className="w-5 h-5" fill="currentColor" />
          Launch RoboSim Free
        </button>
        <p className="text-slate-500 mt-4 text-sm">
          Free forever for personal use • No credit card required
        </p>
      </section>

      {/* Footer */}
      <footer className="relative px-8 py-10 border-t-2 border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-500">
            <Bot className="w-6 h-6" />
            <span className="text-lg font-bold tracking-tight">ROBOSIM</span>
          </div>
          <p className="text-slate-600 font-medium">
            Built for the LeRobot community
          </p>
        </div>
      </footer>
    </div>
  );
};
