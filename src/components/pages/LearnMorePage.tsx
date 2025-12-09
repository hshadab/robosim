import React, { useState } from 'react';
import {
  Bot, ArrowLeft, Code, Cpu, Brain, Camera, Database, Download,
  Layers, Zap, Smartphone, Terminal,
  Upload, BarChart3, ChevronRight
} from 'lucide-react';

interface LearnMorePageProps {
  onBack: () => void;
  onGetStarted: () => void;
}


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

export const LearnMorePage: React.FC<LearnMorePageProps> = ({ onBack, onGetStarted }) => {
  const [activeUseCaseTab, setActiveUseCaseTab] = useState<UseCaseTab>('collect');

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
      color: 'blue',
      status: 'available' as const
    },
    {
      name: '4WD Wheeled Robot',
      desc: 'Four-wheel drive mobile robot with sensors. Simulates differential drive with skid steering.',
      joints: ['Left Wheels', 'Right Wheels', 'Head Servo (camera pan)'],
      useCases: ['Line following', 'Obstacle avoidance', 'Maze solving', 'Autonomous navigation'],
      color: 'green',
      status: 'coming_soon' as const
    },
    {
      name: 'Quadcopter Drone',
      desc: 'Four-rotor aerial vehicle with 6-DOF movement. Full position and orientation control.',
      joints: ['Throttle (altitude)', 'Roll', 'Pitch', 'Yaw'],
      useCases: ['Aerial photography', 'Waypoint navigation', 'Terrain mapping', 'Inspection tasks'],
      color: 'purple',
      status: 'coming_soon' as const
    },
    {
      name: 'Berkeley Humanoid Lite (22-DOF)',
      desc: 'Open-source bipedal robot inspired by Berkeley Humanoid. 0.8m tall, 16kg. Arms, legs, and torso articulation.',
      joints: ['Hip pitch/roll/yaw', 'Knee', 'Ankle pitch/roll', 'Shoulder', 'Elbow', 'Wrist'],
      useCases: ['Walking patterns', 'Balance control', 'Human-robot interaction', 'Gesture recognition'],
      color: 'orange',
      status: 'coming_soon' as const
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
      desc: 'Export demonstrations in real Apache Parquet format for LeRobot training.',
      format: '.parquet',
      icon: <Database className="w-5 h-5" />
    },
    {
      platform: 'HuggingFace Hub',
      desc: 'Upload datasets directly to HuggingFace Hub for sharing and training.',
      format: 'Hub',
      icon: <Upload className="w-5 h-5" />
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
          Learn More About <span className="text-blue-400">RoboSim</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-3xl">
          RoboSim is an AI-native robotics simulation platform that runs entirely in your browser.
          Program robots using natural language, code, or hand gestures, then export to real hardware.
        </p>
      </section>

      {/* LeRobot Workflows */}
      <section className="relative px-8 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-white mb-4">LeRobot Workflows</h2>
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
                    onClick={onGetStarted}
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
          Supported Robots
        </h2>
        <div className="space-y-6">
          {robots.map((robot) => (
            <div
              key={robot.name}
              className={`bg-slate-900/50 border-2 p-6 transition ${
                robot.status === 'available'
                  ? 'border-blue-500/30 hover:border-blue-500/60'
                  : 'border-slate-700/30 hover:border-slate-600/60 opacity-80'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <h3 className={`text-xl font-bold ${
                  robot.status === 'available' ? 'text-blue-400' : 'text-slate-400'
                }`}>
                  {robot.name}
                </h3>
                {robot.status === 'available' ? (
                  <span className="px-2 py-0.5 text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                    AVAILABLE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    COMING SOON
                  </span>
                )}
              </div>
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
