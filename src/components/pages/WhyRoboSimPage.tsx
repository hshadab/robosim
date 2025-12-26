import React from 'react';
import {
  Bot, ArrowLeft, Check, X, Clock, DollarSign, Zap,
  Monitor, Cloud, Cpu, Target, Users, GraduationCap,
  Wrench, FlaskConical, BookOpen
} from 'lucide-react';

interface WhyRoboSimPageProps {
  onBack: () => void;
  onGetStarted: () => void;
}

export const WhyRoboSimPage: React.FC<WhyRoboSimPageProps> = ({ onBack, onGetStarted }) => {
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
      <section className="relative px-8 pt-8 pb-12 max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
          Why <span className="text-blue-400">RoboSim</span>?
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          The fastest path from zero to trained robot policy.
          No hardware, no setup, no cost.
        </p>
      </section>

      {/* The Problem */}
      <section className="relative px-8 py-12 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-red-500 flex items-center justify-center">
            <X className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">THE PROBLEM</h2>
            <p className="text-red-400">Training robots today is painful</p>
          </div>
        </div>

        <p className="text-slate-300 text-lg mb-8">
          Training a robot policy traditionally requires expensive hardware, complex software setup,
          hours of manual data collection, and GPU servers. The barrier is too high.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: DollarSign, label: 'Hardware', value: '$500-2000 robot arm', color: 'red' },
            { icon: Clock, label: 'Setup', value: 'Hours/days for ROS + Gazebo', color: 'red' },
            { icon: Wrench, label: 'Data Collection', value: '50-200 manual demos', color: 'red' },
            { icon: Cpu, label: 'Training', value: '$100s/month GPU server', color: 'red' },
          ].map((item, i) => (
            <div key={i} className="p-4 bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-red-400" />
                <span className="text-white font-medium">{item.label}</span>
              </div>
              <p className="text-red-300 text-sm mt-2">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 text-center">
          <p className="text-red-300 text-lg font-bold">
            Total barrier: $1000+ and weeks of work
          </p>
        </div>
      </section>

      {/* The Solution */}
      <section className="relative px-8 py-12 max-w-4xl mx-auto border-t border-slate-800">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-green-500 flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">THE SOLUTION</h2>
            <p className="text-green-400">RoboSim changes everything</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: Monitor, label: 'Setup', value: 'Open your browser', color: 'green' },
            { icon: Cloud, label: 'Hardware', value: 'None needed (simulation)', color: 'green' },
            { icon: Zap, label: 'Data Collection', value: '"Generate 10 Demos" button', color: 'green' },
            { icon: Cpu, label: 'Training', value: 'Free on Google Colab', color: 'green' },
          ].map((item, i) => (
            <div key={i} className="p-4 bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-green-400" />
                <span className="text-white font-medium">{item.label}</span>
              </div>
              <p className="text-green-300 text-sm mt-2">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 text-center">
          <p className="text-green-300 text-lg font-bold">
            Time to first policy: ~2 hours. Cost: Free.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="relative px-8 py-12 max-w-4xl mx-auto border-t border-slate-800">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-500 flex items-center justify-center">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">VS. OTHER PLATFORMS</h2>
            <p className="text-blue-400">How RoboSim compares</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Platform</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">What It Is</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Barrier</th>
                <th className="text-left py-3 px-4 text-green-400 font-medium">RoboSim Advantage</th>
              </tr>
            </thead>
            <tbody>
              {[
                { platform: 'ROS/Gazebo', what: 'Industry standard', barrier: 'Complex install', advantage: 'Zero setup, browser-based' },
                { platform: 'Isaac Sim', what: 'NVIDIA photorealistic', barrier: 'RTX GPU required', advantage: 'Works on any device' },
                { platform: 'MuJoCo', what: 'Physics engine', barrier: 'Python, no GUI', advantage: 'Visual UI, no code' },
                { platform: 'PyBullet', what: 'Python physics', barrier: 'Coding required', advantage: 'Natural language' },
                { platform: 'Webots', what: 'Educational sim', barrier: 'Desktop install', advantage: 'Browser, mobile-friendly' },
                { platform: 'LeRobot', what: 'HF training framework', barrier: 'Real robot for demos', advantage: 'Synthetic demos' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-slate-800">
                  <td className="py-3 px-4 text-white font-medium">{row.platform}</td>
                  <td className="py-3 px-4 text-slate-400">{row.what}</td>
                  <td className="py-3 px-4 text-red-400">{row.barrier}</td>
                  <td className="py-3 px-4 text-green-400">{row.advantage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Unique Features */}
      <section className="relative px-8 py-12 max-w-4xl mx-auto border-t border-slate-800">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-purple-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">UNIQUE FEATURES</h2>
            <p className="text-purple-400">What makes RoboSim different</p>
          </div>
        </div>

        <div className="grid gap-4">
          {[
            {
              title: 'Zero-to-trained-policy in browser',
              description: 'No install, no hardware, no GPU. Works on Chromebook, tablet, any device with a browser.',
              color: 'blue',
            },
            {
              title: 'One-click demo generation',
              description: '"Generate 10 Demos" runs 10 pickups at varied positions automatically. Real positional variety, not just noise.',
              color: 'purple',
            },
            {
              title: 'Honest physics for sim-to-real',
              description: '1.5cm grasp threshold - gripper must actually reach the cube. Position-interpolated arm reach. Data that transfers.',
              color: 'green',
            },
            {
              title: 'End-to-end pipeline',
              description: 'Generate demos → Upload to HuggingFace → Train on Colab → Deploy to SO-101. One tool, one workflow.',
              color: 'orange',
            },
            {
              title: 'SO-101 optimized',
              description: 'URDF-accurate simulation. LeRobot format export. Direct path from simulation to real hardware.',
              color: 'blue',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className={`p-5 bg-${feature.color}-500/10 border border-${feature.color}-500/30 hover:border-${feature.color}-400/50 transition`}
            >
              <h3 className={`text-lg font-bold text-white mb-2`}>{feature.title}</h3>
              <p className="text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Target Users */}
      <section className="relative px-8 py-12 max-w-4xl mx-auto border-t border-slate-800">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-orange-500 flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">WHO IT'S FOR</h2>
            <p className="text-orange-400">Perfect for these users</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: GraduationCap, user: 'Students', pain: "Can't afford robot + GPU", solution: 'Free simulation + Colab' },
            { icon: Wrench, user: 'Hobbyists', pain: 'ROS is too complex', solution: 'Browser-based, no code' },
            { icon: FlaskConical, user: 'Researchers', pain: 'Data collection takes weeks', solution: 'Synthetic batch demos' },
            { icon: BookOpen, user: 'Educators', pain: 'Lab setup is expensive', solution: 'Run in any browser' },
          ].map((item, i) => (
            <div key={i} className="p-5 bg-slate-800/50 border border-slate-700 hover:border-orange-500/50 transition">
              <div className="flex items-center gap-3 mb-3">
                <item.icon className="w-6 h-6 text-orange-400" />
                <h3 className="text-lg font-bold text-white">{item.user}</h3>
              </div>
              <p className="text-red-400 text-sm mb-2">Pain: {item.pain}</p>
              <p className="text-green-400 text-sm">Solution: {item.solution}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Success Metrics */}
      <section className="relative px-8 py-12 max-w-4xl mx-auto border-t border-slate-800">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-green-500 flex items-center justify-center">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">TIME TO SUCCESS</h2>
            <p className="text-green-400">What you can achieve</p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {[
            { time: '< 1 min', action: 'Generate 10 demos' },
            { time: '< 1 min', action: 'Upload to HuggingFace' },
            { time: '~2 hours', action: 'Train on Colab' },
            { time: 'Same day', action: 'Deploy to SO-101' },
          ].map((step, i) => (
            <div key={i} className="p-4 bg-green-500/10 border border-green-500/30 text-center">
              <p className="text-2xl font-black text-green-400">{step.time}</p>
              <p className="text-slate-400 text-sm mt-1">{step.action}</p>
            </div>
          ))}
        </div>

        <div className="p-6 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-center">
          <p className="text-xl text-white font-bold mb-2">
            Total time from zero: ~3 hours
          </p>
          <p className="text-slate-400">
            vs. weeks with traditional tools
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-8 py-16 max-w-4xl mx-auto border-t border-slate-800 text-center">
        <h2 className="text-3xl font-black text-white mb-4">
          Ready to train your robot?
        </h2>
        <p className="text-slate-400 mb-8">
          No signup, no install, no credit card. Just click and start.
        </p>
        <button
          onClick={onGetStarted}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white px-10 py-4 text-xl font-bold transition transform hover:scale-105"
        >
          GET STARTED FREE
        </button>
      </section>

      {/* Footer */}
      <footer className="relative px-8 py-8 border-t border-slate-800">
        <div className="max-w-4xl mx-auto text-center text-slate-500 text-sm">
          <p>RoboSim - The fastest path from zero to trained robot policy</p>
        </div>
      </footer>
    </div>
  );
};
