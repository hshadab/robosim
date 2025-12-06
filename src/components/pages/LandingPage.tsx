import { useState } from 'react';
import { Bot, Play, Zap } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

interface LandingPageProps {
  onLogin: () => void;
  onLearnMore?: () => void;
  onHowToUse?: () => void;
}

// Brutalist Robot Arm SVG
const RobotArmSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none">
    {/* Base */}
    <rect x="35" y="95" width="50" height="20" fill="#1e293b" stroke="#3b82f6" strokeWidth="3"/>
    {/* Lower arm */}
    <rect x="52" y="55" width="16" height="45" fill="#1e293b" stroke="#3b82f6" strokeWidth="3"/>
    {/* Joint 1 */}
    <circle cx="60" cy="55" r="10" fill="#3b82f6" stroke="#1e293b" strokeWidth="2"/>
    {/* Upper arm */}
    <rect x="52" y="20" width="16" height="40" fill="#1e293b" stroke="#3b82f6" strokeWidth="3" transform="rotate(-15 60 55)"/>
    {/* Joint 2 */}
    <circle cx="48" cy="22" r="8" fill="#3b82f6" stroke="#1e293b" strokeWidth="2"/>
    {/* Gripper base */}
    <rect x="38" y="8" width="20" height="12" fill="#1e293b" stroke="#3b82f6" strokeWidth="3"/>
    {/* Gripper fingers */}
    <rect x="35" y="2" width="6" height="10" fill="#3b82f6"/>
    <rect x="55" y="2" width="6" height="10" fill="#3b82f6"/>
    {/* Decorative bolts */}
    <circle cx="60" cy="100" r="3" fill="#3b82f6"/>
    <circle cx="60" cy="75" r="2" fill="#60a5fa"/>
  </svg>
);

// Brutalist Smart Car SVG
const SmartCarSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none">
    {/* Body */}
    <rect x="15" y="45" width="90" height="35" fill="#1e293b" stroke="#22c55e" strokeWidth="3"/>
    {/* Cabin */}
    <polygon points="30,45 45,25 85,25 95,45" fill="#1e293b" stroke="#22c55e" strokeWidth="3"/>
    {/* Window */}
    <polygon points="48,42 52,30 78,30 82,42" fill="#22c55e" opacity="0.3"/>
    {/* Front bumper */}
    <rect x="95" y="50" width="15" height="25" fill="#22c55e"/>
    {/* Rear bumper */}
    <rect x="10" y="50" width="10" height="25" fill="#1e293b" stroke="#22c55e" strokeWidth="2"/>
    {/* Wheels */}
    <rect x="25" y="75" width="25" height="20" fill="#1e293b" stroke="#22c55e" strokeWidth="3"/>
    <rect x="70" y="75" width="25" height="20" fill="#1e293b" stroke="#22c55e" strokeWidth="3"/>
    {/* Wheel details */}
    <line x1="37" y1="75" x2="37" y2="95" stroke="#22c55e" strokeWidth="2"/>
    <line x1="82" y1="75" x2="82" y2="95" stroke="#22c55e" strokeWidth="2"/>
    {/* Ultrasonic sensor */}
    <rect x="100" y="55" width="8" height="8" fill="#22c55e"/>
    <rect x="100" y="65" width="8" height="8" fill="#22c55e"/>
    {/* Headlight */}
    <rect x="98" y="48" width="6" height="4" fill="#fbbf24"/>
    {/* Antenna */}
    <line x1="75" y1="25" x2="75" y2="12" stroke="#22c55e" strokeWidth="2"/>
    <circle cx="75" cy="10" r="4" fill="#22c55e"/>
  </svg>
);

