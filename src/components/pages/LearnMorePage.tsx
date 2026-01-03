import React from 'react';
import {
  Bot, ArrowLeft, Camera, MessageSquare, Download,
  Check, ArrowRight, Lightbulb, Clock, Zap, Upload,
  Cpu
} from 'lucide-react';

interface LearnMorePageProps {
  onBack: () => void;
  onGetStarted: () => void;
}

export const LearnMorePage: React.FC<LearnMorePageProps> = ({ onBack, onGetStarted }) => {
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
          How <span className="text-blue-400">RoboSim</span> Works
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Train your robot in three simple steps. No coding required.
          Here's everything you need to know to get started.
        </p>
      </section>

      {/* STEP 1: SNAP IT */}
      <section className="relative px-8 py-16 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-500 flex items-center justify-center font-black text-xl text-white">
            1
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">SNAP IT</h2>
            <p className="text-blue-400">Upload a photo of any object</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-slate-300 text-lg mb-6">
              Take a photo of any object you want your robot to pick up.
              RoboSim converts it into a 3D model that the robot can interact with.
            </p>

            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-400" />
              Photo Tips
            </h3>
            <ul className="space-y-3 mb-6">
              {[
                'Use good lighting - natural light works best',
                'Plain background helps (white or solid color)',
                'Capture the object from a slight angle, not straight on',
                'Make sure the whole object is in frame',
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-400">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  {tip}
                </li>
              ))}
            </ul>

            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Supported Formats
            </h3>
            <p className="text-slate-400 mb-2">JPG, PNG, WebP - up to 10MB</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              What Happens
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500/20 text-blue-400 text-sm font-bold flex items-center justify-center flex-shrink-0">1</div>
                <div>
                  <p className="text-white font-medium">Upload your photo</p>
                  <p className="text-slate-500 text-sm">Click "Add Object" → "From Photo"</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500/20 text-blue-400 text-sm font-bold flex items-center justify-center flex-shrink-0">2</div>
                <div>
                  <p className="text-white font-medium">AI generates 3D model</p>
                  <p className="text-slate-500 text-sm">Takes about 20 seconds</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500/20 text-blue-400 text-sm font-bold flex items-center justify-center flex-shrink-0">3</div>
                <div>
                  <p className="text-white font-medium">Object appears in scene</p>
                  <p className="text-slate-500 text-sm">Ready for robot interaction</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30">
              <p className="text-blue-300 text-sm">
                <Lightbulb className="w-4 h-4 inline mr-2" />
                <strong>Don't have a photo?</strong> Use one of the built-in training cubes optimized for SO-101 gripper.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STEP 2: TEACH IT */}
      <section className="relative px-8 py-16 max-w-4xl mx-auto border-t border-slate-800">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-purple-500 flex items-center justify-center font-black text-xl text-white">
            2
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">TEACH IT</h2>
            <p className="text-purple-400">Demonstrate by chatting</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-slate-300 text-lg mb-6">
              Just tell the robot what to do in plain English.
              The robot learns from your commands and builds training data automatically.
            </p>

            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              Example Commands
            </h3>
            <div className="space-y-3 mb-6">
              {[
                '"Pick up the apple"',
                '"Grab the red cube"',
                '"Move to the bottle"',
                '"Stack it on the blue block"',
                '"Put it down"',
              ].map((cmd, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <code className="text-purple-300 bg-purple-500/10 px-3 py-1 border border-purple-500/30">
                    {cmd}
                  </code>
                </div>
              ))}
            </div>

            <h3 className="font-bold text-white mb-4">How Many Demos?</h3>
            <p className="text-slate-400">
              For simple pick-and-place tasks, <strong className="text-white">5-10 demonstrations</strong> is usually enough.
              RoboSim auto-generates variations to create 50-100+ training episodes from your demos.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 p-6">
            <h3 className="font-bold text-white mb-4">What the Robot Learns</h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-700/50 border-l-4 border-purple-500">
                <p className="text-white font-medium mb-1">Joint Positions</p>
                <p className="text-slate-400 text-sm">The exact angles of each joint at every moment</p>
              </div>
              <div className="p-4 bg-slate-700/50 border-l-4 border-purple-500">
                <p className="text-white font-medium mb-1">Gripper State</p>
                <p className="text-slate-400 text-sm">When to open and close the gripper</p>
              </div>
              <div className="p-4 bg-slate-700/50 border-l-4 border-purple-500">
                <p className="text-white font-medium mb-1">Camera View</p>
                <p className="text-slate-400 text-sm">What the robot "sees" at each step</p>
              </div>
              <div className="p-4 bg-slate-700/50 border-l-4 border-purple-500">
                <p className="text-white font-medium mb-1">Language Instruction</p>
                <p className="text-slate-400 text-sm">Your command (for language-conditioned learning)</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30">
              <p className="text-purple-300 text-sm">
                <Lightbulb className="w-4 h-4 inline mr-2" />
                <strong>Pro tip:</strong> Vary your approach slightly each time. Pick up from different angles to help the robot generalize.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* STEP 3: TRAIN & DEPLOY */}
      <section className="relative px-8 py-16 max-w-4xl mx-auto border-t border-slate-800">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-green-500 flex items-center justify-center font-black text-xl text-white">
            3
          </div>
          <div>
            <h2 className="text-3xl font-black text-white">TRAIN & DEPLOY</h2>
            <p className="text-green-400">Train on Google Colab, deploy to real hardware</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-slate-300 text-lg mb-6">
              Upload your dataset to HuggingFace with one click, train an AI policy on
              Google Colab (free GPU!), and deploy to real SO-101 hardware.
            </p>

            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-orange-400" />
              Google Colab Training
            </h3>
            <div className="p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 mb-6">
              <p className="text-orange-300 text-sm mb-3">
                We provide a ready-to-use Colab notebook that trains your robot policy
                using LeRobot's ACT (Action Chunking Transformer) architecture.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  Free T4 GPU - no cost to train
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  ~2 hours to trained model
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Check className="w-4 h-4 text-green-400" />
                  Automatic upload to HuggingFace
                </div>
              </div>
            </div>

            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-400" />
              Export Options
            </h3>
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-slate-800/50 border border-slate-700">
                <p className="text-white font-medium">HuggingFace Hub</p>
                <p className="text-slate-400 text-sm">One-click upload to share with the community or use for training</p>
              </div>
              <div className="p-4 bg-slate-800/50 border border-slate-700">
                <p className="text-white font-medium">LeRobot Format</p>
                <p className="text-slate-400 text-sm">Parquet files compatible with LeRobot training scripts</p>
              </div>
              <div className="p-4 bg-slate-800/50 border border-slate-700">
                <p className="text-white font-medium">Direct to Hardware</p>
                <p className="text-slate-400 text-sm">Connect SO-101 via USB and mirror simulation to real robot</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Training Workflow
            </h3>
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center flex-shrink-0">1</div>
                <div>
                  <p className="text-white font-medium">Upload to HuggingFace</p>
                  <p className="text-slate-500 text-sm">Click "Upload to HuggingFace Hub" in RoboSim</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center flex-shrink-0">2</div>
                <div>
                  <p className="text-white font-medium">Open Colab Notebook</p>
                  <p className="text-slate-500 text-sm">Click "Train on Google Colab" button</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center flex-shrink-0">3</div>
                <div>
                  <p className="text-white font-medium">Configure & Train</p>
                  <p className="text-slate-500 text-sm">Enter your dataset ID, run all cells (~2 hours)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center flex-shrink-0">4</div>
                <div>
                  <p className="text-white font-medium">Deploy to Robot</p>
                  <p className="text-slate-500 text-sm">Download model and run on real SO-101</p>
                </div>
              </div>
            </div>

            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-green-400" />
              What You Get
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Training Dataset</p>
                  <p className="text-slate-500 text-sm">50-100+ episodes with images, joint angles, and language</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Trained ACT Policy</p>
                  <p className="text-slate-500 text-sm">PyTorch model checkpoint ready for inference</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Real Hardware Ready</p>
                  <p className="text-slate-500 text-sm">Trained policies run on actual SO-101 robot arm</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30">
              <p className="text-green-300 text-sm">
                <Lightbulb className="w-4 h-4 inline mr-2" />
                <strong>No hardware?</strong> You can still train and test policies entirely in simulation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-8 py-20 max-w-4xl mx-auto text-center border-t border-slate-800">
        <h2 className="text-3xl font-black text-white mb-4">Ready to Train Your Robot?</h2>
        <p className="text-xl text-slate-400 mb-8">
          It takes less than 5 minutes to see your first pickup.
        </p>
        <button
          onClick={onGetStarted}
          className="group inline-flex items-center gap-3 bg-white text-black px-10 py-4 text-lg font-bold transition hover:bg-blue-400 hover:text-white border-2 border-white hover:border-blue-400"
          style={{ boxShadow: '4px 4px 0 rgba(59, 130, 246, 0.4)' }}
        >
          Get Started Free
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        <p className="text-slate-500 text-sm mt-4">No account required. Works in your browser.</p>
      </section>

      {/* Footer */}
      <footer className="relative px-8 py-8 border-t border-slate-800">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-slate-600">
          <span>RoboSim</span>
          <span>Train robots with AI</span>
        </div>
      </footer>
    </div>
  );
};
