import React, { useState } from 'react';
import {
  Bot, ArrowLeft, Gamepad2, Mic, Eye, Hand, Brain, Code, Download,
  Keyboard, Mouse, Settings, Play, Save, Database, Box, ChevronDown,
  ChevronRight, Layers, Target, Video, HelpCircle, Monitor,
  Zap, CheckCircle, Lightbulb, BookOpen, ArrowRight, Star,
  MessageSquare, BarChart3, Sparkles
} from 'lucide-react';

interface HowToUsePageProps {
  onBack: () => void;
  onGetStarted: () => void;
}

type Section = 'getting-started' | 'robots' | 'controls' | 'ai' | 'training-data' | 'code' | 'shortcuts' | 'troubleshooting';

export const HowToUsePage: React.FC<HowToUsePageProps> = ({ onBack, onGetStarted }) => {
  const [activeSection, setActiveSection] = useState<Section>('getting-started');
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set(['joint-controls']));

  const togglePanel = (panel: string) => {
    const newExpanded = new Set(expandedPanels);
    if (newExpanded.has(panel)) {
      newExpanded.delete(panel);
    } else {
      newExpanded.add(panel);
    }
    setExpandedPanels(newExpanded);
  };

  const sections = [
    { id: 'getting-started' as Section, label: 'Getting Started', icon: <Play className="w-4 h-4" /> },
    { id: 'robots' as Section, label: 'Robot Types', icon: <Bot className="w-4 h-4" /> },
    { id: 'controls' as Section, label: 'Control Panels', icon: <Settings className="w-4 h-4" /> },
    { id: 'ai' as Section, label: 'AI Features', icon: <Brain className="w-4 h-4" /> },
    { id: 'training-data' as Section, label: 'Training Data for LeRobot', icon: <Database className="w-4 h-4" /> },
    { id: 'code' as Section, label: 'Code Editor', icon: <Code className="w-4 h-4" /> },
    { id: 'shortcuts' as Section, label: 'Keyboard Shortcuts', icon: <Keyboard className="w-4 h-4" /> },
    { id: 'troubleshooting' as Section, label: 'Troubleshooting', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  const controlPanels = [
    {
      id: 'joint-controls',
      name: 'Joint Controls',
      icon: <Settings className="w-5 h-5" />,
      description: 'The Joint Controls panel provides direct, intuitive control over every movable part of your robot. Each joint has a dedicated slider that maps directly to a physical servo or motor on real hardware.',
      background: 'In robotics, joints are the points where two links connect and allow relative motion. Understanding joint control is fundamental to robot programming. Each joint type (revolute for rotation, prismatic for linear motion) has specific limits to prevent mechanical damage.',
      steps: [
        'Locate the Controls panel in the right sidebar',
        'Click to expand if collapsed',
        'Find the joint you want to move (Base, Shoulder, Elbow, etc.)',
        'Drag the slider left or right to change the angle',
        'Watch the robot move in real-time in the 3D viewport',
        'The numerical value updates as you drag, showing exact degrees',
      ],
      useCases: [
        { title: 'Learning Joint Behavior', desc: 'Move each joint individually to understand how it affects robot pose' },
        { title: 'Fine Positioning', desc: 'Make precise adjustments when the robot needs to reach an exact position' },
        { title: 'Teaching Points', desc: 'Manually position the robot and record joint values for programming' },
        { title: 'Debugging', desc: 'Isolate specific joints to diagnose mechanical or programming issues' },
      ],
      examples: [
        { scenario: 'Pick up an object', steps: 'Set Base to 45°, Shoulder to 60°, Elbow to -30°, then close Gripper to 80%' },
        { scenario: 'Home position', steps: 'Set all joints to 0° to return robot to neutral stance' },
      ],
      tips: [
        'Sliders are disabled during animations to prevent conflicts',
        'Joint limits are enforced automatically - you cannot exceed safe ranges',
        'Hold Shift while dragging for finer control (smaller increments)',
      ],
    },
    {
      id: 'advanced-controls',
      name: 'Advanced Controls',
      icon: <Gamepad2 className="w-5 h-5" />,
      description: 'Advanced Controls offers four different interaction modes, letting you control the robot using your preferred input method - from traditional sliders to immersive gamepad control.',
      background: 'Different control modes suit different tasks. Manual control is precise but slow. Click-to-Move uses Inverse Kinematics (IK) to calculate joint angles automatically. Keyboard control enables rapid teleoperation, while Gamepad provides an intuitive gaming-style interface.',
      steps: [
        'Open the Advanced Controls panel in the right sidebar',
        'Select your preferred control mode from the tabs',
        'For Manual: Use sliders as in Joint Controls',
        'For Click-to-Move: Click any point in the 3D scene',
        'For Keyboard: Press the mapped keys (see shortcuts section)',
        'For Gamepad: Connect a controller and use sticks/buttons',
      ],
      useCases: [
        { title: 'Teleoperation Training', desc: 'Practice remote robot operation using keyboard or gamepad before working with real hardware' },
        { title: 'Rapid Prototyping', desc: 'Quickly test robot reach and workspace using Click-to-Move' },
        { title: 'Data Collection', desc: 'Use gamepad for smooth, natural demonstrations when recording datasets' },
        { title: 'Accessibility', desc: 'Choose the input method that works best for your physical setup' },
      ],
      examples: [
        { scenario: 'Keyboard control for arm', steps: 'Press W to raise shoulder, A/D to rotate base, Space to open gripper' },
        { scenario: 'Gamepad for smooth motion', steps: 'Left stick controls base/shoulder, right stick controls elbow/wrist, triggers control gripper' },
        { scenario: 'Click-to-Move for targets', steps: 'Click on a cube in the scene - robot automatically calculates and moves to reach it' },
      ],
      tips: [
        'Gamepad deadzone is set to 0.15 by default - adjust if your controller drifts',
        'Click-to-Move works best when the target is within the robot workspace',
        'Combine modes: use Click-to-Move for rough positioning, then Manual for fine adjustment',
      ],
    },
    {
      id: 'hand-tracking',
      name: 'Hand Tracking',
      icon: <Hand className="w-5 h-5" />,
      description: 'Hand Tracking uses your webcam and MediaPipe to track your hand movements in real-time, translating them into robot commands. Control the robot naturally using gestures.',
      background: 'MediaPipe Hand Tracking detects 21 landmarks on each hand at 30+ FPS. This enables intuitive robot control where your hand position maps to the robot end-effector, and gestures trigger actions like gripper open/close.',
      steps: [
        'Ensure you have a working webcam',
        'Open the Hand Tracking panel',
        'Click "Start Tracking" and allow camera access',
        'Position your hand in the camera view (30-60cm away works best)',
        'Move your hand to control the robot arm position',
        'Use gestures: pinch to close gripper, open hand to release',
        'Click "Stop Tracking" when done',
      ],
      useCases: [
        { title: 'Intuitive Teaching', desc: 'Demonstrate tasks naturally - the robot mirrors your hand movements' },
        { title: 'Accessibility', desc: 'Control robots without keyboards, mice, or specialized hardware' },
        { title: 'Imitation Learning Data', desc: 'Record natural human demonstrations for training AI policies' },
        { title: 'Interactive Demos', desc: 'Engage audiences by controlling robots with hand waves' },
      ],
      examples: [
        { scenario: 'Pick and place demo', steps: 'Move hand over object, pinch to grab, move to destination, open hand to release' },
        { scenario: 'Waving gesture', steps: 'Move hand side to side - robot arm follows and creates a wave motion' },
        { scenario: 'Pointing to targets', steps: 'Point at objects in the scene - robot tracks your pointing direction' },
      ],
      tips: [
        'Good lighting dramatically improves tracking accuracy',
        'Plain backgrounds work better than cluttered ones',
        'The video preview is mirrored for intuitive control',
        'Works only with arm-type robots (not wheeled or drones)',
        'Tracking may lag on slower computers - reduce other browser tabs',
      ],
    },
    {
      id: 'voice-control',
      name: 'Voice Control',
      icon: <Mic className="w-5 h-5" />,
      description: 'Voice Control enables hands-free robot operation using natural speech. Speak commands and the robot executes them, with optional voice feedback to confirm actions.',
      background: 'The Web Speech API provides browser-native speech recognition. Commands are parsed and matched to robot actions. This enables accessibility and hands-free operation during tasks where your hands are occupied.',
      steps: [
        'Use Chrome or Edge browser (required for Web Speech API)',
        'Open the Voice Control panel',
        'Optionally enable the wake word ("Hey Robot")',
        'Click the microphone button to start listening',
        'Speak your command clearly (e.g., "move left")',
        'Wait for the robot to execute',
        'The status indicator shows: listening (green), processing (yellow), speaking (blue)',
        'Click the microphone again to stop',
      ],
      useCases: [
        { title: 'Hands-Free Operation', desc: 'Control robots while your hands are occupied with other tasks' },
        { title: 'Accessibility', desc: 'Enable robot control for users with mobility impairments' },
        { title: 'Assembly Line Demos', desc: 'Issue commands without touching any interface' },
        { title: 'Multi-Tasking', desc: 'Program or take notes while verbally directing the robot' },
      ],
      examples: [
        { scenario: 'Basic movement', steps: 'Say "move forward" - robot extends arm forward. Say "move back" - robot retracts.' },
        { scenario: 'Object manipulation', steps: 'Say "open gripper", then "close gripper" to pick up objects' },
        { scenario: 'Complex actions', steps: 'Say "wave hello" - robot performs a pre-programmed waving sequence' },
        { scenario: 'Position commands', steps: 'Say "go home" to return robot to rest position' },
      ],
      tips: [
        'Speak at normal pace and volume - no need to shout',
        'Reduce background noise for better recognition',
        'If a command isn\'t recognized, try rephrasing',
        'The wake word ("Hey Robot") prevents accidental activation',
        'Voice feedback helps confirm what the system understood',
      ],
    },
    {
      id: 'vision',
      name: 'Vision (Camera)',
      icon: <Eye className="w-5 h-5" />,
      description: 'The Vision panel provides basic computer vision capabilities including live camera feed, color detection, and blob tracking. Essential for visual servoing and object detection tasks.',
      background: 'Color-based vision is a fundamental robotics technique. By detecting colored objects, robots can locate targets, follow lines, and interact with their environment. This panel simulates camera input that would come from a real robot\'s sensors.',
      steps: [
        'Open the Vision panel in the right sidebar',
        'Toggle the camera on to start the video feed',
        'Select a color to detect from the dropdown (Red, Green, Blue, etc.)',
        'Place colored objects in the scene or camera view',
        'The system highlights detected blobs with bounding boxes',
        'Read centroid coordinates and area from the display',
        'Use the "Capture" button to freeze a frame for analysis',
      ],
      useCases: [
        { title: 'Object Localization', desc: 'Find the position of colored objects for pick-and-place tasks' },
        { title: 'Line Following', desc: 'Detect a colored line on the ground for mobile robot navigation' },
        { title: 'Sorting by Color', desc: 'Identify object colors to sort them into different bins' },
        { title: 'Visual Servoing', desc: 'Continuously track an object and move the robot to follow it' },
      ],
      examples: [
        { scenario: 'Find red cube', steps: 'Select "Red" color filter. Red cube centroid appears at (X, Y) coordinates. Robot can use these to calculate approach.' },
        { scenario: 'Line following setup', steps: 'Select "Black" or line color. Position camera downward. IR sensors show left/center/right detection.' },
        { scenario: 'Multi-object scene', steps: 'Cycle through colors to locate different objects. Record positions for task planning.' },
      ],
      tips: [
        'Consistent lighting improves color detection accuracy',
        'Adjust camera position to capture the robot\'s workspace',
        'Use the overlay toggle to show/hide detection visualization',
        'Centroid gives the center of the detected blob - useful for targeting',
        'Area helps distinguish between small and large objects',
      ],
    },
    {
      id: 'vision-analysis',
      name: 'Vision Analysis (AI)',
      icon: <Brain className="w-5 h-5" />,
      description: 'Vision Analysis uses Claude\'s vision capabilities to understand scenes in natural language. Ask questions about what\'s in the viewport and get intelligent, contextual answers.',
      background: 'Large Language Models with vision (VLMs) can understand images and answer questions about them. This goes far beyond simple color detection - the AI can identify objects, understand spatial relationships, suggest actions, and describe scenes in detail.',
      steps: [
        'Ensure your Claude API key is configured in the Chat panel settings',
        'Open the Vision Analysis panel',
        'Click one of the quick question buttons, or type a custom question',
        'Wait for the AI to analyze the current viewport',
        'Review the response including detected objects and suggestions',
        'Use the information to plan robot actions',
      ],
      useCases: [
        { title: 'Scene Understanding', desc: 'Get a complete description of what\'s visible in the workspace' },
        { title: 'Object Identification', desc: 'Ask "What objects can the robot pick up?" for manipulation planning' },
        { title: 'Spatial Reasoning', desc: 'Ask "Where is the red cube relative to the blue sphere?"' },
        { title: 'Task Planning', desc: 'Ask "How should I arrange these objects?" for guidance' },
        { title: 'Anomaly Detection', desc: 'Ask "Is anything out of place?" to spot issues' },
      ],
      examples: [
        { scenario: 'Identify grabbable objects', steps: 'Ask "What can the robot pick up?" AI responds: "I can see a red cube (5cm), a yellow ball (3cm radius), and a metal can. All appear grabbable."' },
        { scenario: 'Get spatial layout', steps: 'Ask "Describe the scene layout" AI responds: "The red cube is in the front-left, approximately 20cm from the robot base. The ball is behind it to the right."' },
        { scenario: 'Plan a task', steps: 'Ask "What\'s the best order to pick up these objects?" AI suggests optimal sequence based on positions.' },
      ],
      tips: [
        'More specific questions get more useful answers',
        'The AI sees a snapshot of the current viewport - position camera for best view',
        'Confidence scores indicate how certain the AI is about detections',
        'Combine with Voice Control: ask questions verbally and hear responses',
        'API calls have latency - be patient for complex analysis',
      ],
    },
    {
      id: 'numerical-ik',
      name: 'Numerical IK',
      icon: <Target className="w-5 h-5" />,
      description: 'The Numerical IK (Inverse Kinematics) panel calculates the joint angles needed to position the robot\'s end-effector at a specific target point in 3D space.',
      background: 'Inverse Kinematics is a core robotics problem: given a desired end-effector position, what joint angles achieve it? For robots with many joints, there may be multiple solutions or none. Numerical methods iteratively converge on solutions.',
      steps: [
        'Open the Numerical IK panel',
        'Choose a solver: DLS (stable) or CCD (fast)',
        'Enter target X, Y, Z coordinates in meters',
        'Or click "Use Current" to capture the current gripper position',
        'Adjust solver parameters if needed (iterations, tolerance, damping)',
        'Click "Solve IK" for a single solution attempt',
        'Click "Multi-Start" to try 5 different starting configurations',
        'Review the solution diagnostics (manipulability, convergence)',
        'Click "Animate" to smoothly move to the solved position',
      ],
      useCases: [
        { title: 'Precise Positioning', desc: 'Move the gripper to exact coordinates for assembly tasks' },
        { title: 'Workspace Analysis', desc: 'Test which points the robot can reach and which are out of bounds' },
        { title: 'Path Planning', desc: 'Calculate waypoints for complex trajectories' },
        { title: 'Education', desc: 'Understand how IK solvers work and their limitations' },
        { title: 'Calibration', desc: 'Verify robot accuracy by commanding specific positions' },
      ],
      examples: [
        { scenario: 'Reach a specific point', steps: 'Enter X=0.15, Y=0.10, Z=0.20. Click Solve. Robot calculates and moves gripper to that position.' },
        { scenario: 'Handle singularities', steps: 'Target near workspace edge may fail. Use Multi-Start to find alternative configurations. Increase damping if solver oscillates.' },
        { scenario: 'Smooth motion to target', steps: 'Solve IK first, then click "Animate Trajectory" for smooth interpolated motion instead of instant jump.' },
      ],
      tips: [
        'DLS (Damped Least Squares) is more stable near singularities',
        'CCD (Cyclic Coordinate Descent) is faster but may find suboptimal solutions',
        'Manipulability score > 0.1 indicates a good, non-singular pose',
        'If solution fails, try a nearby target - you may be at workspace limits',
        'Multi-Start increases chances of finding a solution but takes longer',
      ],
    },
    {
      id: 'multi-robot',
      name: 'Multi-Robot',
      icon: <Layers className="w-5 h-5" />,
      description: 'The Multi-Robot panel lets you create and manage multiple robot instances (up to 8) for swarm simulation, coordinated tasks, and collaborative robotics experiments.',
      background: 'Multi-robot systems enable tasks impossible for single robots: parallel processing, distributed sensing, and collaborative manipulation. This panel supports swarm robotics research and coordinated control algorithms.',
      steps: [
        'Open the Multi-Robot panel',
        'Click the + button to add a new robot instance',
        'Or click "Clone" to duplicate the currently selected robot with its pose',
        'Click on a robot in the list to select it (makes it active for control)',
        'Use the eye icon to toggle visibility of specific robots',
        'Use the trash icon to remove a robot',
        'Select a formation pattern to automatically arrange robots',
        'Control the active robot using any control method',
      ],
      useCases: [
        { title: 'Swarm Robotics', desc: 'Simulate coordinated behavior with multiple robots moving in formation' },
        { title: 'Parallel Tasks', desc: 'Have multiple robots work on different parts of a task simultaneously' },
        { title: 'Comparison Testing', desc: 'Set up identical robots to test different control algorithms' },
        { title: 'Collaborative Manipulation', desc: 'Two robots working together to carry large objects' },
        { title: 'Coverage Planning', desc: 'Distribute robots to cover a large area for inspection' },
      ],
      examples: [
        { scenario: 'Line formation', steps: 'Add 4 robots. Select "Line" formation. Robots arrange in a row. Move formation forward together.' },
        { scenario: 'Circle patrol', steps: 'Add 6 robots. Select "Circle" formation. Robots form a ring. Useful for perimeter monitoring demos.' },
        { scenario: 'Clone and compare', steps: 'Position robot perfectly. Click Clone. Now you have two identical robots to test different approaches.' },
      ],
      tips: [
        'Maximum 8 robots to maintain performance',
        'Only the selected (active) robot responds to controls',
        'Formations automatically calculate spacing based on robot count',
        'Hide robots you\'re not using to reduce visual clutter',
        'Each robot has independent joint state - they don\'t mirror automatically',
      ],
    },
    {
      id: 'ai-environment',
      name: 'AI Environment Generator',
      icon: <Box className="w-5 h-5" />,
      description: 'Generate custom backgrounds, textures, and 3D objects using Google Gemini AI. Create unique simulation environments without any 3D modeling skills.',
      background: 'Generative AI can create images and textures on demand. This enables rapid creation of diverse training environments for robot learning, or custom scenes for specific applications without sourcing or creating assets manually.',
      steps: [
        'Ensure your Google Gemini API key is configured',
        'Open the AI Environment panel',
        'Choose a tab: Background, Texture, or Object',
        'For backgrounds: Enter a description or select a preset, choose style/mood, click Generate',
        'For textures: Select surface type (floor/wall), describe material, generate',
        'For objects: Describe the object, select base shape, generate and spawn',
        'Preview the result before applying to the scene',
        'Click Apply or Spawn to add to your simulation',
      ],
      useCases: [
        { title: 'Domain Randomization', desc: 'Generate varied backgrounds for robust AI training' },
        { title: 'Custom Environments', desc: 'Create specific scenarios: warehouse, kitchen, lab, outdoor' },
        { title: 'Rapid Prototyping', desc: 'Quickly visualize how robots would look in different settings' },
        { title: 'Education', desc: 'Generate engaging visuals for robotics demonstrations' },
        { title: 'Testing', desc: 'Create challenging textures and lighting to test vision systems' },
      ],
      examples: [
        { scenario: 'Industrial setting', steps: 'Background tab: Enter "modern factory floor with conveyor belts". Style: Realistic. Mood: Bright. Generate and apply.' },
        { scenario: 'Wooden floor texture', steps: 'Texture tab: Surface: Floor. Description: "worn oak wood planks with visible grain". Generate seamless texture.' },
        { scenario: 'Custom object', steps: 'Object tab: Description: "red apple with a small leaf". Shape: Sphere. Style: Realistic. Generate and spawn in scene.' },
      ],
      tips: [
        'More detailed descriptions produce better results',
        'Style options: Realistic, Cartoon, Abstract, Minimalist',
        'Mood affects lighting feel: Bright, Dark, Warm, Cool',
        'Generated textures are seamless - they tile without visible edges',
        'Presets provide quick starting points you can customize',
      ],
    },
    {
      id: 'text-to-3d',
      name: 'Text-to-3D',
      icon: <Box className="w-5 h-5" />,
      description: 'Generate 3D objects from text descriptions. Describe what you need and the system creates geometric primitives with appropriate colors and textures.',
      background: 'While full text-to-3D mesh generation is computationally intensive, this panel uses intelligent primitive selection and texturing to quickly create useful objects. Great for populating scenes with common items.',
      steps: [
        'Open the Text-to-3D panel',
        'Type a description of the object you want (e.g., "red apple")',
        'Or click a preset button for common objects',
        'Select a style: Realistic, Cartoon, Low-Poly, or Voxel',
        'Adjust the scale slider (0.5x to 3.0x)',
        'Toggle AI Texture if you want generated surface details',
        'Click Generate',
        'The object appears in your scene, ready for interaction',
      ],
      useCases: [
        { title: 'Scene Population', desc: 'Quickly add objects for pick-and-place practice' },
        { title: 'Training Data Variety', desc: 'Generate diverse objects for robust policy training' },
        { title: 'Prototyping Tasks', desc: 'Create placeholder objects to design manipulation sequences' },
        { title: 'Education', desc: 'Generate objects for teaching demos without sourcing 3D models' },
        { title: 'Testing Grasping', desc: 'Create objects of various sizes and shapes to test gripper capabilities' },
      ],
      examples: [
        { scenario: 'Fruit for sorting task', steps: 'Generate "red apple", "yellow banana", "orange orange". Now you have objects to sort by color or type.' },
        { scenario: 'Industrial parts', steps: 'Generate "metal cylinder", "wooden box", "plastic bottle". Test manipulation of different materials.' },
        { scenario: 'Scale comparison', steps: 'Generate same object at 0.5x, 1.0x, and 2.0x scale to test size-adaptive grasping.' },
      ],
      tips: [
        'Simple descriptions work best: "red cube", "blue ball", "metal can"',
        'Presets are optimized for common robotics scenarios',
        'Generated objects are automatically marked as grabbable',
        'Use "Clear All" to remove all generated objects at once',
        'Low-Poly style renders faster if you have many objects',
      ],
    },
    {
      id: 'dataset-recorder',
      name: 'Dataset Recorder',
      icon: <Video className="w-5 h-5" />,
      description: 'Record robot demonstrations to create training datasets for imitation learning. Compatible with HuggingFace LeRobot format for direct use in ML pipelines.',
      background: 'Imitation learning trains robot policies by watching human demonstrations. The Dataset Recorder captures joint states at 30Hz, optionally with video, in formats compatible with state-of-the-art learning frameworks like LeRobot.',
      steps: [
        'Open the Dataset Recorder panel',
        'Enter a task name describing what you\'ll demonstrate',
        'Select the recording format (LeRobot v3.0 recommended)',
        'Toggle video recording if you want visual data',
        'Click "Record" to start capturing',
        'Perform your demonstration using any control method',
        'Watch the frame counter to track recording progress',
        'Click "Stop" when the demonstration is complete',
        'Mark the episode as Success or Fail',
        'Export the dataset for use in training',
      ],
      useCases: [
        { title: 'Imitation Learning', desc: 'Create datasets to train policies that mimic your demonstrations' },
        { title: 'Behavior Cloning', desc: 'Record expert trajectories for supervised learning approaches' },
        { title: 'Reinforcement Learning', desc: 'Use demonstrations to initialize or guide RL training' },
        { title: 'Benchmarking', desc: 'Record standardized demonstrations to compare different methods' },
        { title: 'Documentation', desc: 'Capture robot behaviors for analysis and review' },
      ],
      examples: [
        { scenario: 'Pick and place dataset', steps: 'Task name: "pick_red_cube". Record 50 successful demonstrations of picking up red cube and placing in bin.' },
        { scenario: 'Multi-task dataset', steps: 'Record separate episodes for different tasks. Label each clearly. Export combined dataset.' },
        { scenario: 'Failure examples', steps: 'Record both successes and failures. Mark appropriately. Failure data helps models learn boundaries.' },
      ],
      tips: [
        '30 FPS captures smooth motion - most tasks need 50-100 frames',
        'LeRobot format uploads directly to HuggingFace Hub',
        'Consistent start/end positions improve learning',
        'Record multiple variations of the same task for robustness',
        'Video data increases file size significantly - use only when needed',
      ],
    },
    {
      id: 'save-load',
      name: 'Save/Load',
      icon: <Save className="w-5 h-5" />,
      description: 'Save your simulation state to browser storage or export to files. Resume your work later or share configurations with others.',
      background: 'Simulation state includes robot positions, joint angles, spawned objects, code, and settings. Saving lets you preserve your work, create checkpoints, and share scenarios with collaborators.',
      steps: [
        'Open the Save/Load panel',
        'To save: Click "New Save" and enter a descriptive name',
        'Your current state is stored in one of 10 slots',
        'To load: Click on a saved slot, then "Load"',
        'Use "Export" to download a JSON file of any save',
        'Use "Import" to load a JSON file from disk',
        'Auto-save captures your state periodically',
        'Click "Load Auto-Save" to recover from crashes or browser closes',
      ],
      useCases: [
        { title: 'Work Continuity', desc: 'Save progress and continue later without losing setup' },
        { title: 'Checkpoints', desc: 'Save before experimenting with risky changes' },
        { title: 'Sharing', desc: 'Export state and send to colleagues or students' },
        { title: 'Version Control', desc: 'Save multiple versions of a configuration' },
        { title: 'Demo Preparation', desc: 'Save perfectly configured scenes for presentations' },
      ],
      examples: [
        { scenario: 'Daily workflow', steps: 'At end of session, "New Save" named "project_dec_6". Next day, load this save to continue.' },
        { scenario: 'Before risky change', steps: 'Save current state. Try experimental modification. If it fails, load previous save.' },
        { scenario: 'Share with team', steps: 'Export save to JSON file. Email to colleague. They import and have identical setup.' },
      ],
      tips: [
        'Auto-save runs every few minutes - good for crash recovery',
        'Descriptive names help find saves later: "task1_working", "demo_final"',
        'Export important saves to files as backup',
        '10 slots may fill up - delete old saves you don\'t need',
        'Saves include code content - good for sharing programs',
      ],
    },
    {
      id: 'policy-browser',
      name: 'Policy Browser (LeRobot)',
      icon: <Database className="w-5 h-5" />,
      description: 'Browse, download, and run pre-trained robot policies from HuggingFace Hub. Execute learned behaviors without any training on your part.',
      background: 'LeRobot is HuggingFace\'s robotics framework with a growing library of trained policies. These ONNX models run directly in your browser using WebAssembly, enabling real-time inference at 20Hz without any setup.',
      steps: [
        'Open the Policy Browser panel',
        'Search for policies by robot type (e.g., "so101") or task (e.g., "pick")',
        'Browse results and check compatibility with your robot',
        'Click on a policy to see details (architecture, task, performance)',
        'Click "Download" to fetch the ONNX model',
        'Wait for download to complete (progress bar shows status)',
        'Click "Run" to start inference',
        'The robot executes the learned policy in real-time',
        'Click "Stop" to end policy execution',
      ],
      useCases: [
        { title: 'Instant Capabilities', desc: 'Give your robot new skills without any training' },
        { title: 'Benchmarking', desc: 'Compare your custom policies against published baselines' },
        { title: 'Learning', desc: 'See how trained policies behave to inform your own development' },
        { title: 'Demos', desc: 'Impressive demonstrations without weeks of training' },
        { title: 'Transfer Learning', desc: 'Start from a working policy and fine-tune for your task' },
      ],
      examples: [
        { scenario: 'Run a pick-place policy', steps: 'Search "so101 pick". Download compatible policy. Place objects in scene. Run policy. Robot attempts to pick and place.' },
        { scenario: 'Try different architectures', steps: 'Search for ACT policy and Diffusion policy for same task. Compare behavior and smoothness.' },
        { scenario: 'Test robustness', steps: 'Run policy. Move objects to unexpected positions. See how policy handles variation.' },
      ],
      tips: [
        'Filter by robot type first to ensure compatibility',
        'Larger models take longer to download but may perform better',
        '20Hz inference rate matches typical robot control frequency',
        'Policy expects scene similar to training - results vary with different setups',
        'ONNX Runtime uses WebAssembly - modern browsers only',
      ],
    },
  ];

  const robots = [
    {
      name: 'SO-101 Robot Arm',
      dof: '6-DOF',
      status: 'available',
      description: 'A desktop robotic arm from The Robot Studio. The SO-101 is an affordable, open-source arm designed for education and research. It uses STS3215 servo motors with a 1:345 gear ratio for precise control.',
      background: 'Desktop robot arms are essential tools for learning manipulation, testing algorithms, and prototyping applications. The SO-101 bridges simulation and real hardware - code you write here can export directly to physical SO-101 arms.',
      joints: [
        { name: 'Base', range: '±110°', desc: 'Rotates the entire arm left/right around the vertical axis' },
        { name: 'Shoulder', range: '±100°', desc: 'Lifts the upper arm up/down, major vertical positioning' },
        { name: 'Elbow', range: '±97°', desc: 'Bends the forearm, extends reach or retracts' },
        { name: 'Wrist Pitch', range: '±95°', desc: 'Tilts the gripper up/down for approach angle' },
        { name: 'Wrist Roll', range: '-157° to +163°', desc: 'Rotates the gripper for orientation control' },
        { name: 'Gripper', range: '0-100%', desc: 'Opens (0%) to fully closed (100%) for grasping' },
      ],
      useCases: [
        'Pick and place operations',
        'LeRobot teleoperation and training',
        'Imitation learning research',
        'Educational demonstrations',
        'Sorting and packaging tasks',
      ],
      gettingStarted: [
        'The SO-101 loads by default when you start RoboSim',
        'Use Joint Controls to familiarize yourself with each axis',
        'Try the preset buttons: Home, Wave, Pick, Scan',
        'Move to Click-to-Move mode for point-and-click control',
        'Record a demonstration using the Dataset Recorder',
      ],
    },
    {
      name: '4WD Wheeled Robot',
      dof: '3 Controls',
      status: 'coming_soon',
      description: 'A four-wheel drive mobile robot with differential steering. Independent left/right motor control enables tank-style turning. Includes a head servo for camera panning.',
      background: 'Wheeled mobile robots are fundamental to autonomous navigation, delivery, and exploration. Differential drive (skid steering) is simple yet capable of complex maneuvers.',
      joints: [
        { name: 'Left Motor', range: '-255 to +255', desc: 'Controls left wheel speed and direction' },
        { name: 'Right Motor', range: '-255 to +255', desc: 'Controls right wheel speed and direction' },
        { name: 'Head Servo', range: '±90°', desc: 'Pans the camera/sensor head left and right' },
      ],
      useCases: [
        'Line following algorithms',
        'Obstacle avoidance',
        'Maze solving',
        'Autonomous navigation',
        'Mapping and exploration',
      ],
      gettingStarted: [
        'Select "Wheeled Robot" from the robot selector (coming soon)',
        'Use motor sliders to drive forward (both positive) or turn (opposite values)',
        'Set up line sensors to detect colored tracks',
        'Use vision for obstacle detection',
        'Program autonomous behaviors in the Code Editor',
      ],
    },
    {
      name: 'Quadcopter Drone',
      dof: '4 Controls',
      status: 'coming_soon',
      description: 'A four-rotor aerial vehicle with full 6-DOF movement capability. Flight controls map to throttle (altitude), roll, pitch, and yaw for intuitive piloting.',
      background: 'Quadcopters are the most common drone configuration, offering excellent maneuverability and stability. Understanding their control is essential for aerial robotics.',
      joints: [
        { name: 'Throttle', range: '0-100%', desc: 'Controls altitude by adjusting overall lift' },
        { name: 'Roll', range: '±45°', desc: 'Tilts left/right for lateral movement' },
        { name: 'Pitch', range: '±45°', desc: 'Tilts forward/backward for directional flight' },
        { name: 'Yaw', range: '±180°', desc: 'Rotates the drone around its vertical axis' },
      ],
      useCases: [
        'Aerial photography simulation',
        'Waypoint navigation',
        'Terrain mapping',
        'Inspection tasks',
        'Search and rescue scenarios',
      ],
      gettingStarted: [
        'Select "Drone" from the robot selector (coming soon)',
        'Click "Arm" to enable motors',
        'Increase throttle to take off',
        'Use roll/pitch for movement, yaw for rotation',
        'Click "Land" for safe autonomous landing',
      ],
    },
    {
      name: 'Berkeley Humanoid',
      dof: '22-DOF',
      status: 'coming_soon',
      description: 'An open-source bipedal humanoid robot inspired by Berkeley Humanoid. Standing 0.8m tall and weighing 16kg, it features articulated legs, arms, and torso for human-like motion.',
      background: 'Humanoid robots face unique challenges: balance, bipedal locomotion, and human-robot interaction. The high degree of freedom enables expressive movements but requires sophisticated control.',
      joints: [
        { name: 'Hip Pitch/Roll', range: '±60°/±30°', desc: 'Leg rotation for walking and balance' },
        { name: 'Knee', range: '0° to 120°', desc: 'Leg bending for steps and squats' },
        { name: 'Ankle', range: 'Pitch/Roll', desc: 'Foot positioning for stability' },
        { name: 'Shoulder', range: '-180° to +60°', desc: 'Arm positioning and reaching' },
        { name: 'Elbow', range: '0° to 135°', desc: 'Arm bending for manipulation' },
        { name: 'Wrist', range: '±90°', desc: 'Hand orientation control' },
      ],
      useCases: [
        'Walking pattern generation',
        'Balance control algorithms',
        'Human-robot interaction research',
        'Gesture recognition and generation',
        'Assistive robotics development',
      ],
      gettingStarted: [
        'Select "Humanoid" from the robot selector (coming soon)',
        'Start with "Reset Pose" for a stable standing position',
        'Try individual joint movements to understand kinematics',
        'Use "Walk" toggle for pre-programmed locomotion',
        'Experiment with upper body gestures while maintaining balance',
      ],
    },
  ];

  const keyboardShortcuts = [
    { category: 'Robot Control (Keyboard Mode)', description: 'When Advanced Controls is set to Keyboard mode, use these keys to control the arm robot in real-time.', shortcuts: [
      { keys: 'W / S', action: 'Shoulder up/down', detail: 'Raises or lowers the upper arm' },
      { keys: 'A / D', action: 'Base left/right', detail: 'Rotates the entire arm' },
      { keys: '↑ / ↓', action: 'Elbow up/down', detail: 'Extends or retracts the forearm' },
      { keys: '← / →', action: 'Wrist pitch', detail: 'Tilts the gripper up/down' },
      { keys: 'Q / E', action: 'Wrist roll', detail: 'Rotates the gripper orientation' },
      { keys: 'Space', action: 'Open gripper', detail: 'Releases held objects' },
      { keys: 'Shift', action: 'Close gripper', detail: 'Grasps objects' },
    ]},
    { category: 'Code Editor', description: 'Standard editor shortcuts plus AI-powered features for code generation and explanation.', shortcuts: [
      { keys: 'Ctrl+S', action: 'Save code', detail: 'Saves current code to browser storage' },
      { keys: 'Ctrl+Z', action: 'Undo', detail: 'Reverses last edit' },
      { keys: 'Ctrl+Shift+Z', action: 'Redo', detail: 'Re-applies undone edit' },
      { keys: 'Ctrl+/', action: 'Toggle comment', detail: 'Comments/uncomments selected lines' },
      { keys: 'Ctrl+Shift+G', action: 'Generate from comment', detail: 'AI generates code from your comment' },
      { keys: 'Ctrl+Shift+E', action: 'Explain selection', detail: 'AI explains selected code' },
    ]},
    { category: 'General', description: 'Application-wide shortcuts for common actions.', shortcuts: [
      { keys: 'Enter', action: 'Send chat message', detail: 'Sends your typed message to AI' },
      { keys: 'Escape', action: 'Cancel action', detail: 'Cancels current operation' },
    ]},
  ];

  const troubleshooting = [
    {
      issue: 'Voice Control Not Working',
      description: 'The microphone button doesn\'t respond or speech isn\'t recognized.',
      solutions: [
        'Use Chrome or Edge browser - Firefox and Safari don\'t support Web Speech API',
        'Click the microphone icon in the address bar to allow microphone access',
        'Speak clearly at normal volume - no need to shout',
        'Reduce background noise in your environment',
        'Check that the status indicator shows green "Listening" state',
        'Try refreshing the page if the microphone seems stuck',
      ],
    },
    {
      issue: 'Hand Tracking Not Detecting',
      description: 'The camera feed shows but hands aren\'t being tracked.',
      solutions: [
        'Ensure camera permission is granted (check browser address bar)',
        'Improve lighting - hand tracking needs good visibility',
        'Use a plain, contrasting background behind your hands',
        'Position hands 30-60cm from camera (not too close or far)',
        'Keep hands fully in frame - partial views track poorly',
        'Close other applications using the camera',
      ],
    },
    {
      issue: 'Robot Not Moving',
      description: 'Slider changes or commands don\'t move the robot.',
      solutions: [
        'Wait for any current animation to complete (sliders may be locked)',
        'Check if joint values are already at their limits',
        'Look for red self-collision warnings in the console',
        'Verify the correct robot is selected (in Multi-Robot mode)',
        'Check for JavaScript errors in the browser console (F12)',
        'Try resetting to home position, then moving again',
      ],
    },
    {
      issue: 'AI Features Not Responding',
      description: 'Chat, Vision Analysis, or Code Copilot doesn\'t work.',
      solutions: [
        'Verify your API key is entered correctly in Chat settings',
        'Claude API keys start with "sk-ant-api03-" or similar',
        'Check your API account has available credits/quota',
        'Ensure you have internet connectivity',
        'Wait a moment - AI responses can take 2-5 seconds',
        'Try a simpler query first to test the connection',
      ],
    },
    {
      issue: 'Code Execution Errors',
      description: 'Code in the editor fails to run or produces errors.',
      solutions: [
        'Check for syntax errors (red squiggly lines in editor)',
        'Ensure you\'re using the correct Robot API method names',
        'Add "await" before async operations like robot.wait()',
        'Check the console output for specific error messages',
        'Start with a simple template to verify basic execution',
        'Make sure the robot type matches the code (arm vs wheeled)',
      ],
    },
    {
      issue: 'Performance Issues / Lag',
      description: 'The simulation runs slowly or freezes.',
      solutions: [
        'Close unused browser tabs to free memory',
        'Reduce the number of spawned objects in the scene',
        'Use fewer robot instances (Multi-Robot panel)',
        'Lower the physics quality in settings if available',
        'Disable video recording when not needed',
        'Try a browser with better WebGL support (Chrome recommended)',
      ],
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
      <section className="relative px-8 pt-8 pb-8 max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
          <span className="text-blue-400">Advanced</span> Features
        </h1>
        <p className="text-xl text-slate-400 max-w-3xl">
          Deep dive into all controls, features, and capabilities in RoboSim. Manual controls,
          code editor, voice control, vision AI, and more.
        </p>
      </section>

      {/* Main Content */}
      <section className="relative px-8 pb-16 max-w-7xl mx-auto">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-8 space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left font-medium transition border-2 ${
                    activeSection === section.id
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-slate-900/50 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {section.icon}
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {/* Getting Started */}
            {activeSection === 'getting-started' && (
              <div className="space-y-8">
                {/* Introduction */}
                <div className="bg-slate-900/50 border-2 border-blue-500/30 p-6">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <BookOpen className="w-6 h-6 text-blue-400" />
                    Welcome to RoboSim
                  </h2>
                  <p className="text-slate-300 mb-4">
                    RoboSim is an AI-native robotics simulation platform that runs entirely in your browser.
                    No installation, no downloads, no complex setup. Just open the page and start building robot skills.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-slate-800/50 p-4 border border-slate-700">
                      <Zap className="w-8 h-8 text-yellow-400 mb-2" />
                      <h4 className="font-bold text-white mb-1">Instant Start</h4>
                      <p className="text-sm text-slate-400">No installation required. Works in any modern browser.</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 border border-slate-700">
                      <Brain className="w-8 h-8 text-pink-400 mb-2" />
                      <h4 className="font-bold text-white mb-1">AI-Powered</h4>
                      <p className="text-sm text-slate-400">Natural language control, vision AI, and code assistance.</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 border border-slate-700">
                      <Download className="w-8 h-8 text-green-400 mb-2" />
                      <h4 className="font-bold text-white mb-1">Export Ready</h4>
                      <p className="text-sm text-slate-400">Export code to Arduino, Python, and real hardware.</p>
                    </div>
                  </div>
                </div>

                {/* Quick Start */}
                <div className="bg-slate-900/50 border-2 border-green-500/30 p-6">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <Play className="w-6 h-6 text-green-400" />
                    Quick Start Guide
                  </h2>
                  <ol className="space-y-6 text-slate-300">
                    <li className="flex gap-4">
                      <span className="flex-shrink-0 w-10 h-10 bg-green-500 text-white font-bold flex items-center justify-center text-lg">1</span>
                      <div className="flex-1">
                        <p className="font-bold text-white text-lg">Launch the Simulator</p>
                        <p className="text-slate-400 mt-1">Click GET STARTED on the landing page. The simulator loads with the SO-101 Robot Arm ready to control. Use Chrome or Edge for best compatibility.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="flex-shrink-0 w-10 h-10 bg-green-500 text-white font-bold flex items-center justify-center text-lg">2</span>
                      <div className="flex-1">
                        <p className="font-bold text-white text-lg">Move the Robot</p>
                        <p className="text-slate-400 mt-1">Find the Controls panel in the right sidebar. Drag any joint slider to move that part of the robot. Watch it move in real-time in the 3D viewport. Try the Base slider to rotate the arm.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="flex-shrink-0 w-10 h-10 bg-green-500 text-white font-bold flex items-center justify-center text-lg">3</span>
                      <div className="flex-1">
                        <p className="font-bold text-white text-lg">Talk to the AI</p>
                        <p className="text-slate-400 mt-1">Look at the Chat panel in the bottom-right. Type a command like "wave hello" or "pick up the cube" and press Enter. The AI understands natural language and controls the robot for you.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="flex-shrink-0 w-10 h-10 bg-green-500 text-white font-bold flex items-center justify-center text-lg">4</span>
                      <div className="flex-1">
                        <p className="font-bold text-white text-lg">Run Some Code</p>
                        <p className="text-slate-400 mt-1">The Code Editor is in the bottom-left. Try loading a template from the dropdown, then click the green Run button. Watch the robot execute your program step by step.</p>
                      </div>
                    </li>
                    <li className="flex gap-4">
                      <span className="flex-shrink-0 w-10 h-10 bg-green-500 text-white font-bold flex items-center justify-center text-lg">5</span>
                      <div className="flex-1">
                        <p className="font-bold text-white text-lg">Explore and Experiment</p>
                        <p className="text-slate-400 mt-1">Try the preset buttons (Home, Wave, Pick, Scan). Open different control panels. Generate 3D objects. Record a dataset. The best way to learn is by doing!</p>
                      </div>
                    </li>
                  </ol>
                </div>

                {/* Interface Overview */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-purple-400" />
                    Interface Layout
                  </h3>
                  <div className="font-mono text-sm bg-slate-950 p-4 rounded text-slate-300 overflow-x-auto mb-4">
                    <pre>{`┌─────────────────────────────────────────────────────────────────┐
│  Logo    Features    How It Works    Learn More    GET STARTED  │
├─────────────────────────────────────────────────────────────────┤
│                                              │                  │
│                                              │  Control Panels  │
│           3D Simulation Viewport             │  (collapsible)   │
│           - Robot visualization              │  - Joint Controls│
│           - Physics objects                  │  - Voice Control │
│           - Environment                      │  - Vision, IK... │
│                                              │                  │
├──────────────────────────────────────────────┴──────────────────┤
│  Code Editor                │           Chat Panel              │
│  - Write JavaScript         │         - Talk to AI              │
│  - Run programs             │         - Get suggestions         │
│  - Export to hardware       │         - Ask questions           │
└─────────────────────────────┴───────────────────────────────────┘`}</pre>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-blue-400 mb-2">Left Side</h4>
                      <ul className="text-sm text-slate-400 space-y-1">
                        <li>• Code Editor for programming</li>
                        <li>• Console output below</li>
                        <li>• Run/Stop buttons</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-400 mb-2">Right Side</h4>
                      <ul className="text-sm text-slate-400 space-y-1">
                        <li>• Collapsible control panels</li>
                        <li>• Chat panel for AI interaction</li>
                        <li>• Quick preset buttons</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 3D Viewport Controls */}
                <div className="bg-slate-900/50 border-2 border-cyan-500/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <Mouse className="w-5 h-5 text-cyan-400" />
                    3D Viewport Navigation
                  </h3>
                  <p className="text-slate-400 mb-4">
                    The 3D viewport is your window into the simulation. Use your mouse to navigate around the scene and view the robot from any angle.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-4 border border-slate-700">
                      <p className="font-bold text-white mb-1">Rotate View</p>
                      <p className="text-sm text-slate-400 mb-2">Left-click and drag</p>
                      <p className="text-xs text-slate-500">Orbits the camera around the scene center. Great for inspecting the robot from different angles.</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 border border-slate-700">
                      <p className="font-bold text-white mb-1">Pan View</p>
                      <p className="text-sm text-slate-400 mb-2">Right-click and drag</p>
                      <p className="text-xs text-slate-500">Moves the camera parallel to the view plane. Useful for centering on specific areas.</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 border border-slate-700">
                      <p className="font-bold text-white mb-1">Zoom</p>
                      <p className="text-sm text-slate-400 mb-2">Scroll wheel</p>
                      <p className="text-xs text-slate-500">Moves closer or farther from the scene. Scroll up to zoom in, down to zoom out.</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 border border-slate-700">
                      <p className="font-bold text-white mb-1">Reset View</p>
                      <p className="text-sm text-slate-400 mb-2">Double-click</p>
                      <p className="text-xs text-slate-500">Returns to the default camera position if you get lost navigating.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Robot Types */}
            {activeSection === 'robots' && (
              <div className="space-y-8">
                <div className="bg-slate-900/50 border-2 border-blue-500/30 p-6">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <Bot className="w-6 h-6 text-blue-400" />
                    Supported Robots
                  </h2>
                  <p className="text-slate-400">
                    RoboSim supports multiple robot types, each with unique capabilities and control schemes.
                    The SO-101 Robot Arm is currently available, with more robots coming soon.
                  </p>
                </div>

                {robots.map((robot) => (
                  <div
                    key={robot.name}
                    className={`bg-slate-900/50 border-2 p-6 ${
                      robot.status === 'available'
                        ? 'border-blue-500/30'
                        : 'border-slate-700/30 opacity-90'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className={`text-2xl font-bold ${
                        robot.status === 'available' ? 'text-blue-400' : 'text-slate-400'
                      }`}>
                        {robot.name}
                      </h3>
                      <span className="text-xs font-bold bg-slate-700 px-2 py-1 text-slate-300">
                        {robot.dof}
                      </span>
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

                    {/* Description */}
                    <p className="text-slate-300 mb-4">{robot.description}</p>

                    {/* Background */}
                    <div className="bg-slate-800/50 p-4 mb-4 border-l-4 border-blue-500">
                      <p className="text-sm text-slate-400 italic">{robot.background}</p>
                    </div>

                    {/* Joint Table */}
                    <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-purple-400" />
                      Joint Specifications
                    </h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 text-slate-300 font-semibold">Joint</th>
                            <th className="text-left py-2 text-slate-300 font-semibold">Range</th>
                            <th className="text-left py-2 text-slate-300 font-semibold">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {robot.joints.map((joint) => (
                            <tr key={joint.name} className="border-b border-slate-800">
                              <td className="py-2 text-white font-medium">{joint.name}</td>
                              <td className="py-2 text-blue-400 font-mono">{joint.range}</td>
                              <td className="py-2 text-slate-400">{joint.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Use Cases */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-yellow-400" />
                          Use Cases
                        </h4>
                        <ul className="text-sm text-slate-400 space-y-1">
                          {robot.useCases.map((uc, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-green-400">•</span>
                              {uc}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                          <Play className="w-4 h-4 text-green-400" />
                          Getting Started
                        </h4>
                        <ol className="text-sm text-slate-400 space-y-1">
                          {robot.gettingStarted.map((step, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-blue-400 font-mono">{i + 1}.</span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Control Panels */}
            {activeSection === 'controls' && (
              <div className="space-y-6">
                <div className="bg-slate-900/50 border-2 border-purple-500/30 p-6">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <Settings className="w-6 h-6 text-purple-400" />
                    Control Panels Overview
                  </h2>
                  <p className="text-slate-400 mb-4">
                    The right sidebar contains collapsible control panels for every aspect of robot control.
                    Click any panel header to expand it. Multiple panels can be open simultaneously.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {controlPanels.slice(0, 6).map((panel) => (
                      <button
                        key={panel.id}
                        onClick={() => togglePanel(panel.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm border ${
                          expandedPanels.has(panel.id)
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {panel.icon}
                        {panel.name}
                      </button>
                    ))}
                  </div>
                </div>

                {controlPanels.map((panel) => (
                  <div
                    key={panel.id}
                    className="bg-slate-900/50 border-2 border-slate-700/30 overflow-hidden"
                  >
                    <button
                      onClick={() => togglePanel(panel.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/50 transition"
                    >
                      <span className="text-blue-400">{panel.icon}</span>
                      <span className="text-lg font-bold text-white flex-1">{panel.name}</span>
                      {expandedPanels.has(panel.id) ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    {expandedPanels.has(panel.id) && (
                      <div className="px-6 pb-6 border-t border-slate-700/50">
                        {/* Description */}
                        <p className="text-slate-300 mt-4 mb-4">{panel.description}</p>

                        {/* Background */}
                        <div className="bg-slate-800/50 p-4 mb-4 border-l-4 border-purple-500">
                          <h4 className="font-semibold text-purple-400 mb-1 text-sm">Background</h4>
                          <p className="text-sm text-slate-400">{panel.background}</p>
                        </div>

                        {/* Step by Step */}
                        <div className="mb-4">
                          <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-green-400" />
                            Step-by-Step Guide
                          </h4>
                          <ol className="text-sm text-slate-400 space-y-2">
                            {panel.steps.map((step, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 bg-green-500/20 text-green-400 font-bold text-xs flex items-center justify-center rounded-full">
                                  {i + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Use Cases */}
                        <div className="mb-4">
                          <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-yellow-400" />
                            Use Cases & Benefits
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {panel.useCases.map((uc, i) => (
                              <div key={i} className="bg-slate-800/50 p-3 border border-slate-700">
                                <p className="font-medium text-white text-sm">{uc.title}</p>
                                <p className="text-xs text-slate-400 mt-1">{uc.desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Examples */}
                        <div className="mb-4">
                          <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                            <Code className="w-4 h-4 text-cyan-400" />
                            Examples
                          </h4>
                          <div className="space-y-3">
                            {panel.examples.map((ex, i) => (
                              <div key={i} className="bg-slate-950 p-3 border border-slate-800">
                                <p className="font-medium text-cyan-400 text-sm mb-1">{ex.scenario}</p>
                                <p className="text-xs text-slate-400">{ex.steps}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Tips */}
                        <div>
                          <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-400" />
                            Pro Tips
                          </h4>
                          <ul className="text-sm text-slate-400 space-y-1">
                            {panel.tips.map((tip, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-amber-400">★</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* AI Features */}
            {activeSection === 'ai' && (
              <div className="space-y-8">
                {/* Quick Train - Hero Section */}
                <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/30 border-2 border-purple-500/50 p-6">
                  <div className="flex items-center gap-2 text-purple-300 text-sm font-medium mb-2">
                    <Star className="w-4 h-4" />
                    RECOMMENDED STARTING POINT
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                    Quick Train Flow
                  </h2>
                  <p className="text-slate-300 mb-4">
                    The fastest path from any object to a trained robot policy. Our Apple-inspired one-button wizard guides you through 4 simple steps.
                  </p>

                  {/* Steps */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-800/50 p-3 border border-purple-500/30">
                      <div className="text-lg font-black text-purple-400">1. Add Object</div>
                      <div className="text-xs text-slate-400 mt-1">Pick from 34 standard objects or upload a photo</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 border border-blue-500/30">
                      <div className="text-lg font-black text-blue-400">2. Record Demo</div>
                      <div className="text-xs text-slate-400 mt-1">Chat: "Pick up the block" - auto-records</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 border border-green-500/30">
                      <div className="text-lg font-black text-green-400">3. Generate</div>
                      <div className="text-xs text-slate-400 mt-1">Auto-generate 50 training episodes</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 border border-orange-500/30">
                      <div className="text-lg font-black text-orange-400">4. Upload</div>
                      <div className="text-xs text-slate-400 mt-1">One-click export to HuggingFace</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      No API key needed for standard objects
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      Chat-based recording with auto-stop
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      All advanced tools in slide-out drawer
                    </div>
                  </div>
                </div>

                {/* Overview Panel */}
                <div className="bg-slate-900/50 border-2 border-pink-500/30 p-6">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <Brain className="w-6 h-6 text-pink-400" />
                    AI Features Overview
                  </h2>
                  <p className="text-slate-400 mb-4">
                    RoboSim integrates 12 AI capabilities across control, vision, generation, and training.
                    Control robots with natural language, understand scenes visually, generate 3D content, and create training datasets.
                  </p>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-800/50 p-3 border border-blue-500/30 text-center">
                      <div className="text-2xl font-black text-blue-400">4</div>
                      <div className="text-xs text-slate-400">Control Modes</div>
                      <div className="text-xs text-slate-500 mt-1">Chat, Voice, Copilot, Hand</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 border border-purple-500/30 text-center">
                      <div className="text-2xl font-black text-purple-400">3</div>
                      <div className="text-xs text-slate-400">Vision Models</div>
                      <div className="text-xs text-slate-500 mt-1">Claude, DETR, Blob</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 border border-emerald-500/30 text-center">
                      <div className="text-2xl font-black text-emerald-400">3</div>
                      <div className="text-xs text-slate-400">Generation Tools</div>
                      <div className="text-xs text-slate-500 mt-1">Text, Image, Environment</div>
                    </div>
                    <div className="bg-slate-800/50 p-3 border border-amber-500/30 text-center">
                      <div className="text-2xl font-black text-amber-400">2</div>
                      <div className="text-xs text-slate-400">Training Systems</div>
                      <div className="text-xs text-slate-500 mt-1">LLM→Physics, Policies</div>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div className="flex gap-2 flex-wrap mb-4">
                    <a href="#ai-control" className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500/20 border border-blue-500 text-blue-400 hover:bg-blue-500/30 transition">
                      <Zap className="w-4 h-4" />
                      Control
                    </a>
                    <a href="#ai-vision" className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-500/20 border border-purple-500 text-purple-400 hover:bg-purple-500/30 transition">
                      <Eye className="w-4 h-4" />
                      Vision
                    </a>
                    <a href="#ai-generation" className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-500/20 border border-emerald-500 text-emerald-400 hover:bg-emerald-500/30 transition">
                      <Box className="w-4 h-4" />
                      Generation
                    </a>
                    <a href="#ai-training" className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-500/20 border border-amber-500 text-amber-400 hover:bg-amber-500/30 transition">
                      <Database className="w-4 h-4" />
                      Training
                    </a>
                  </div>

                  <div className="bg-slate-800/50 p-4 border-l-4 border-pink-500">
                    <p className="text-sm text-slate-300">
                      <strong>API Keys:</strong> Some AI features require API keys. Enter your Claude API key in Chat settings
                      and/or Gemini API key in AI Environment settings to unlock full capabilities.
                    </p>
                  </div>
                </div>

                {/* AI Control Section Header */}
                <div id="ai-control" className="border-b border-blue-500/30 pb-2">
                  <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    AI Control & Interaction
                  </h3>
                </div>

                {/* Chat Panel */}
                <div className="bg-slate-900/50 border-2 border-blue-500/30 p-6">
                  <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-3">
                    <Zap className="w-5 h-5" />
                    Chat Panel (Claude AI)
                  </h3>

                  <p className="text-slate-300 mb-4">
                    The Chat Panel is your primary interface for natural language robot control. Instead of
                    manually setting joint angles, simply describe what you want the robot to do.
                  </p>

                  <div className="bg-slate-800/50 p-4 mb-4 border-l-4 border-blue-500">
                    <h4 className="font-semibold text-blue-400 mb-1 text-sm">How It Works</h4>
                    <p className="text-sm text-slate-400">
                      Your message is sent to Claude AI along with the current robot state. Claude interprets
                      your intent, generates appropriate robot commands, and executes them. It understands context
                      like "a bit more to the left" or "where you just were."
                    </p>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold text-white mb-2">Setup Steps</h4>
                    <ol className="text-sm text-slate-400 space-y-2">
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center rounded-full">1</span>
                        <span>Click the settings icon (gear) in the Chat panel header</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center rounded-full">2</span>
                        <span>Enter your Claude API key (starts with sk-ant-)</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center rounded-full">3</span>
                        <span>Click Save - your key is stored locally in your browser</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center rounded-full">4</span>
                        <span>Type a command and press Enter to test</span>
                      </li>
                    </ol>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-semibold text-white mb-2">Example Commands by Robot Type</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-4 border border-slate-800">
                        <h5 className="text-blue-400 font-semibold mb-2">Robot Arm</h5>
                        <ul className="text-sm text-slate-400 space-y-1">
                          <li>"wave hello"</li>
                          <li>"pick up the red cube"</li>
                          <li>"move a bit to the left"</li>
                          <li>"go to home position"</li>
                          <li>"scan the area"</li>
                          <li>"open the gripper"</li>
                        </ul>
                      </div>
                      <div className="bg-slate-950 p-4 border border-slate-800">
                        <h5 className="text-green-400 font-semibold mb-2">Wheeled Robot</h5>
                        <ul className="text-sm text-slate-400 space-y-1">
                          <li>"drive forward slowly"</li>
                          <li>"turn 90 degrees right"</li>
                          <li>"follow the black line"</li>
                          <li>"avoid the obstacle"</li>
                          <li>"spin in a circle"</li>
                          <li>"stop immediately"</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/30 p-4 border border-amber-500/30">
                    <h4 className="font-semibold text-amber-400 mb-2 flex items-center gap-2">
                      <Star className="w-4 h-4" />
                      Pro Tips
                    </h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                      <li>• Be specific: "move 10cm forward" works better than "move forward"</li>
                      <li>• Use context: "now move it to the blue bin" after picking up an object</li>
                      <li>• Ask questions: "where is the gripper?" or "what's the current arm position?"</li>
                      <li>• Chain actions: "pick up the cube, then place it on the platform"</li>
                    </ul>
                  </div>
                </div>

                {/* Code Copilot */}
                <div className="bg-slate-900/50 border-2 border-purple-500/30 p-6">
                  <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-3">
                    <Code className="w-5 h-5" />
                    Code Copilot
                  </h3>

                  <p className="text-slate-300 mb-4">
                    Code Copilot provides AI-powered assistance directly in the code editor. Generate code from
                    comments, get explanations of unfamiliar code, and receive intelligent suggestions.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-800/50 p-4 border border-slate-700">
                      <h4 className="font-semibold text-white mb-2">Generate from Comment</h4>
                      <p className="text-xs text-slate-400 mb-2">Write what you want as a comment, then let AI write the code.</p>
                      <div className="bg-slate-950 p-2 font-mono text-xs text-slate-300">
                        <div className="text-green-400">// move arm in a circle pattern</div>
                        <div className="text-slate-500">Press Ctrl+Shift+G</div>
                        <div className="text-blue-400 mt-1">for (let i = 0; i &lt; 360; i += 10) {'{'}</div>
                        <div className="text-blue-400">  robot.setJoint('base', i);</div>
                        <div className="text-blue-400">  await robot.wait(50);</div>
                        <div className="text-blue-400">{'}'}</div>
                      </div>
                    </div>
                    <div className="bg-slate-800/50 p-4 border border-slate-700">
                      <h4 className="font-semibold text-white mb-2">Explain Selection</h4>
                      <p className="text-xs text-slate-400 mb-2">Select code you don't understand and get a clear explanation.</p>
                      <div className="bg-slate-950 p-2 font-mono text-xs text-slate-300">
                        <div className="bg-blue-500/20 text-blue-400">robot.moveTo({'{'} base: 45, shoulder: -30 {'}'});</div>
                        <div className="text-slate-500 mt-1">Press Ctrl+Shift+E</div>
                        <div className="text-slate-400 mt-1 font-sans">"This moves the robot to base angle 45° and shoulder angle -30°..."</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/30 p-4 border border-purple-500/30">
                    <h4 className="font-semibold text-white mb-2">Use Cases</h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                      <li><strong>Learning:</strong> Generate code examples to understand Robot API patterns</li>
                      <li><strong>Speed:</strong> Write comments describing logic, let AI fill in implementation</li>
                      <li><strong>Debugging:</strong> Select error-causing code and ask for explanation</li>
                      <li><strong>Exploration:</strong> Discover new API methods through intelligent suggestions</li>
                    </ul>
                  </div>
                </div>

                {/* AI Vision Section Header */}
                <div id="ai-vision" className="border-b border-purple-500/30 pb-2">
                  <h3 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    AI Vision & Understanding
                  </h3>
                </div>

                {/* Vision Analysis */}
                <div className="bg-slate-900/50 border-2 border-cyan-500/30 p-6">
                  <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-3">
                    <Eye className="w-5 h-5" />
                    Vision Analysis (Scene Understanding)
                  </h3>

                  <p className="text-slate-300 mb-4">
                    Vision Analysis uses Claude's multimodal capabilities to understand what's in your simulation.
                    Ask questions about the scene and get intelligent, contextual answers.
                  </p>

                  <div className="mb-4">
                    <h4 className="font-semibold text-white mb-2">What You Can Ask</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { q: "What's in the scene?", a: "Get a complete description of all visible objects, robot position, and environment" },
                        { q: "What can the robot pick up?", a: "Identifies grabbable objects with sizes and positions" },
                        { q: "Where is the red cube?", a: "Spatial location relative to robot: 'front-left, approximately 20cm away'" },
                        { q: "What's blocking the path?", a: "Identifies obstacles between robot and potential targets" },
                      ].map((item, i) => (
                        <div key={i} className="bg-slate-950 p-3 border border-slate-800">
                          <p className="font-medium text-cyan-400 text-sm">"{item.q}"</p>
                          <p className="text-xs text-slate-400 mt-1">{item.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-800/30 p-4 border border-cyan-500/30">
                    <h4 className="font-semibold text-white mb-2">Example Workflow</h4>
                    <ol className="text-sm text-slate-400 space-y-1">
                      <li>1. Ask "What objects are in the scene?"</li>
                      <li>2. AI responds: "I see a red cube (5cm), yellow ball (3cm radius), and metal cylinder"</li>
                      <li>3. Ask "Which is closest to the robot?"</li>
                      <li>4. AI responds: "The red cube is closest, approximately 15cm from the gripper"</li>
                      <li>5. Tell Chat: "Pick up the red cube" - robot knows exactly what to do</li>
                    </ol>
                  </div>
                </div>

                {/* Voice Control */}
                <div className="bg-slate-900/50 border-2 border-emerald-500/30 p-6">
                  <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-3">
                    <Mic className="w-5 h-5" />
                    Voice Control
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Control robots hands-free using voice commands. Speak naturally and the robot responds.
                    Perfect for accessibility or when your hands are occupied.
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-950 p-4 border border-slate-800">
                      <h5 className="text-emerald-400 font-semibold mb-2">Example Commands</h5>
                      <ul className="text-sm text-slate-400 space-y-1">
                        <li>"wave hello"</li>
                        <li>"open gripper"</li>
                        <li>"move left"</li>
                        <li>"go home"</li>
                      </ul>
                    </div>
                    <div className="bg-slate-950 p-4 border border-slate-800">
                      <h5 className="text-emerald-400 font-semibold mb-2">Features</h5>
                      <ul className="text-sm text-slate-400 space-y-1">
                        <li>• Wake word: "Hey Robot"</li>
                        <li>• Voice feedback</li>
                        <li>• Works in Chrome/Edge</li>
                        <li>• Real-time recognition</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Hand Tracking */}
                <div className="bg-slate-900/50 border-2 border-pink-500/30 p-6">
                  <h3 className="text-xl font-bold text-pink-400 mb-4 flex items-center gap-3">
                    <Hand className="w-5 h-5" />
                    Hand Tracking
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Control the robot arm using your hand movements via webcam. MediaPipe tracks 21 hand landmarks
                    at 30+ FPS for natural, intuitive control.
                  </p>
                  <div className="bg-slate-800/30 p-4 border border-pink-500/30 mb-4">
                    <h4 className="font-semibold text-white mb-2">How to Use</h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                      <li>1. Open Hand Tracking panel in Hardware tab</li>
                      <li>2. Click "Start Tracking" and allow camera access</li>
                      <li>3. Position hand 30-60cm from camera</li>
                      <li>4. Move hand to control arm position</li>
                      <li>5. Pinch fingers to close gripper, open hand to release</li>
                    </ul>
                  </div>
                </div>

                {/* AI Generation Section Header */}
                <div id="ai-generation" className="border-b border-emerald-500/30 pb-2">
                  <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                    <Box className="w-5 h-5" />
                    AI Content Generation
                  </h3>
                </div>

                {/* Text to 3D */}
                <div className="bg-slate-900/50 border-2 border-green-500/30 p-6">
                  <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-3">
                    <Box className="w-5 h-5" />
                    Text to 3D
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Generate 3D objects from text descriptions. Type "red apple" or "wooden cube" and a physics-enabled
                    object appears in your scene.
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-950 p-4 border border-slate-800">
                      <h5 className="text-green-400 font-semibold mb-2">Example Prompts</h5>
                      <ul className="text-sm text-slate-400 space-y-1">
                        <li>"red apple"</li>
                        <li>"wooden cube"</li>
                        <li>"blue ball"</li>
                        <li>"metal cylinder"</li>
                      </ul>
                    </div>
                    <div className="bg-slate-950 p-4 border border-slate-800">
                      <h5 className="text-green-400 font-semibold mb-2">Style Options</h5>
                      <ul className="text-sm text-slate-400 space-y-1">
                        <li>• Realistic</li>
                        <li>• Cartoon</li>
                        <li>• Low-poly</li>
                        <li>• Voxel</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Image to 3D */}
                <div className="bg-slate-900/50 border-2 border-teal-500/30 p-6">
                  <h3 className="text-xl font-bold text-teal-400 mb-4 flex items-center gap-3">
                    <Monitor className="w-5 h-5" />
                    Image to 3D (CSM)
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Upload a photo of any real object and convert it to a training-ready 3D model using CSM.ai.
                    Includes auto-estimated grasp points for manipulation tasks.
                  </p>
                  <div className="bg-slate-800/30 p-4 border border-teal-500/30">
                    <h4 className="font-semibold text-white mb-2">Steps</h4>
                    <ol className="text-sm text-slate-400 space-y-1">
                      <li>1. Get free API key from csm.ai (10 free credits)</li>
                      <li>2. Upload photo of real object</li>
                      <li>3. Set real-world dimensions</li>
                      <li>4. Generate 3D model with physics</li>
                    </ol>
                  </div>
                </div>

                {/* AI Environments */}
                <div className="bg-slate-900/50 border-2 border-amber-500/30 p-6">
                  <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-3">
                    <Layers className="w-5 h-5" />
                    AI Environments (Gemini)
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Generate scene backdrops, floor textures, and object textures using Gemini AI.
                    Create warehouse, garden, lab, or custom environments for domain randomization.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {['Warehouse', 'Garden', 'Lab', 'Factory', 'Kitchen', 'Custom'].map((env) => (
                      <div key={env} className="bg-slate-950 p-3 border border-slate-800 text-center">
                        <span className="text-sm text-slate-400">{env}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* LeRobot Policies */}
                <div className="bg-slate-900/50 border-2 border-violet-500/30 p-6">
                  <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-center gap-3">
                    <Brain className="w-5 h-5" />
                    LeRobot Policies
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Load and run pre-trained AI policies from HuggingFace Hub directly in your browser.
                    Policies run locally using ONNX Runtime Web - no GPU required.
                  </p>
                  <div className="bg-slate-800/30 p-4 border border-violet-500/30">
                    <h4 className="font-semibold text-white mb-2">Supported Policy Types</h4>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-violet-500/20 text-violet-300 text-xs rounded">ACT</span>
                      <span className="px-2 py-1 bg-violet-500/20 text-violet-300 text-xs rounded">Diffusion</span>
                      <span className="px-2 py-1 bg-violet-500/20 text-violet-300 text-xs rounded">VQ-BeT</span>
                      <span className="px-2 py-1 bg-violet-500/20 text-violet-300 text-xs rounded">ONNX</span>
                    </div>
                  </div>
                </div>

                {/* AI Training Section Header */}
                <div id="ai-training" className="border-b border-amber-500/30 pb-2">
                  <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    AI Training & Data Generation
                  </h3>
                </div>

                {/* LLM → Physics Recording */}
                <div className="bg-slate-900/50 border-2 border-fuchsia-500/30 p-6">
                  <h3 className="text-xl font-bold text-fuchsia-400 mb-4 flex items-center gap-3">
                    <Zap className="w-5 h-5" />
                    LLM → Physics Recording
                    <span className="text-xs px-2 py-1 bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 rounded">NEW</span>
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Generate training data by describing tasks in natural language. AI creates a motion plan,
                    physics simulation executes it, and camera captures frames at 30 FPS.
                  </p>
                  <div className="bg-slate-950 p-4 border border-slate-800 mb-4">
                    <div className="text-xs text-fuchsia-400 mb-2">Example Workflow:</div>
                    <div className="font-mono text-xs text-slate-300 space-y-1">
                      <div>1. "Stack the red block on blue"</div>
                      <div>2. AI parses → motion plan</div>
                      <div>3. Physics sim executes</div>
                      <div>4. Camera records frames</div>
                      <div>5. Export with language instruction</div>
                    </div>
                  </div>
                  <div className="bg-slate-800/30 p-4 border border-fuchsia-500/30">
                    <h4 className="font-semibold text-white mb-2">Output Formats</h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                      <li>• LeRobot v3.0 with Parquet</li>
                      <li>• Language instruction in metadata</li>
                      <li>• Compatible with RT-1, OpenVLA, ACT</li>
                    </ul>
                  </div>
                </div>

                {/* Object Library */}
                <div className="bg-slate-900/50 border-2 border-indigo-500/30 p-6">
                  <h3 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-3">
                    <Box className="w-5 h-5" />
                    Object Library
                  </h3>
                  <p className="text-slate-300 mb-4">
                    34 physics-enabled objects including 18 YCB benchmark items (standard robotics research objects).
                    7 scene presets for common manipulation tasks.
                  </p>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-950 p-3 border border-slate-800 text-center">
                      <div className="text-2xl font-bold text-indigo-400">34</div>
                      <div className="text-xs text-slate-500">Objects</div>
                    </div>
                    <div className="bg-slate-950 p-3 border border-slate-800 text-center">
                      <div className="text-2xl font-bold text-indigo-400">18</div>
                      <div className="text-xs text-slate-500">YCB Items</div>
                    </div>
                    <div className="bg-slate-950 p-3 border border-slate-800 text-center">
                      <div className="text-2xl font-bold text-indigo-400">7</div>
                      <div className="text-xs text-slate-500">Presets</div>
                    </div>
                    <div className="bg-slate-950 p-3 border border-slate-800 text-center">
                      <div className="text-2xl font-bold text-indigo-400">6</div>
                      <div className="text-xs text-slate-500">Categories</div>
                    </div>
                  </div>
                  <div className="bg-slate-800/30 p-4 border border-indigo-500/30">
                    <h4 className="font-semibold text-white mb-2">Scene Presets</h4>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">Block Stacking</span>
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">Cup Pouring</span>
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">Color Sorting</span>
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">Fruit Pick & Place</span>
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">Can Lineup</span>
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">Office Desk</span>
                    </div>
                  </div>
                </div>

                {/* Language-Conditioned Training */}
                <div className="bg-slate-900/50 border-2 border-orange-500/30 p-6">
                  <h3 className="text-xl font-bold text-orange-400 mb-4 flex items-center gap-3">
                    <BookOpen className="w-5 h-5" />
                    Language-Conditioned Training
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Train robots to follow natural language instructions. Record demonstrations with free-form text commands,
                    export to LeRobot format, and train policies like RT-1, RT-2, or OpenVLA.
                  </p>
                  <div className="bg-slate-800/30 p-4 border border-orange-500/30">
                    <h4 className="font-semibold text-white mb-2">Supported Models</h4>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded">RT-1</span>
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded">RT-2</span>
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded">OpenVLA</span>
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded">LeRobot ACT</span>
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded">Diffusion Policy</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Training Data for LeRobot */}
            {activeSection === 'training-data' && (
              <div className="space-y-8">
                {/* Overview */}
                <div className="bg-slate-900/50 border-2 border-orange-500/30 p-6">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <Database className="w-6 h-6 text-orange-400" />
                    Training Data for LeRobot
                  </h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    RoboSim makes it easy to generate high-quality training data for the HuggingFace LeRobot framework.
                    Train real robots using data created entirely in the browser - no special hardware required during data collection.
                  </p>
                  <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-lg">
                    <p className="text-orange-300 text-sm">
                      <strong>Goal:</strong> Create datasets that can train policies (ACT, Diffusion, TD-MPC) to run on real SO-101 robots.
                    </p>
                  </div>
                </div>

                {/* Recommended Workflow */}
                <div className="bg-gradient-to-r from-emerald-900/30 to-violet-900/30 border-2 border-emerald-500/30 p-6 rounded-xl">
                  <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-emerald-400" />
                    Recommended Workflow: Start Fast, Refine for Quality
                  </h3>
                  <p className="text-slate-300 text-sm mb-4">
                    Multiple data collection approaches work together. Start with the fastest method, then add quality refinements as needed.
                  </p>

                  <div className="grid gap-3">
                    {/* Step 1: Chat */}
                    <div className="flex items-start gap-4 bg-slate-800/60 p-4 rounded-lg border-l-4 border-emerald-500">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold shrink-0">1</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-emerald-300">Start with Chat Recording</h4>
                        <p className="text-slate-400 text-sm">Just talk to the robot. Every command becomes a labeled training episode with automatic language annotations. Great for quickly generating diverse demonstrations.</p>
                        <p className="text-emerald-400/70 text-xs mt-1">Best for: Initial dataset, language-conditioned learning, natural variation</p>
                      </div>
                    </div>

                    {/* Step 2: Review */}
                    <div className="flex items-start gap-4 bg-slate-800/60 p-4 rounded-lg border-l-4 border-amber-500">
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shrink-0">2</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-amber-300">Check Quality with Statistics Dashboard</h4>
                        <p className="text-slate-400 text-sm">Review your dataset quality metrics. The dashboard shows success rates, motion smoothness, and LeRobot readiness. Identify which episodes need improvement.</p>
                        <p className="text-amber-400/70 text-xs mt-1">Look for: Low smoothness scores, inconsistent durations, failed episodes</p>
                      </div>
                    </div>

                    {/* Step 3: Refine */}
                    <div className="flex items-start gap-4 bg-slate-800/60 p-4 rounded-lg border-l-4 border-violet-500">
                      <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-white font-bold shrink-0">3</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-violet-300">Refine with Guided Teleoperation</h4>
                        <p className="text-slate-400 text-sm">For tricky tasks where chat-generated motion isn't smooth enough, use guided recording. Visual guides and real-time quality feedback help you record expert-level demonstrations.</p>
                        <p className="text-violet-400/70 text-xs mt-1">Best for: High-quality demos, consistent technique, precision tasks</p>
                      </div>
                    </div>

                    {/* Step 4: Scale */}
                    <div className="flex items-start gap-4 bg-slate-800/60 p-4 rounded-lg border-l-4 border-blue-500">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0">4</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-blue-300">Scale with Augmentation & Batch Generation</h4>
                        <p className="text-slate-400 text-sm">Once you have good base episodes, multiply them. Add trajectory noise, time stretching, and spatial jitter. Use LLM batch recording to generate variations automatically.</p>
                        <p className="text-blue-400/70 text-xs mt-1">Best for: 100+ episodes, sim-to-real robustness, dataset diversity</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600/50">
                    <p className="text-slate-300 text-sm">
                      <strong className="text-white">Pro tip:</strong> You don't need all approaches. Chat Recording alone can produce training-ready datasets.
                      Add other methods only when you need higher quality or more volume for specific tasks.
                    </p>
                  </div>
                </div>

                {/* Quick Start Pipeline */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Quick Start: Your First Dataset
                  </h3>
                  <div className="grid gap-4">
                    {[
                      { step: 1, title: 'Add Objects to Scene', desc: 'Go to Data tab → Object Library → Load "Block Stacking" preset', time: '30 sec' },
                      { step: 2, title: 'Record Demonstrations', desc: 'Data tab → Dataset Recorder → Click "Start Recording" → Teleoperate the robot → Click "Stop"', time: '2-5 min' },
                      { step: 3, title: 'Export for LeRobot', desc: 'Click "Export LeRobot" → Download ZIP file', time: '10 sec' },
                      { step: 4, title: 'Convert to Parquet', desc: 'Unzip → Run: python convert_to_parquet.py', time: '10 sec' },
                      { step: 5, title: 'Train with LeRobot', desc: 'python -m lerobot.scripts.train --dataset path/to/dataset', time: '1-24 hrs' },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-4 bg-slate-800/50 p-4 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shrink-0">
                          {item.step}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-white">{item.title}</h4>
                          <p className="text-slate-400 text-sm">{item.desc}</p>
                        </div>
                        <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example Workflows */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-400" />
                    Example Workflows
                  </h3>

                  {/* Example 1: Custom Object */}
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg">
                    <h4 className="font-bold text-white mb-2">Example 1: Train Robot to Pick Up Your Coffee Mug</h4>
                    <div className="space-y-2 text-sm text-slate-300">
                      <p><strong className="text-blue-400">Step 1:</strong> Take 2-4 photos of your mug from different angles with your phone</p>
                      <p><strong className="text-blue-400">Step 2:</strong> AI tab → Image to 3D → Upload photos → Select "fal.ai" → Generate (~20 seconds)</p>
                      <p><strong className="text-blue-400">Step 3:</strong> Set object name to "coffee_mug" and size to "Medium" → Add to Scene</p>
                      <p><strong className="text-blue-400">Step 4:</strong> Record 20-50 demonstrations of picking up the mug</p>
                      <p><strong className="text-blue-400">Step 5:</strong> Export → Train with LeRobot ACT policy → Deploy to real SO-101</p>
                    </div>
                    <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs text-slate-400">
                      <strong>Why this works:</strong> The 3D model has realistic physics (convex hull collider, correct mass),
                      and grasp points are auto-estimated for cup-shaped objects.
                    </div>
                  </div>

                  {/* Example 2: Language-Conditioned */}
                  <div className="mb-6 p-4 bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/30 rounded-lg">
                    <h4 className="font-bold text-white mb-2">Example 2: Language-Conditioned Pick & Place</h4>
                    <div className="space-y-2 text-sm text-slate-300">
                      <p><strong className="text-green-400">Step 1:</strong> Data tab → Object Library → Load "Color Sorting" preset (red, blue, green blocks)</p>
                      <p><strong className="text-green-400">Step 2:</strong> Data tab → LLM Recording → Enter: "Pick up the red block and place it on the left"</p>
                      <p><strong className="text-green-400">Step 3:</strong> Set Episodes to 10, click "Generate" - AI creates motion plans and records physics</p>
                      <p><strong className="text-green-400">Step 4:</strong> Repeat with different instructions: "Stack blue on green", "Move all blocks right"</p>
                      <p><strong className="text-green-400">Step 5:</strong> Export → Train RT-1 or OpenVLA style model with language conditioning</p>
                    </div>
                    <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs text-slate-400">
                      <strong>Dataset includes:</strong> language_instruction field in metadata, enabling vision-language-action model training.
                    </div>
                  </div>

                  {/* Example 3: Synthetic Data */}
                  <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg">
                    <h4 className="font-bold text-white mb-2">Example 3: Generate 1000+ Episodes Automatically</h4>
                    <div className="space-y-2 text-sm text-slate-300">
                      <p><strong className="text-purple-400">Step 1:</strong> Data tab → Auto Episode Generator → Select task template "Pick and Place"</p>
                      <p><strong className="text-purple-400">Step 2:</strong> Set Base Episodes: 100, Augmentation: 10x</p>
                      <p><strong className="text-purple-400">Step 3:</strong> Enable Domain Randomization (lighting, materials)</p>
                      <p><strong className="text-purple-400">Step 4:</strong> Click "Generate All" → Wait ~2-5 minutes</p>
                      <p><strong className="text-purple-400">Step 5:</strong> Export 1000 episodes ready for LeRobot training</p>
                    </div>
                    <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs text-slate-400">
                      <strong>Augmentations applied:</strong> Action noise, time stretching, spatial jitter, and visual randomization
                      for better sim-to-real transfer.
                    </div>
                  </div>
                </div>

                {/* Chat → Training Data (NEW) */}
                <div className="bg-slate-900/50 border-2 border-emerald-500/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    Chat → Training Data (NEW)
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Turn natural language commands into labeled training episodes. Every chat message you send becomes a demonstration with automatic language annotations.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-emerald-300 mb-2">Auto-Record Mode</h4>
                      <p className="text-slate-400 text-sm">Enable auto-record and the system captures every chat command as a training episode automatically. No manual start/stop needed.</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-emerald-300 mb-2">Language Labels</h4>
                      <p className="text-slate-400 text-sm">Your chat messages become language_instruction labels in the dataset - perfect for training RT-1, OpenVLA, or other language-conditioned models.</p>
                    </div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-emerald-300 mb-2">How to Use:</h4>
                    <ol className="list-decimal list-inside text-slate-300 text-sm space-y-1">
                      <li>Open <strong>Data tab → Chat Recording Panel</strong></li>
                      <li>Enable <strong>Auto-Record</strong> toggle</li>
                      <li>Chat naturally: "Pick up the red block", "Move it to the left"</li>
                      <li>Each command is recorded with quality metrics</li>
                      <li>Export when ready - all episodes include language annotations</li>
                    </ol>
                  </div>
                </div>

                {/* Guided Teleoperation Recording (NEW) */}
                <div className="bg-slate-900/50 border-2 border-violet-500/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-violet-400" />
                    Guided Teleoperation Recording (NEW)
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Record high-quality demonstrations with visual guidance. Task templates show you exactly where to move, with real-time quality feedback.
                  </p>

                  {/* Task Templates */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-violet-300 mb-2">Task Templates</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['Pick & Place', 'Stack Objects', 'Push to Target', 'Waypoint Path'].map((task) => (
                        <div key={task} className="bg-violet-500/10 border border-violet-500/30 p-2 rounded text-center text-sm text-violet-200">
                          {task}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3D Visual Guides */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-violet-300 mb-2">3D Visual Guides</h4>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="bg-slate-800/50 p-3 rounded-lg text-center">
                        <div className="text-2xl mb-1">🎯</div>
                        <p className="text-white text-sm font-medium">Target Markers</p>
                        <p className="text-slate-400 text-xs">Pulsing indicators show where to go</p>
                      </div>
                      <div className="bg-slate-800/50 p-3 rounded-lg text-center">
                        <div className="text-2xl mb-1">👻</div>
                        <p className="text-white text-sm font-medium">Ghost Gripper</p>
                        <p className="text-slate-400 text-xs">Semi-transparent target pose overlay</p>
                      </div>
                      <div className="bg-slate-800/50 p-3 rounded-lg text-center">
                        <div className="text-2xl mb-1">➡️</div>
                        <p className="text-white text-sm font-medium">Direction Arrows</p>
                        <p className="text-slate-400 text-xs">Arrows guide you to the target</p>
                      </div>
                    </div>
                  </div>

                  {/* Quality Metrics */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-violet-300 mb-2">Real-Time Quality Metrics</h4>
                    <div className="grid md:grid-cols-4 gap-2">
                      <div className="bg-slate-800/50 p-2 rounded text-center">
                        <p className="text-green-400 font-bold text-lg">85%</p>
                        <p className="text-slate-400 text-xs">Smoothness</p>
                      </div>
                      <div className="bg-slate-800/50 p-2 rounded text-center">
                        <p className="text-blue-400 font-bold text-lg">12.3</p>
                        <p className="text-slate-400 text-xs">Avg Velocity</p>
                      </div>
                      <div className="bg-slate-800/50 p-2 rounded text-center">
                        <p className="text-yellow-400 font-bold text-lg">4.2s</p>
                        <p className="text-slate-400 text-xs">Duration</p>
                      </div>
                      <div className="bg-slate-800/50 p-2 rounded text-center">
                        <p className="text-purple-400 font-bold text-lg">Good</p>
                        <p className="text-slate-400 text-xs">Quality Level</p>
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="bg-violet-500/10 border border-violet-500/30 p-4 rounded-lg">
                    <h4 className="font-semibold text-violet-300 mb-2">Enhanced Teleoperation Controls</h4>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-white font-medium mb-1">Keyboard</p>
                        <p className="text-slate-400">WASD (base/shoulder), QE (elbow), RF (wrist), ZXC (gripper)</p>
                        <p className="text-slate-500 text-xs mt-1">Hold Shift for faster, Ctrl for slower movement</p>
                      </div>
                      <div>
                        <p className="text-white font-medium mb-1">Gamepad</p>
                        <p className="text-slate-400">Left stick (base/shoulder), Right stick (elbow/wrist), Triggers (gripper)</p>
                        <p className="text-slate-500 text-xs mt-1">Smooth acceleration with configurable dead zones</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dataset Statistics Dashboard (NEW) */}
                <div className="bg-slate-900/50 border-2 border-amber-500/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-amber-400" />
                    Dataset Statistics Dashboard (NEW)
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Analyze your dataset quality before export with comprehensive statistics and LeRobot readiness checks.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-amber-300 mb-2">Statistics Tracked</h4>
                      <ul className="text-slate-400 text-sm space-y-1">
                        <li>• Episode count & success rate</li>
                        <li>• Frame distribution histogram</li>
                        <li>• Duration statistics (min/max/avg)</li>
                        <li>• Quality metrics (smoothness, jerk)</li>
                        <li>• Language instruction coverage</li>
                      </ul>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-amber-300 mb-2">LeRobot Readiness Checks</h4>
                      <ul className="text-slate-400 text-sm space-y-1">
                        <li>• Minimum 10 episodes required</li>
                        <li>• Success rate above 50%</li>
                        <li>• Consistent frame counts</li>
                        <li>• Language instructions present</li>
                        <li>• Auto-recommendations for improvement</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Data Format */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Box className="w-5 h-5 text-cyan-400" />
                    LeRobot v3.0 Dataset Format
                  </h3>
                  <div className="bg-slate-800 p-4 rounded-lg font-mono text-sm text-slate-300 mb-4">
                    <pre>{`my_dataset/
├── meta/
│   ├── info.json          # Dataset config, feature shapes
│   ├── stats.json         # Min/max/mean/std per feature
│   ├── episodes.jsonl     # Episode metadata + language
│   └── tasks.jsonl        # Task definitions
├── data/
│   └── chunk-000/
│       ├── episode_000000.parquet
│       ├── episode_000001.parquet
│       └── ...
├── videos/                 # Optional camera recordings
│   └── observation.images.cam_high/
│       └── episode_*.mp4
├── convert_to_parquet.py   # Run this after download!
└── README.md               # Auto-generated documentation`}</pre>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-3 rounded">
                      <h4 className="font-semibold text-white mb-2">observation.state</h4>
                      <p className="text-slate-400 text-sm">6 joint positions: [base, shoulder, elbow, wrist, wristRoll, gripper]</p>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded">
                      <h4 className="font-semibold text-white mb-2">action</h4>
                      <p className="text-slate-400 text-sm">6 joint targets (same format as observation.state)</p>
                    </div>
                  </div>
                </div>

                {/* Image to 3D */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-pink-400" />
                    Photo → 3D Model → Training Data
                  </h3>
                  <p className="text-slate-300 mb-4">
                    Train robots on your own objects by converting photos to physics-enabled 3D models.
                  </p>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                      <div className="text-3xl mb-2">📸</div>
                      <h4 className="font-semibold text-white">1. Photograph</h4>
                      <p className="text-slate-400 text-xs">2-4 angles, good lighting, plain background</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                      <div className="text-3xl mb-2">🧊</div>
                      <h4 className="font-semibold text-white">2. Generate 3D</h4>
                      <p className="text-slate-400 text-xs">fal.ai (~20s), CSM (free), or Rodin (highest quality)</p>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                      <div className="text-3xl mb-2">⚙️</div>
                      <h4 className="font-semibold text-white">3. Auto Physics</h4>
                      <p className="text-slate-400 text-xs">Colliders, mass, and grasp points auto-configured</p>
                    </div>
                  </div>
                  <div className="bg-pink-500/10 border border-pink-500/30 p-3 rounded-lg text-sm">
                    <strong className="text-pink-300">Smart Colliders:</strong>
                    <span className="text-slate-300 ml-2">
                      Mesh is analyzed to choose optimal physics shape - spheres for balls, cylinders for bottles,
                      convex hulls for complex objects.
                    </span>
                  </div>
                </div>

                {/* Tips for Quality Data */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400" />
                    Tips for High-Quality Training Data
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { tip: 'Record 50-200 episodes', why: 'More data = better generalization. ACT needs ~50, Diffusion needs ~100+' },
                      { tip: 'Vary starting positions', why: 'Randomize object and robot positions to avoid overfitting' },
                      { tip: 'Include failures', why: 'Some failed attempts help the policy learn recovery behaviors' },
                      { tip: 'Use domain randomization', why: 'Vary lighting and colors for better sim-to-real transfer' },
                      { tip: 'Add trajectory noise', why: 'Small perturbations make policies more robust' },
                      { tip: 'Record at consistent FPS', why: '30 FPS is standard - matches LeRobot expectations' },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-800/50 p-3 rounded-lg">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-white">{item.tip}</p>
                            <p className="text-slate-400 text-xs">{item.why}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upload to HuggingFace */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-400" />
                    Share on HuggingFace Hub
                  </h3>
                  <div className="space-y-3">
                    <p className="text-slate-300">
                      Upload datasets directly to HuggingFace without CLI tools:
                    </p>
                    <div className="bg-slate-800 p-4 rounded-lg font-mono text-sm">
                      <p className="text-slate-400"># After upload, use your dataset:</p>
                      <p className="text-green-400">from lerobot.common.datasets.lerobot_dataset import LeRobotDataset</p>
                      <p className="text-blue-400">dataset = LeRobotDataset("your-username/my-robot-dataset")</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-3 text-center">
                      <div className="bg-blue-500/10 p-3 rounded">
                        <p className="text-blue-400 font-semibold">1. Get HF Token</p>
                        <p className="text-xs text-slate-400">huggingface.co/settings/tokens</p>
                      </div>
                      <div className="bg-blue-500/10 p-3 rounded">
                        <p className="text-blue-400 font-semibold">2. Paste in Settings</p>
                        <p className="text-xs text-slate-400">Settings tab → API Keys</p>
                      </div>
                      <div className="bg-blue-500/10 p-3 rounded">
                        <p className="text-blue-400 font-semibold">3. Upload</p>
                        <p className="text-xs text-slate-400">Data tab → HuggingFace Upload</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Common Issues */}
                <div className="bg-slate-900/50 border-2 border-red-500/20 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-red-400" />
                    Troubleshooting
                  </h3>
                  <div className="space-y-3">
                    {[
                      { q: 'LeRobot says "invalid parquet file"', a: 'Run convert_to_parquet.py first! The browser exports JSON that needs conversion.' },
                      { q: 'Policy trained but doesn\'t work on real robot', a: 'Enable domain randomization and add trajectory noise. Record more varied demonstrations.' },
                      { q: '3D model physics feel wrong', a: 'Check object size setting. Use "Small" for items <5cm, "Medium" for 5-15cm, "Large" for >15cm.' },
                      { q: 'Episodes are too short', a: 'Include full task completion. Record from approach to release, not just the grasp.' },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-800/50 p-3 rounded-lg">
                        <p className="font-medium text-red-300">{item.q}</p>
                        <p className="text-slate-400 text-sm mt-1">{item.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Code Editor */}
            {activeSection === 'code' && (
              <div className="space-y-8">
                <div className="bg-slate-900/50 border-2 border-green-500/30 p-6">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <Code className="w-6 h-6 text-green-400" />
                    Code Editor
                  </h2>
                  <p className="text-slate-400 mb-4">
                    The Code Editor lets you write JavaScript programs to control robots. It features Monaco
                    (the same editor that powers VS Code) with syntax highlighting, auto-completion, and error detection.
                  </p>
                </div>

                {/* Robot API */}
                <div className="bg-slate-900/50 border-2 border-green-500/30 p-6">
                  <h3 className="text-xl font-bold text-green-400 mb-4">Robot API Reference</h3>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-white mb-2">Movement Commands</h4>
                      <div className="font-mono text-sm bg-slate-950 p-4 rounded overflow-x-auto">
                        <pre className="text-slate-300">{`// Move to specific joint positions
robot.moveTo({ base: 45, shoulder: 30, elbow: -60 });

// Set a single joint
robot.setJoint('base', 90);
robot.setJoint('gripper', 50);  // 0-100%

// Return to home position
robot.home();

// Smooth motion with duration (milliseconds)
await robot.moveSmooth({ base: 45, shoulder: 30 }, 2000);`}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-white mb-2">Gripper Control</h4>
                      <div className="font-mono text-sm bg-slate-950 p-4 rounded overflow-x-auto">
                        <pre className="text-slate-300">{`// Open and close
robot.openGripper();    // Fully open (0%)
robot.closeGripper();   // Fully closed (100%)

// Partial grip
robot.setGripper(50);   // Half closed - good for delicate objects
robot.setGripper(80);   // Firm grip`}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-white mb-2">Timing & Queries</h4>
                      <div className="font-mono text-sm bg-slate-950 p-4 rounded overflow-x-auto">
                        <pre className="text-slate-300">{`// Wait for specified time
await robot.wait(1000);  // Wait 1 second

// Get current state
const pos = robot.getPosition();    // { x, y, z }
const joints = robot.getJoints();   // { base, shoulder, ... }

// Check robot status
console.log(robot.status);  // 'idle', 'moving', 'error'`}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-white mb-2">Sensors</h4>
                      <div className="font-mono text-sm bg-slate-950 p-4 rounded overflow-x-auto">
                        <pre className="text-slate-300">{`// Read sensor values
const distance = sensors.ultrasonic;  // cm
const left = sensors.irLeft;          // 0 or 1
const center = sensors.irCenter;      // 0 or 1
const right = sensors.irRight;        // 0 or 1
const battery = sensors.battery;      // 0-100%

// Example: simple obstacle avoidance
if (sensors.ultrasonic < 20) {
  console.log('Obstacle detected!');
  robot.setJoint('base', robot.getJoints().base - 30);
}`}</pre>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Code Templates */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Code Templates</h3>
                  <p className="text-slate-400 mb-4">
                    Start with pre-built templates to learn patterns and accelerate development.
                    Select a template from the dropdown in the code editor.
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-semibold text-blue-400 mb-2">Basic</h4>
                      <ul className="text-sm text-slate-400 space-y-2">
                        <li className="bg-slate-800/50 p-2">
                          <p className="font-medium text-white">Hello World</p>
                          <p className="text-xs">Simple movements and console output</p>
                        </li>
                        <li className="bg-slate-800/50 p-2">
                          <p className="font-medium text-white">Joint Explorer</p>
                          <p className="text-xs">Move each joint sequentially</p>
                        </li>
                        <li className="bg-slate-800/50 p-2">
                          <p className="font-medium text-white">Sensor Reader</p>
                          <p className="text-xs">Display all sensor values</p>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-yellow-400 mb-2">Intermediate</h4>
                      <ul className="text-sm text-slate-400 space-y-2">
                        <li className="bg-slate-800/50 p-2">
                          <p className="font-medium text-white">Pick and Place</p>
                          <p className="text-xs">Grab object and move to target</p>
                        </li>
                        <li className="bg-slate-800/50 p-2">
                          <p className="font-medium text-white">Scanning Pattern</p>
                          <p className="text-xs">Survey area with smooth sweeps</p>
                        </li>
                        <li className="bg-slate-800/50 p-2">
                          <p className="font-medium text-white">Wave Hello</p>
                          <p className="text-xs">Animated greeting gesture</p>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-red-400 mb-2">Advanced</h4>
                      <ul className="text-sm text-slate-400 space-y-2">
                        <li className="bg-slate-800/50 p-2">
                          <p className="font-medium text-white">Obstacle Avoidance</p>
                          <p className="text-xs">React to sensor readings</p>
                        </li>
                        <li className="bg-slate-800/50 p-2">
                          <p className="font-medium text-white">Sorting Demo</p>
                          <p className="text-xs">Sort objects by color/type</p>
                        </li>
                        <li className="bg-slate-800/50 p-2">
                          <p className="font-medium text-white">Drawing Pattern</p>
                          <p className="text-xs">Trace complex shapes</p>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Export */}
                <div className="bg-slate-900/50 border-2 border-cyan-500/30 p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <Download className="w-5 h-5 text-cyan-400" />
                    Export to Hardware
                  </h3>
                  <p className="text-slate-400 mb-4">
                    When your code works in simulation, export it to run on real hardware.
                    The exporter translates JavaScript to platform-specific code.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { name: 'Arduino', ext: '.ino', desc: 'C++ for Arduino Uno, Mega, Nano. Uses Servo library.', color: 'cyan' },
                      { name: 'MicroPython', ext: '.py', desc: 'Python for ESP32, ESP8266, Raspberry Pi Pico.', color: 'yellow' },
                      { name: 'CircuitPython', ext: '.py', desc: 'Python for Adafruit boards with easy hardware access.', color: 'purple' },
                      { name: 'Raspberry Pi', ext: '.py', desc: 'Python with pigpio for GPIO control. Includes Flask server.', color: 'pink' },
                    ].map((platform) => (
                      <div key={platform.name} className="bg-slate-800/50 p-4 border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-white">{platform.name}</span>
                          <span className="text-xs bg-slate-700 px-2 py-0.5 text-slate-300">{platform.ext}</span>
                        </div>
                        <p className="text-sm text-slate-400">{platform.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 bg-slate-800/30 p-4 border border-cyan-500/30">
                    <h4 className="font-semibold text-white mb-2">Export Steps</h4>
                    <ol className="text-sm text-slate-400 space-y-1">
                      <li>1. Click the download icon in the code editor toolbar</li>
                      <li>2. Select your target platform from the dropdown</li>
                      <li>3. Choose your hardware kit (Arduino Uno, ESP32, etc.)</li>
                      <li>4. Toggle options: include comments, auto pin mapping</li>
                      <li>5. Preview the generated code</li>
                      <li>6. Click Download or Copy to Clipboard</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* Keyboard Shortcuts */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-6">
                <div className="bg-slate-900/50 border-2 border-orange-500/30 p-6">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <Keyboard className="w-6 h-6 text-orange-400" />
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-slate-400">
                    Master these keyboard shortcuts to work faster and keep your hands on the keyboard.
                  </p>
                </div>

                {keyboardShortcuts.map((category) => (
                  <div key={category.category} className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                    <h3 className="text-lg font-bold text-white mb-2">{category.category}</h3>
                    <p className="text-sm text-slate-400 mb-4">{category.description}</p>
                    <div className="space-y-2">
                      {category.shortcuts.map((shortcut) => (
                        <div key={shortcut.keys} className="flex items-center gap-4 bg-slate-800/30 p-3">
                          <kbd className="px-3 py-1.5 bg-slate-800 border border-slate-600 text-orange-400 font-mono text-sm min-w-[120px] text-center">
                            {shortcut.keys}
                          </kbd>
                          <div className="flex-1">
                            <span className="text-white font-medium">{shortcut.action}</span>
                            <span className="text-slate-500 text-sm ml-2">— {shortcut.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="bg-slate-900/50 border-2 border-amber-500/30 p-6">
                  <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5" />
                    Gamepad Controls
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Connect a game controller for intuitive robot control. Xbox, PlayStation, and generic controllers are supported.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-3">
                      <p className="font-medium text-white">Left Stick</p>
                      <p className="text-sm text-slate-400">Base rotation / Shoulder angle</p>
                    </div>
                    <div className="bg-slate-800/50 p-3">
                      <p className="font-medium text-white">Right Stick</p>
                      <p className="text-sm text-slate-400">Elbow / Wrist pitch control</p>
                    </div>
                    <div className="bg-slate-800/50 p-3">
                      <p className="font-medium text-white">Bumpers (L1/R1)</p>
                      <p className="text-sm text-slate-400">Wrist roll left/right</p>
                    </div>
                    <div className="bg-slate-800/50 p-3">
                      <p className="font-medium text-white">Triggers (L2/R2)</p>
                      <p className="text-sm text-slate-400">Open/close gripper</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Troubleshooting */}
            {activeSection === 'troubleshooting' && (
              <div className="space-y-6">
                <div className="bg-slate-900/50 border-2 border-red-500/30 p-6">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <HelpCircle className="w-6 h-6 text-red-400" />
                    Troubleshooting Guide
                  </h2>
                  <p className="text-slate-400">
                    Solutions to common issues. If your problem isn't listed here, try refreshing the page
                    or clearing your browser cache.
                  </p>
                </div>

                {troubleshooting.map((item) => (
                  <div key={item.issue} className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                    <h3 className="text-lg font-bold text-red-400 mb-2">{item.issue}</h3>
                    <p className="text-sm text-slate-400 mb-4">{item.description}</p>
                    <div className="space-y-2">
                      {item.solutions.map((solution, i) => (
                        <div key={i} className="flex items-start gap-3 bg-slate-800/30 p-3">
                          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-300">{solution}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Browser Support */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Browser Compatibility</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    RoboSim works best in Chrome or Edge. Some features require specific browser APIs.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 text-slate-300">Feature</th>
                          <th className="text-center py-2 text-slate-300">Chrome</th>
                          <th className="text-center py-2 text-slate-300">Edge</th>
                          <th className="text-center py-2 text-slate-300">Firefox</th>
                          <th className="text-center py-2 text-slate-300">Safari</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { feature: '3D Rendering', chrome: true, edge: true, firefox: true, safari: true },
                          { feature: 'Voice Control', chrome: true, edge: true, firefox: false, safari: false },
                          { feature: 'Hand Tracking', chrome: true, edge: true, firefox: true, safari: true },
                          { feature: 'Serial Connection', chrome: true, edge: true, firefox: false, safari: false },
                          { feature: 'Gamepad', chrome: true, edge: true, firefox: true, safari: true },
                          { feature: 'ONNX Inference', chrome: true, edge: true, firefox: true, safari: true },
                        ].map((row) => (
                          <tr key={row.feature} className="border-b border-slate-800">
                            <td className="py-2 text-white">{row.feature}</td>
                            <td className="py-2 text-center">{row.chrome ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                            <td className="py-2 text-center">{row.edge ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                            <td className="py-2 text-center">{row.firefox ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                            <td className="py-2 text-center">{row.safari ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* System Limits */}
                <div className="bg-slate-900/50 border-2 border-slate-700/30 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">System Limits</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { limit: 'Robot Instances', value: '8 max', note: 'Per simulation session' },
                      { limit: 'Save Slots', value: '10 max', note: 'Plus auto-save' },
                      { limit: 'Physics Objects', value: '30 max', note: 'For performance' },
                      { limit: 'Camera Resolution', value: '320×240', note: 'Fixed resolution' },
                      { limit: 'Policy Inference', value: '20 Hz', note: 'Control frequency' },
                      { limit: 'Dataset Recording', value: '30 FPS', note: 'Frame capture rate' },
                    ].map((item) => (
                      <div key={item.limit} className="bg-slate-800/50 p-3">
                        <p className="font-medium text-white">{item.limit}</p>
                        <p className="text-lg text-blue-400 font-mono">{item.value}</p>
                        <p className="text-xs text-slate-500">{item.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
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