// Brutalist Quadcopter/Drone SVG
const DroneSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none">
    {/* Arms */}
    <line x1="60" y1="60" x2="20" y2="30" stroke="#a855f7" strokeWidth="4"/>
    <line x1="60" y1="60" x2="100" y2="30" stroke="#a855f7" strokeWidth="4"/>
    <line x1="60" y1="60" x2="20" y2="90" stroke="#a855f7" strokeWidth="4"/>
    <line x1="60" y1="60" x2="100" y2="90" stroke="#a855f7" strokeWidth="4"/>
    {/* Center body */}
    <rect x="45" y="50" width="30" height="20" fill="#1e293b" stroke="#a855f7" strokeWidth="3"/>
    {/* Rotors - top left */}
    <ellipse cx="20" cy="30" rx="15" ry="6" fill="#1e293b" stroke="#a855f7" strokeWidth="2"/>
    <rect x="17" y="26" width="6" height="8" fill="#a855f7"/>
    {/* Rotors - top right */}
    <ellipse cx="100" cy="30" rx="15" ry="6" fill="#1e293b" stroke="#a855f7" strokeWidth="2"/>
    <rect x="97" y="26" width="6" height="8" fill="#a855f7"/>
    {/* Rotors - bottom left */}
    <ellipse cx="20" cy="90" rx="15" ry="6" fill="#1e293b" stroke="#a855f7" strokeWidth="2"/>
    <rect x="17" y="86" width="6" height="8" fill="#a855f7"/>
    {/* Rotors - bottom right */}
    <ellipse cx="100" cy="90" rx="15" ry="6" fill="#1e293b" stroke="#a855f7" strokeWidth="2"/>
    <rect x="97" y="86" width="6" height="8" fill="#a855f7"/>
    {/* Camera */}
    <rect x="55" y="68" width="10" height="8" fill="#a855f7"/>
    <circle cx="60" cy="72" r="3" fill="#1e293b"/>
    {/* LED indicators */}
    <rect x="48" y="52" width="4" height="4" fill="#22c55e"/>
    <rect x="68" y="52" width="4" height="4" fill="#ef4444"/>
  </svg>
);

