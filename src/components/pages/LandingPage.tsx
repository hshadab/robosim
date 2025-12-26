import { useState } from 'react';
import {
  Bot,
  Play,
  Zap,
  MessageSquare,
  Download,
  Check,
  ArrowRight,
  Globe,
  Sparkles,
  Camera,
  Shuffle,
  Activity,
  Settings,
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

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onLearnMore, onInstructions, onComparison }) => {
  const [hoveredRobot, setHoveredRobot] = useState<string | null>(null);

  const handleEnterApp = () => {
    onLogin();
  };

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
              className="hidden lg:inline text-slate-400 hover:text-white transition font-medium"
            >
              Comparison
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
              Advanced Features
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
              TRAIN ROBOTS WITH AI
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 md:mb-6 leading-tight tracking-tight">
              Train Your Robot
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400">
                In Minutes, Not Months
              </span>
            </h1>
            <p className="text-base md:text-xl text-slate-400 mb-6 md:mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
              Upload a photo. Teach by chatting. Export to real hardware. No coding required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 md:gap-4">
              <button
                onClick={handleEnterApp}
                className="group w-full sm:w-auto flex items-center justify-center gap-2 md:gap-3 bg-white text-black px-6 md:px-8 py-3 md:py-4 text-base md:text-lg font-bold transition hover:bg-blue-400 hover:text-white border-2 border-white hover:border-blue-400"
                style={{ boxShadow: '4px 4px 0 rgba(59, 130, 246, 0.4)' }}
              >
                <Play className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" />
                Get Started
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={onInstructions}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-slate-400 hover:text-white transition px-6 py-3 md:py-4 border-2 border-slate-700 hover:border-slate-500"
              >
                <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                Advanced Features
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

      {/* 3-Step Core Workflow - The Main Use Case */}
      <section className="relative px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">How It Works</h2>
          <p className="text-slate-400">From your photo to trained robot in three steps</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Step 1 - SNAP IT */}
          <div className="relative bg-slate-800/50 border-2 border-slate-700 p-6 hover:border-blue-500/50 transition group">
            <div className="absolute -top-4 left-6 bg-blue-500 text-white w-8 h-8 flex items-center justify-center font-black text-lg">
              1
            </div>
            <div className="mt-2">
              <div className="text-blue-400 mb-3">
                <Camera className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">SNAP IT</h3>
              <p className="text-slate-400 text-sm mb-4">
                Upload a photo of any object you want your robot to pick up.
                It becomes a 3D model in seconds.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30">Photo → 3D</span>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Or use 34 built-in objects</span>
              </div>
            </div>
          </div>
          {/* Step 2 - TEACH IT */}
          <div className="relative bg-slate-800/50 border-2 border-slate-700 p-6 hover:border-purple-500/50 transition group">
            <div className="absolute -top-4 left-6 bg-purple-500 text-white w-8 h-8 flex items-center justify-center font-black text-lg">
              2
            </div>
            <div className="mt-2">
              <div className="text-purple-400 mb-3">
                <MessageSquare className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">TEACH IT</h3>
              <p className="text-slate-400 text-sm mb-4">
                Just chat: "Pick up the apple". The robot learns from your commands.
                No coding, no joint angles, just natural language.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30">Chat commands</span>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Auto-generates 100+ demos</span>
              </div>
            </div>
          </div>
          {/* Step 3 - TRAIN & DEPLOY */}
          <div className="relative bg-slate-800/50 border-2 border-slate-700 p-6 hover:border-green-500/50 transition group">
            <div className="absolute -top-4 left-6 bg-green-500 text-white w-8 h-8 flex items-center justify-center font-black text-lg">
              3
            </div>
            <div className="mt-2">
              <div className="text-green-400 mb-3">
                <Download className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">TRAIN & DEPLOY</h3>
              <p className="text-slate-400 text-sm mb-4">
                One-click upload to HuggingFace, train on Google Colab (free GPU),
                deploy to real SO-101 hardware.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 border border-green-500/30">Free Colab Training</span>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">~2 hours to trained model</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center mt-10">
          <button
            onClick={handleEnterApp}
            className="group inline-flex items-center gap-3 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 text-white px-10 py-4 text-lg font-bold hover:opacity-90 transition"
            style={{ boxShadow: '4px 4px 0 rgba(147, 51, 234, 0.3)' }}
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-slate-500 text-sm mt-4">No account required. Works in your browser.</p>
        </div>
      </section>

      {/* Key Benefits - 3 only */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4 p-4 bg-slate-800/30 border border-slate-700/50">
            <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">No Coding Required</h3>
              <p className="text-slate-400 text-sm">Teach your robot by chatting. Say "pick up the red cube" and watch it learn.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-slate-800/30 border border-slate-700/50">
            <div className="w-12 h-12 bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Camera className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">Your Own Objects</h3>
              <p className="text-slate-400 text-sm">Upload a photo of any object. It becomes a 3D model ready for training.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-slate-800/30 border border-slate-700/50">
            <div className="w-12 h-12 bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1">Real Hardware Ready</h3>
              <p className="text-slate-400 text-sm">Export to HuggingFace & LeRobot. Deploy to real SO-101 robot arm.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sim-to-Real Transfer Features - NEW */}
      <section id="features" className="relative px-4 md:px-8 py-12 md:py-16 max-w-7xl mx-auto bg-gradient-to-b from-transparent to-slate-900/30">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 px-4 py-2 text-sm mb-4 border border-orange-500/30 font-mono">
            <Zap className="w-4 h-4" />
            SIM-TO-REAL TRANSFER
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Production-Ready Training Data</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Advanced features that make synthetic demos transfer to real robots
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Visual Randomization */}
          <div className="bg-slate-800/50 border-2 border-slate-700 p-6 hover:border-orange-500/50 transition">
            <div className="text-orange-400 mb-3">
              <Shuffle className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Visual Randomization</h3>
            <p className="text-slate-400 text-sm mb-4">
              Every episode gets unique lighting, textures, and distractor objects.
              Your model learns to ignore visual noise.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-300 border border-orange-500/30">Lighting Variation</span>
              <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Procedural Textures</span>
              <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Distractors</span>
            </div>
          </div>
          {/* Motion Quality */}
          <div className="bg-slate-800/50 border-2 border-slate-700 p-6 hover:border-purple-500/50 transition">
            <div className="text-purple-400 mb-3">
              <Activity className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Realistic Motion</h3>
            <p className="text-slate-400 text-sm mb-4">
              Smooth cubic interpolation, speed variation (0.9-1.1x), and approach angle diversity
              that match real robot motor characteristics.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30">Smooth Trajectories</span>
              <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Speed Variation</span>
              <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Position Diversity</span>
            </div>
          </div>
          {/* Calibration */}
          <div className="bg-slate-800/50 border-2 border-slate-700 p-6 hover:border-green-500/50 transition">
            <div className="text-green-400 mb-3">
              <Settings className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sim-to-Real Calibration</h3>
            <p className="text-slate-400 text-sm mb-4">
              Physics parameters, action mapping, and camera configs that match
              real SO-101 hardware exactly.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 border border-green-500/30">Physics ID</span>
              <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Action Calibration</span>
              <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300">Camera Match</span>
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
          Ready to Train
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            Your Robot?
          </span>
        </h2>
        <p className="text-xl text-slate-400 mb-10">
          Upload a photo. Teach by chatting. Deploy to real hardware.
        </p>
        <button
          onClick={handleEnterApp}
          className="group inline-flex items-center gap-3 bg-white text-black px-12 py-5 text-xl font-black transition-all duration-200 hover:bg-blue-400 hover:text-white border-4 border-white hover:border-blue-400 uppercase tracking-wide"
          style={{ boxShadow: '6px 6px 0 rgba(59, 130, 246, 0.5)' }}
        >
          <Play className="w-6 h-6" fill="currentColor" />
          Get Started Free
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
        <p className="text-slate-500 mt-6">
          No account required
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
