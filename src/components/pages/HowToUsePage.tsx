import React, { useState } from 'react';
import {
  Bot, ArrowLeft, MousePointer2, Keyboard, Gamepad2, Package, LineChart,
  Usb, Play, Target, Layers, ChevronDown, ChevronRight, Zap, Hand,
  Code, Download, Settings, Brain, Cpu, CheckCircle, Mic, Eye, Box,
  Camera, Wand2, GraduationCap, Upload, Palette, Languages
} from 'lucide-react';

interface HowToUsePageProps {
  onBack: () => void;
  onGetStarted: () => void;
}

interface FeatureSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  benefit: string;
  steps: {
    title: string;
    description: string;
    tip?: string;
  }[];
}

export const HowToUsePage: React.FC<HowToUsePageProps> = ({ onBack, onGetStarted }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('ik');

  const features: FeatureSection[] = [
    {
      id: 'ik',
      title: 'Click-to-Move (Inverse Kinematics)',
      icon: <MousePointer2 className="w-5 h-5" />,
      color: 'green',
      benefit: 'Move the robot arm by clicking anywhere in 3D space - no math required!',
      steps: [
        {
          title: 'Enable Click-to-Move Mode',
          description: 'Go to the Control tab in the Tools panel (right side), open "Advanced Controls" and click the "Click" button (mouse icon).',
          tip: 'The button turns green when active'
        },
        {
          title: 'Hover Over the 3D View',
          description: 'Move your mouse over the 3D simulation area. You\'ll see a target marker following your cursor.',
        },
        {
          title: 'Check Reachability',
          description: 'Green marker = position is reachable. Red marker = out of arm\'s reach. The arm can only reach positions within its workspace envelope.',
          tip: 'Enable "Show Workspace" in settings to see the reachable area'
        },
        {
          title: 'Click to Move',
          description: 'Click on any green (reachable) position. The arm automatically calculates joint angles using inverse kinematics and moves smoothly to that position.',
        },
      ],
    },
    {
      id: 'keyboard',
      title: 'Keyboard Teleoperation',
      icon: <Keyboard className="w-5 h-5" />,
      color: 'purple',
      benefit: 'Control the robot arm like a video game using your keyboard for precise real-time movement.',
      steps: [
        {
          title: 'Enable Keyboard Mode',
          description: 'Go to the Control tab → Advanced Controls, click the "Keys" button (keyboard icon). The panel turns purple when active.',
        },
        {
          title: 'Focus the Application',
          description: 'Click anywhere in the RoboSim window to ensure keyboard input is captured.',
        },
        {
          title: 'Use WASD for Base & Shoulder',
          description: 'W/S = Shoulder up/down, A/D = Base rotate left/right. Hold keys for continuous movement.',
        },
        {
          title: 'Use Arrow Keys for Elbow & Wrist',
          description: 'Up/Down = Elbow angle, Left/Right = Wrist angle.',
        },
        {
          title: 'Use Q/E for Wrist Roll',
          description: 'Q = Roll left, E = Roll right. Fine-tune the gripper orientation.',
        },
        {
          title: 'Use Space/Shift for Gripper',
          description: 'Space = Open gripper, Shift = Close gripper. Perfect for pick and place tasks.',
          tip: 'Combine multiple keys for diagonal/complex movements'
        },
      ],
    },
    {
      id: 'gamepad',
      title: 'Gamepad Controller Support',
      icon: <Gamepad2 className="w-5 h-5" />,
      color: 'orange',
      benefit: 'Use any USB/Bluetooth game controller for intuitive analog control with smooth precision.',
      steps: [
        {
          title: 'Connect Your Gamepad',
          description: 'Plug in a USB controller or pair via Bluetooth. Xbox, PlayStation, and generic controllers are supported.',
        },
        {
          title: 'Verify Detection',
          description: 'The "Pad" button in Advanced Controls shows a green dot when a gamepad is detected.',
        },
        {
          title: 'Enable Gamepad Mode',
          description: 'Go to Control tab → Advanced Controls, click the "Pad" button. It turns orange when active.',
        },
        {
          title: 'Left Stick: Base & Shoulder',
          description: 'Left stick X-axis = Base rotation, Y-axis = Shoulder angle.',
        },
        {
          title: 'Right Stick: Elbow & Wrist',
          description: 'Right stick X-axis = Wrist angle, Y-axis = Elbow angle.',
        },
        {
          title: 'Triggers & Bumpers',
          description: 'Left/Right triggers = Close/Open gripper. Bumpers = Wrist roll left/right.',
          tip: 'Analog triggers give proportional gripper control'
        },
      ],
    },
    {
      id: 'tasks',
      title: 'Task Templates (Pick & Place)',
      icon: <Package className="w-5 h-5" />,
      color: 'orange',
      benefit: 'Run pre-programmed robot sequences for common tasks with one click.',
      steps: [
        {
          title: 'Find Task Templates Panel',
          description: 'Go to the Control tab in the Tools panel (right side), then open "Task Templates".',
        },
        {
          title: 'Browse Available Tasks',
          description: 'View 6 pre-built sequences: Pick & Place (Left/Right), Stack Objects, Arc Scan, Wave Hello, Demo Cycle.',
        },
        {
          title: 'Run a Task',
          description: 'Click the play button next to any task. The robot executes the full waypoint sequence with smooth motion.',
        },
        {
          title: 'Control Playback',
          description: 'Use pause/resume and stop buttons to control execution. A progress bar shows completion status.',
          tip: 'Watch the Joint Trajectory Graph to see how joints move during tasks'
        },
      ],
    },
    {
      id: 'trajectory',
      title: 'Joint Trajectory Graph',
      icon: <LineChart className="w-5 h-5" />,
      color: 'cyan',
      benefit: 'Visualize real-time joint positions over time - essential for debugging and analysis.',
      steps: [
        {
          title: 'Locate the Graph',
          description: 'Go to the Control tab in the Tools panel (right side), then open "Trajectory".',
        },
        {
          title: 'Understand the Display',
          description: 'X-axis = Time (last 10 seconds), Y-axis = Joint angle (-100° to +100°). Each joint has a different color.',
        },
        {
          title: 'Toggle Joint Visibility',
          description: 'Click the colored joint buttons (Base, Shoulder, Elbow, etc.) to show/hide specific joints.',
        },
        {
          title: 'Pause Recording',
          description: 'Click the pause icon to freeze the display. Click again to resume recording.',
        },
        {
          title: 'Clear History',
          description: 'Click the trash icon to clear all recorded data and start fresh.',
          tip: 'Use this to compare "before and after" when tuning movements'
        },
      ],
    },
    {
      id: 'workspace',
      title: 'Workspace Visualization',
      icon: <Layers className="w-5 h-5" />,
      color: 'blue',
      benefit: 'See exactly where the robot arm can reach with a 3D visualization of its workspace envelope.',
      steps: [
        {
          title: 'Open Advanced Controls Settings',
          description: 'Go to Control tab → Advanced Controls, click the settings gear icon to expand options.',
        },
        {
          title: 'Enable Workspace Toggle',
          description: 'Turn on "Show Workspace" to display the workspace visualization.',
        },
        {
          title: 'Understand the Visualization',
          description: 'Blue semi-transparent dome = reachable area. Red inner zone = too close to base (unreachable).',
        },
        {
          title: 'Use for Planning',
          description: 'When placing objects in the environment, ensure they fall within the blue dome for the arm to reach them.',
          tip: 'Rotate the 3D view to see the workspace from different angles'
        },
      ],
    },
    {
      id: 'serial',
      title: 'Serial Connection',
      icon: <Usb className="w-5 h-5" />,
      color: 'blue',
      benefit: 'Connect directly to your real SO-101 robot and mirror simulation movements in real-time!',
      steps: [
        {
          title: 'Check Browser Compatibility',
          description: 'Web Serial requires Chrome, Edge, or Opera. Firefox and Safari are not supported.',
        },
        {
          title: 'Find Serial Connection Panel',
          description: 'Go to the Hardware tab in the Tools panel (right side), then open "Serial Connection".',
        },
        {
          title: 'Connect Your Robot',
          description: 'Click "Connect" and select your USB serial port from the browser dialog.',
          tip: 'Usually /dev/ttyUSB0 on Linux, COM3+ on Windows'
        },
        {
          title: 'Configure Baud Rate',
          description: 'Default is 115200. Click settings gear to change if your hardware uses a different rate.',
        },
        {
          title: 'Enable Auto-Sync',
          description: 'Turn on "Auto-sync" to mirror every simulation movement to real hardware at 30-60 Hz.',
        },
        {
          title: 'Manual Send',
          description: 'With auto-sync off, click "Send" to manually push current position to hardware.',
          tip: 'Command format: J0:1500,J1:1500,J2:1500,J3:1500,J4:1500,J5:1500'
        },
      ],
    },
    {
      id: 'hand',
      title: 'Hand Tracking',
      icon: <Hand className="w-5 h-5" />,
      color: 'pink',
      benefit: 'Control the robot arm naturally using your hand movements via webcam.',
      steps: [
        {
          title: 'Find Hand Tracking Panel',
          description: 'Go to the Hardware tab in the Tools panel (right side), then open "Hand Tracking".',
        },
        {
          title: 'Enable Camera Access',
          description: 'Click "Start Tracking" and allow camera permission when prompted.',
        },
        {
          title: 'Position Your Hand',
          description: 'Hold your hand in front of the camera with fingers spread. A skeleton overlay shows detection.',
        },
        {
          title: 'Move the Arm',
          description: 'Move your hand in 3D space - the robot arm follows your hand position.',
        },
        {
          title: 'Control the Gripper',
          description: 'Pinch your thumb and index finger together to close the gripper. Spread them to open.',
          tip: 'Good lighting improves tracking accuracy'
        },
      ],
    },
    {
      id: 'ai',
      title: 'AI Chat Programming',
      icon: <Brain className="w-5 h-5" />,
      color: 'pink',
      benefit: 'Describe what you want in plain English and let AI generate the robot commands.',
      steps: [
        {
          title: 'Configure API Key',
          description: 'Click the settings gear in the header and enter your Anthropic API key for Claude AI.',
        },
        {
          title: 'Open Chat Panel',
          description: 'The AI Chat panel is in the left column of the Simulate tab.',
        },
        {
          title: 'Describe Your Task',
          description: 'Type natural language commands like "pick up the red cube" or "wave hello".',
        },
        {
          title: 'Review Generated Code',
          description: 'The AI generates robot commands. Review them in the response before execution.',
        },
        {
          title: 'Run the Commands',
          description: 'Click "Run" to execute the generated robot program. Watch the arm move!',
          tip: 'Be specific about positions and objects for better results'
        },
      ],
    },
    {
      id: 'dataset',
      title: 'Record Dataset',
      icon: <Download className="w-5 h-5" />,
      color: 'cyan',
      benefit: 'Record robot movements for machine learning training in HuggingFace LeRobot format.',
      steps: [
        {
          title: 'Find Record Dataset Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "Record Dataset".',
        },
        {
          title: 'Start Recording',
          description: 'Click "Record" to begin capturing joint positions at 30 Hz.',
        },
        {
          title: 'Perform Actions',
          description: 'Teleoperate the robot using any control method (keyboard, gamepad, hand tracking).',
        },
        {
          title: 'Stop Recording',
          description: 'Click "Stop" when your demonstration is complete.',
        },
        {
          title: 'Export Dataset',
          description: 'Click "Export" to download in LeRobot format (.json with joint trajectories).',
          tip: 'Use for imitation learning with HuggingFace LeRobot framework'
        },
      ],
    },
    {
      id: 'code',
      title: 'Code Editor',
      icon: <Code className="w-5 h-5" />,
      color: 'green',
      benefit: 'Write and run JavaScript/TypeScript code to program precise robot behaviors.',
      steps: [
        {
          title: 'Switch to Code Tab',
          description: 'Click "Code" tab in the header navigation bar.',
        },
        {
          title: 'Write Robot Code',
          description: 'Use the Monaco editor to write code using the robot API (robot.moveJoint, robot.goHome, etc.).',
        },
        {
          title: 'Run Your Program',
          description: 'Click the green "Run" button to execute your code. Watch the simulation viewport.',
        },
        {
          title: 'Debug with Console',
          description: 'Check the console panel for errors and console.log output.',
        },
        {
          title: 'Export to Hardware',
          description: 'Use the export dropdown to generate Arduino, Python, or MicroPython code.',
          tip: 'Templates are available for common tasks'
        },
      ],
    },
    {
      id: 'copilot',
      title: 'Code Copilot (AI Assistance)',
      icon: <Code className="w-5 h-5" />,
      color: 'yellow',
      benefit: 'Get AI-powered code completions, generate code from comments, and explain robot programs.',
      steps: [
        {
          title: 'Write a Comment',
          description: 'In the code editor, write a comment describing what you want, like "// wave hello" or "// pick up the block".',
        },
        {
          title: 'Generate Code from Comments',
          description: 'Press Ctrl+Shift+G (Cmd+Shift+G on Mac) to have AI generate code from your comment.',
          tip: 'The AI reads your comment and generates the appropriate robot commands'
        },
        {
          title: 'Explain Selected Code',
          description: 'Select any code block and press Ctrl+Shift+E to get an AI explanation of what it does.',
        },
        {
          title: 'Use Intelligent Autocomplete',
          description: 'As you type, the AI provides smart completions for robot API methods like robot.moveJoint(), robot.goHome(), and robot.openGripper().',
          tip: 'Press Tab to accept completions, Escape to dismiss'
        },
      ],
    },
    {
      id: 'voice',
      title: 'Voice Control',
      icon: <Mic className="w-5 h-5" />,
      color: 'cyan',
      benefit: 'Control the robot hands-free using voice commands - just say what you want!',
      steps: [
        {
          title: 'Open Voice Control Panel',
          description: 'Go to the AI tab in the Tools panel (right side), then open "Voice Control".',
        },
        {
          title: 'Allow Microphone Access',
          description: 'Click the microphone button and allow browser microphone permission.',
        },
        {
          title: 'Speak Commands',
          description: 'Say commands like "wave hello", "open gripper", "move left", or "go home".',
        },
        {
          title: 'Enable Wake Word (Optional)',
          description: 'Turn on wake word to say "Hey Robot" before each command for hands-free use.',
          tip: 'Works best in Chrome or Edge browsers'
        },
      ],
    },
    {
      id: 'vision',
      title: 'Vision Analysis',
      icon: <Eye className="w-5 h-5" />,
      color: 'pink',
      benefit: 'Ask questions about the scene and get AI-powered answers about objects and positions.',
      steps: [
        {
          title: 'Open Vision Analysis Panel',
          description: 'Go to the AI tab in the Tools panel (right side), then open "Vision Analysis".',
        },
        {
          title: 'Capture the Scene',
          description: 'Click "Analyze Scene" to capture the current 3D view.',
        },
        {
          title: 'Ask Questions',
          description: 'Type questions like "What objects are in the scene?" or "Where is the red cube?"',
        },
        {
          title: 'Get Suggestions',
          description: 'The AI provides suggested robot actions based on the scene analysis.',
          tip: 'Enter your Anthropic API key in settings for enhanced analysis'
        },
      ],
    },
    {
      id: 'text3d',
      title: 'Text to 3D',
      icon: <Box className="w-5 h-5" />,
      color: 'emerald',
      benefit: 'Generate 3D objects from text descriptions - create training environments instantly.',
      steps: [
        {
          title: 'Open Text to 3D Panel',
          description: 'Go to the AI tab in the Tools panel (right side), then open "Text to 3D".',
        },
        {
          title: 'Describe Your Object',
          description: 'Type a description like "red apple", "wooden cube", or "blue ball".',
        },
        {
          title: 'Choose Style',
          description: 'Select style: Realistic, Cartoon, Low-poly, or Voxel.',
        },
        {
          title: 'Generate and Add',
          description: 'Click Generate. The object appears in the scene with physics enabled.',
          tip: 'Enable AI textures with a Gemini API key for more realistic objects'
        },
      ],
    },
    {
      id: 'image3d',
      title: 'Image to 3D',
      icon: <Camera className="w-5 h-5" />,
      color: 'teal',
      benefit: 'Upload a photo of any real object and convert it to a training-ready 3D model.',
      steps: [
        {
          title: 'Open Image to 3D Panel',
          description: 'Go to the AI tab in the Tools panel (right side), then open "Image to 3D" (has CSM badge).',
        },
        {
          title: 'Enter CSM API Key',
          description: 'Get a free API key from csm.ai (10 free credits) and enter it.',
        },
        {
          title: 'Upload Object Photo',
          description: 'Drag & drop or click to upload a photo of a real object (screwdriver, cup, etc.).',
        },
        {
          title: 'Set Dimensions',
          description: 'Enter the real-world size of the object in meters (width, height, depth).',
        },
        {
          title: 'Generate Model',
          description: 'Click Generate. CSM creates a 3D model with auto-estimated grasp points.',
          tip: 'Generated models include physics config and training task templates'
        },
      ],
    },
    {
      id: 'policies',
      title: 'LeRobot Policies',
      icon: <Brain className="w-5 h-5" />,
      color: 'purple',
      benefit: 'Load and run pre-trained AI policies from HuggingFace Hub directly in your browser.',
      steps: [
        {
          title: 'Open LeRobot Policies Panel',
          description: 'Go to the AI tab in the Tools panel (right side), then open "LeRobot Policies".',
        },
        {
          title: 'Search for Policies',
          description: 'Browse or search for SO-101 compatible policies on HuggingFace Hub.',
        },
        {
          title: 'Download Policy',
          description: 'Click Download on a policy with ONNX format. Wait for download to complete.',
        },
        {
          title: 'Run the Policy',
          description: 'Click Run to start autonomous policy execution at 20Hz.',
          tip: 'Policies run locally using ONNX Runtime Web - no GPU required'
        },
      ],
    },
    {
      id: 'autogen',
      title: 'Auto-Generate',
      icon: <Wand2 className="w-5 h-5" />,
      color: 'lime',
      benefit: 'Generate 100+ training episodes instantly with one click - no manual demos needed.',
      steps: [
        {
          title: 'Open Auto-Generate Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "Auto-Generate".',
        },
        {
          title: 'Select Task Templates',
          description: 'Choose which parameterized tasks to generate episodes for.',
        },
        {
          title: 'Configure Settings',
          description: 'Set episode count, randomization ranges, and augmentation multiplier.',
        },
        {
          title: 'Generate Episodes',
          description: 'Click Generate. Episodes are created with randomized parameters.',
        },
        {
          title: 'Export Dataset',
          description: 'Export to LeRobot format or upload directly to HuggingFace Hub.',
          tip: 'Combined with augmentation, can generate 1000+ episodes in minutes'
        },
      ],
    },
    {
      id: 'challenges',
      title: 'Guided Challenges',
      icon: <GraduationCap className="w-5 h-5" />,
      color: 'rose',
      benefit: 'Learn robot control through interactive challenges with real-time feedback.',
      steps: [
        {
          title: 'Open Guided Challenges',
          description: 'In the Control tab, find "Guided Challenges" panel.',
        },
        {
          title: 'Select a Challenge',
          description: 'Choose from Basic Movement, Reach Position, or Pick Motion challenges.',
        },
        {
          title: 'Follow Instructions',
          description: 'Each step shows target joint positions you need to match.',
        },
        {
          title: 'Match Positions',
          description: 'Move joints using sliders or keyboard. Green indicators show when you match.',
        },
        {
          title: 'Complete the Challenge',
          description: 'Steps auto-advance when matched. Complete all steps to finish.',
          tip: 'Great for learning joint relationships and robot capabilities'
        },
      ],
    },
    {
      id: 'augment',
      title: 'Augmentation',
      icon: <Layers className="w-5 h-5" />,
      color: 'indigo',
      benefit: 'Multiply your recorded datasets 2-10x with automatic trajectory variations.',
      steps: [
        {
          title: 'Record Some Episodes',
          description: 'First record demonstration episodes using Record Dataset.',
        },
        {
          title: 'Open Augmentation Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "Augmentation".',
        },
        {
          title: 'Select Augmentation Types',
          description: 'Choose from: Action Noise, Time Stretch, Spatial Jitter, Temporal Dropout, Mirror.',
        },
        {
          title: 'Set Multiplier',
          description: 'Choose how many augmented copies to create (2x to 10x).',
        },
        {
          title: 'Generate Augmented Data',
          description: 'Click Augment. New episodes are created with variations applied.',
          tip: 'Augmentation helps policies generalize better to real hardware'
        },
      ],
    },
    {
      id: 'randomization',
      title: 'Visual Randomization',
      icon: <Palette className="w-5 h-5" />,
      color: 'violet',
      benefit: 'Randomize lighting, materials, and camera to prepare policies for real-world transfer.',
      steps: [
        {
          title: 'Open Visual Randomization',
          description: 'Go to the More tab in the Tools panel (right side), then open "Visual Randomization".',
        },
        {
          title: 'Adjust Lighting',
          description: 'Randomize ambient intensity, directional light, and shadow softness.',
        },
        {
          title: 'Vary Materials',
          description: 'Adjust metalness, roughness, and color tinting ranges.',
        },
        {
          title: 'Camera Jitter',
          description: 'Add FOV and position variations for viewpoint diversity.',
        },
        {
          title: 'Enable Auto-Randomize',
          description: 'Turn on continuous randomization during recording for domain-randomized datasets.',
          tip: 'Use presets: Bright Studio, Moody, Outdoor, Factory'
        },
      ],
    },
    {
      id: 'upload',
      title: 'Upload to Hub',
      icon: <Upload className="w-5 h-5" />,
      color: 'sky',
      benefit: 'Upload your recorded datasets directly to HuggingFace Hub - no CLI required.',
      steps: [
        {
          title: 'Record Episodes',
          description: 'Use Record Dataset or Auto-Generate to create training data.',
        },
        {
          title: 'Open Upload to Hub Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "Upload to Hub".',
        },
        {
          title: 'Enter HuggingFace Token',
          description: 'Get a write token from huggingface.co/settings/tokens and paste it.',
        },
        {
          title: 'Name Your Dataset',
          description: 'Enter a dataset name. A repository will be created automatically.',
        },
        {
          title: 'Upload',
          description: 'Click Upload. Progress shows as files are pushed to Hub.',
          tip: 'Dataset card with metadata is auto-generated'
        },
      ],
    },
    {
      id: 'langlearn',
      title: 'Language-Conditioned Training',
      icon: <Languages className="w-5 h-5" />,
      color: 'amber',
      benefit: 'Train robots to follow natural language instructions - the key to models like RT-1, RT-2, and OpenVLA.',
      steps: [
        {
          title: 'Open LeRobot Dataset Panel',
          description: 'Go to the Data tab in the Tools panel (right side), then open "LeRobot Dataset".',
        },
        {
          title: 'Expand Settings',
          description: 'Click the settings arrow to expand the configuration panel.',
        },
        {
          title: 'Enter Language Instruction',
          description: 'In the "Language Instruction" field, type a natural language description like "Pick up the red cube and place it on the green target".',
          tip: 'Be specific and descriptive - this is what the robot learns to understand'
        },
        {
          title: 'Record Your Demonstration',
          description: 'Click Record, then perform the task using any control method (keyboard, gamepad, etc.). Click Success when done.',
        },
        {
          title: 'Export with Language Data',
          description: 'Export to LeRobot format. The language_instruction is included in episodes.jsonl metadata.',
        },
        {
          title: 'Train Language-Conditioned Policy',
          description: 'Use the dataset with LeRobot ACT/Diffusion policy or fine-tune OpenVLA for language-conditioned control.',
          tip: 'Each episode can have a unique instruction for diverse training data'
        },
      ],
    },
  ];

  const quickStartSteps = [
    { step: 1, title: 'Select Robot', description: 'Choose SO-101 Arm from the dropdown in the header', icon: <Bot className="w-5 h-5" /> },
    { step: 2, title: 'Try Manual Control', description: 'In the Control tab, use Joint Controls to move each joint', icon: <Settings className="w-5 h-5" /> },
    { step: 3, title: 'Enable Keyboard Mode', description: 'In Control tab → Advanced Controls, click "Keys" for WASD control', icon: <Keyboard className="w-5 h-5" /> },
    { step: 4, title: 'Run a Task', description: 'In Control tab → Task Templates, click play on "Pick & Place"', icon: <Play className="w-5 h-5" /> },
    { step: 5, title: 'Connect Hardware', description: 'In Hardware tab → Serial Connection, connect your robot', icon: <Usb className="w-5 h-5" /> },
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

      {/* Nav - Mobile responsive */}
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
          <span className="hidden sm:inline">LAUNCH SIMULATOR</span>
          <span className="sm:hidden">START</span>
        </button>
      </nav>

      {/* Hero - Mobile responsive */}
      <section className="relative px-4 md:px-8 pt-6 md:pt-8 pb-8 md:pb-12 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-transparent text-green-400 px-3 md:px-4 py-2 text-xs md:text-sm mb-4 md:mb-6 border-2 border-green-500 font-mono">
          <Zap className="w-3 h-3 md:w-4 md:h-4" />
          STEP-BY-STEP GUIDE
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 md:mb-6 leading-tight">
          How to Use <span className="text-green-400">RoboSim</span>
        </h1>
        <p className="text-base md:text-xl text-slate-400 max-w-3xl">
          Complete guide to all features with step-by-step instructions.
          From basic joint control to hardware connection and AI programming.
        </p>
      </section>

      {/* Quick Start - Mobile responsive */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-5xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
          <Play className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
          Quick Start (5 Minutes)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
          {quickStartSteps.map((item) => (
            <div
              key={item.step}
              className="bg-slate-900/50 border-2 border-slate-700/50 p-3 md:p-4 relative hover:border-green-500/50 transition"
            >
              <div className="absolute -top-2 -left-2 md:-top-3 md:-left-3 w-6 h-6 md:w-8 md:h-8 bg-green-500 flex items-center justify-center font-black text-black text-sm md:text-base">
                {item.step}
              </div>
              <div className="text-green-400 mb-2 mt-2">{item.icon}</div>
              <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Guides - Mobile responsive */}
      <section className="relative px-4 md:px-8 py-8 md:py-12 max-w-5xl mx-auto">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
          <Target className="w-6 h-6 text-purple-400" />
          Feature Guides
        </h2>

        <div className="space-y-4">
          {features.map((feature) => (
            <div
              key={feature.id}
              className={`bg-slate-900/50 border-2 transition-all ${
                expandedSection === feature.id
                  ? `border-${feature.color}-500/60`
                  : 'border-slate-700/50 hover:border-slate-600'
              }`}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedSection(expandedSection === feature.id ? null : feature.id)}
                className="w-full flex items-center justify-between p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 bg-${feature.color}-500/20 text-${feature.color}-400`}>
                    {feature.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.benefit}</p>
                  </div>
                </div>
                {expandedSection === feature.id ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* Steps */}
              {expandedSection === feature.id && (
                <div className="px-4 pb-4 border-t border-slate-700/50">
                  <div className="mt-4 space-y-4">
                    {feature.steps.map((step, index) => (
                      <div key={index} className="flex gap-4">
                        <div className={`flex-shrink-0 w-8 h-8 bg-${feature.color}-500/20 text-${feature.color}-400 flex items-center justify-center font-bold text-sm border border-${feature.color}-500/30`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-white mb-1">{step.title}</h4>
                          <p className="text-sm text-slate-400">{step.description}</p>
                          {step.tip && (
                            <div className="mt-2 flex items-start gap-2 text-xs">
                              <CheckCircle className={`w-4 h-4 text-${feature.color}-400 flex-shrink-0 mt-0.5`} />
                              <span className="text-slate-500">
                                <span className="text-slate-400 font-medium">Tip:</span> {step.tip}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Keyboard Reference */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Keyboard className="w-6 h-6 text-purple-400" />
          Keyboard Controls Reference
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-purple-500/30 p-6">
            <h3 className="text-lg font-bold text-purple-400 mb-4">SO-101 Arm</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Base rotate</span>
                <span className="font-mono text-white">A / D</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Shoulder</span>
                <span className="font-mono text-white">W / S</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Elbow</span>
                <span className="font-mono text-white">Up / Down</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wrist</span>
                <span className="font-mono text-white">Left / Right</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wrist Roll</span>
                <span className="font-mono text-white">Q / E</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gripper Open</span>
                <span className="font-mono text-white">Space</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gripper Close</span>
                <span className="font-mono text-white">Shift</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-orange-500/30 p-6">
            <h3 className="text-lg font-bold text-orange-400 mb-4">Gamepad (Xbox Layout)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Base/Shoulder</span>
                <span className="font-mono text-white">Left Stick</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Elbow/Wrist</span>
                <span className="font-mono text-white">Right Stick</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wrist Roll</span>
                <span className="font-mono text-white">LB / RB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Close Gripper</span>
                <span className="font-mono text-white">LT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Open Gripper</span>
                <span className="font-mono text-white">RT</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Serial Protocol */}
      <section className="relative px-8 py-12 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <Cpu className="w-6 h-6 text-cyan-400" />
          Hardware Protocol Reference
        </h2>
        <div className="bg-slate-900/50 border border-cyan-500/30 p-6">
          <h3 className="text-lg font-bold text-cyan-400 mb-4">Serial Command Format</h3>
          <p className="text-slate-400 text-sm mb-4">
            RoboSim sends servo positions as PWM microsecond values over serial at the configured baud rate.
          </p>
          <div className="bg-slate-950 p-4 rounded font-mono text-sm">
            <code className="text-cyan-300">J0:1500,J1:1500,J2:1500,J3:1500,J4:1500,J5:1500\n</code>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-bold text-white mb-2">Joint Mapping</h4>
              <ul className="text-slate-500 space-y-1">
                <li>J0 = Base (shoulder_pan)</li>
                <li>J1 = Shoulder (shoulder_lift)</li>
                <li>J2 = Elbow (elbow_flex)</li>
                <li>J3 = Wrist (wrist_flex)</li>
                <li>J4 = Wrist Roll (wrist_roll)</li>
                <li>J5 = Gripper</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-2">PWM Range</h4>
              <ul className="text-slate-500 space-y-1">
                <li>500 = Joint minimum</li>
                <li>1500 = Joint center</li>
                <li>2500 = Joint maximum</li>
                <li>Newline terminates each command</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-8 py-16 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-black text-white mb-4">Ready to Start?</h2>
        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
          Jump into the simulator and try these features yourself.
          No installation required - everything runs in your browser.
        </p>
        <button
          onClick={onGetStarted}
          className="bg-green-500 text-white px-10 py-4 text-xl font-bold transition hover:bg-green-400 border-2 border-green-500"
          style={{ boxShadow: '4px 4px 0 rgba(34, 197, 94, 0.3)' }}
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