// Brutalist Humanoid SVG
const HumanoidSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none">
    {/* Head */}
    <rect x="42" y="5" width="36" height="30" fill="#1e293b" stroke="#f97316" strokeWidth="3"/>
    {/* Eyes */}
    <rect x="48" y="12" width="10" height="8" fill="#f97316"/>
    <rect x="62" y="12" width="10" height="8" fill="#f97316"/>
    {/* Mouth */}
    <rect x="52" y="26" width="16" height="4" fill="#f97316"/>
    {/* Neck */}
    <rect x="54" y="35" width="12" height="8" fill="#f97316"/>
    {/* Torso */}
    <rect x="38" y="43" width="44" height="35" fill="#1e293b" stroke="#f97316" strokeWidth="3"/>
    {/* Chest detail */}
    <rect x="45" y="50" width="30" height="20" fill="#f97316" opacity="0.2"/>
    <circle cx="60" cy="55" r="5" fill="#f97316"/>
    {/* Left arm */}
    <rect x="20" y="43" width="15" height="8" fill="#1e293b" stroke="#f97316" strokeWidth="2"/>
    <rect x="12" y="51" width="10" height="25" fill="#1e293b" stroke="#f97316" strokeWidth="2"/>
    <rect x="10" y="76" width="14" height="10" fill="#f97316"/>
    {/* Right arm */}
    <rect x="85" y="43" width="15" height="8" fill="#1e293b" stroke="#f97316" strokeWidth="2"/>
    <rect x="98" y="51" width="10" height="25" fill="#1e293b" stroke="#f97316" strokeWidth="2"/>
    <rect x="96" y="76" width="14" height="10" fill="#f97316"/>
    {/* Left leg */}
    <rect x="42" y="78" width="14" height="30" fill="#1e293b" stroke="#f97316" strokeWidth="2"/>
    <rect x="38" y="108" width="20" height="8" fill="#f97316"/>
    {/* Right leg */}
    <rect x="64" y="78" width="14" height="30" fill="#1e293b" stroke="#f97316" strokeWidth="2"/>
    <rect x="62" y="108" width="20" height="8" fill="#f97316"/>
    {/* Belt */}
    <rect x="38" y="73" width="44" height="6" fill="#f97316"/>
  </svg>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onLearnMore, onHowToUse }) => {
  const [hoveredRobot, setHoveredRobot] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);

  const handleEnterApp = () => {
    // Auto-login with demo user
    login('demo@robosim.dev');
  };

  const robots = [
    {
      id: 'arm',
      name: 'SO-101 Arm',
      sign: '6-DOF Open Source\nLeRobot Ready',
      color: 'from-blue-500 to-blue-600',
      shadowColor: 'shadow-blue-500/30',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      textColor: 'text-blue-400',
      Component: RobotArmSVG,
      comingSoon: false,
    },
    {
      id: 'car',
      name: 'Smart Car',
      sign: 'Coming\nSoon',
      color: 'from-green-500 to-green-600',
      shadowColor: 'shadow-green-500/30',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      textColor: 'text-green-400',
      Component: SmartCarSVG,
      comingSoon: true,
    },
    {
      id: 'drone',
      name: 'Quadcopter',
      sign: 'Coming\nSoon',
      color: 'from-purple-500 to-purple-600',
      shadowColor: 'shadow-purple-500/30',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
      textColor: 'text-purple-400',
      Component: DroneSVG,
      comingSoon: true,
    },
    {
      id: 'humanoid',
      name: 'Humanoid',
      sign: 'Coming\nSoon',
      color: 'from-orange-500 to-orange-600',
      shadowColor: 'shadow-orange-500/30',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      textColor: 'text-orange-400',
      Component: HumanoidSVG,
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-base overflow-hidden">
      {/* Brutalist grid background */}
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
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-none border-2 border-blue-500">
            <Bot className="w-8 h-8 text-blue-400" />
          </div>
          <span className="text-2xl font-black text-white tracking-tight">ROBOSIM</span>
        </div>
        <div className="flex items-center gap-6">
          {onLearnMore && (
            <button
              onClick={onLearnMore}
              className="text-lg text-slate-400 hover:text-white transition font-medium"
            >
              Learn More
            </button>
          )}
          {onHowToUse && (
            <button
              onClick={onHowToUse}
              className="text-lg text-slate-400 hover:text-white transition font-medium"
            >
              How to Use
            </button>
          )}
          <button
            onClick={handleEnterApp}
            className="text-lg text-slate-400 hover:text-white transition font-medium"
          >
            Log in
          </button>
          <button
            onClick={handleEnterApp}
            className="bg-white text-black px-6 py-3 text-lg font-bold transition hover:bg-blue-400 hover:text-white border-2 border-white hover:border-blue-400"
          >
            GET STARTED
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-8 pt-12 pb-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-transparent text-blue-400 px-4 py-2 text-base mb-8 border-2 border-blue-500 font-mono">
          <Zap className="w-5 h-5" />
          AI-NATIVE ROBOTICS SIMULATION
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-none tracking-tight">
          MEET YOUR
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400">
            ROBOT TEAM
          </span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-4 font-medium">
          Simulate, program, and deploy real robots - all in your browser
        </p>
      </section>

      {/* Robots with Signs */}
      <section className="relative px-8 py-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-4 gap-8">
          {robots.map((robot) => {
            const RobotComponent = robot.Component;
            return (
              <div
                key={robot.id}
                className={`relative group ${robot.comingSoon ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                onMouseEnter={() => setHoveredRobot(robot.id)}
                onMouseLeave={() => setHoveredRobot(null)}
                onClick={robot.comingSoon ? undefined : handleEnterApp}
              >
                {/* Sign */}
                <div
                  className={`
                    relative mx-auto w-44 mb-0 transition-all duration-300
                    ${hoveredRobot === robot.id && !robot.comingSoon ? '-translate-y-3 rotate-2' : ''}
                  `}
                >
                  {/* Sign board - brutalist style */}
                  <div className={`
                    bg-[#0a0f1a] ${robot.borderColor}
                    border-3 border-2 p-4
                    ${robot.shadowColor}
                    transition-all duration-300
                    ${hoveredRobot === robot.id && !robot.comingSoon ? 'shadow-lg' : ''}
                  `}
                  style={{
                    boxShadow: hoveredRobot === robot.id && !robot.comingSoon ? `4px 4px 0 currentColor` : '2px 2px 0 currentColor',
                  }}
                  >
                    <p className={`${robot.textColor} font-bold text-center whitespace-pre-line leading-tight text-lg uppercase tracking-wide`}>
                      {robot.sign}
                    </p>
                  </div>
                  {/* Sign pole */}
                  <div className={`w-3 h-6 ${robot.bgColor} mx-auto border-x-2 ${robot.borderColor}`} />
                </div>

                {/* Robot SVG */}
                <div
                  className={`
                    relative flex flex-col items-center transition-all duration-300
                    ${hoveredRobot === robot.id && !robot.comingSoon ? 'scale-105' : ''}
                  `}
                >
                  <div className={`
                    w-36 h-36 flex items-center justify-center
                    bg-[#0a0f1a] border-2 ${robot.borderColor}
                    transition-all duration-300
                  `}
                  style={{
                    boxShadow: hoveredRobot === robot.id && !robot.comingSoon ? `6px 6px 0 rgba(255,255,255,0.1)` : '3px 3px 0 rgba(255,255,255,0.05)',
                  }}
                  >
                    <RobotComponent className="w-28 h-28" />
                  </div>

                  {/* Robot name plate */}
                  <div className={`
                    mt-4 px-4 py-2
                    bg-[#0a0f1a] border-2 ${robot.borderColor}
                    transition-all duration-300
                  `}>
                    <span className={`${robot.textColor} font-bold text-base uppercase tracking-wider`}>
                      {robot.name}
                    </span>
                  </div>
                </div>

                {/* Hover indicator */}
                {hoveredRobot === robot.id && !robot.comingSoon && (
                  <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 ${robot.bgColor} border ${robot.borderColor}`} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Button */}
      <section className="relative px-8 py-16 max-w-7xl mx-auto text-center">
        <button
          onClick={handleEnterApp}
          className="group relative bg-white text-black px-12 py-6 text-xl font-black transition-all duration-200 hover:bg-blue-400 hover:text-white border-4 border-white hover:border-blue-400 uppercase tracking-wide"
          style={{
            boxShadow: '6px 6px 0 rgba(59, 130, 246, 0.5)',
          }}
        >
          <span className="flex items-center gap-3">
            <Play className="w-6 h-6" fill="currentColor" />
            Start Building Now
          </span>
        </button>
        <p className="text-slate-500 mt-6 text-base font-medium">
          Free to use — No credit card required
        </p>
      </section>

      {/* Features row - brutalist cards */}
      <section className="relative px-8 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-3 gap-6">
          {[
            { title: 'AI CODING', desc: 'Describe in English, get working code', color: 'border-blue-500', textColor: 'text-blue-400' },
            { title: 'REAL PHYSICS', desc: 'Rapier engine for realistic simulation', color: 'border-purple-500', textColor: 'text-purple-400' },
            { title: 'HARDWARE EXPORT', desc: 'LeRobot Python, Arduino, ESP32', color: 'border-green-500', textColor: 'text-green-400' },
          ].map((feature) => (
            <div
              key={feature.title}
              className={`text-center p-6 bg-[#0a0f1a] border-2 ${feature.color} transition-all hover:-translate-y-1`}
              style={{ boxShadow: '4px 4px 0 rgba(255,255,255,0.05)' }}
            >
              <h3 className={`text-xl font-black ${feature.textColor} mb-3 tracking-wide`}>{feature.title}</h3>
              <p className="text-slate-400 font-medium">{feature.desc}</p>
            </div>
          ))}
        </div>
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
