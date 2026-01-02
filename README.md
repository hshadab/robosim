# RoboSim - Train Robot AI in Your Browser

**Generate 50 training episodes in 5 minutes instead of 5 hours of manual teleoperation.**

RoboSim is a web-based robotics simulation for the **SO-101 robot arm**. Generate synthetic training data, train policies on Google Colab, and deploy to real hardware.

**Live Demo:** [robosim.onrender.com](https://robosim.onrender.com)

## Why RoboSim?

Training real robots is slow and expensive:
- Physical robot costs $300-2000
- Manual demonstrations take hours
- Trial and error risks breaking hardware

RoboSim lets you:
- ✅ Start training **before hardware arrives**
- ✅ Generate **unlimited varied demos** automatically
- ✅ Train on **free Google Colab GPU**
- ✅ Transfer policies to **real SO-101** (sim-to-real)

## Who Is This For?

| Audience | Use Case |
|----------|----------|
| **Hobbyists/Makers** | Train AI for your SO-101 before assembly |
| **Robotics Students** | Learn imitation learning without lab access |
| **Researchers** | Generate synthetic data to bootstrap training |
| **Startups** | Prototype pick-and-place behaviors quickly |
| **Educators** | Teach robotics/ML without physical robots |

## Applications

- 📦 **Warehouse automation** - Pick, sort, place items
- 🔧 **Desktop manufacturing** - Small assembly tasks
- 🍽️ **Food service** - Prep, plating, sorting
- 🏠 **Home assistants** - Fetch objects, organize
- 🔍 **Quality inspection** - Pick up, examine, sort

## Pricing

| Feature | Free | Pro ($10/mo) |
|---------|------|--------------|
| Batch demos per day | 5 | Unlimited |
| Episodes per month | 50 | Unlimited |
| Object types | Cubes | Cubes, Balls, Cylinders |
| HuggingFace upload | - | Yes |
| AI chat control | - | Yes |
| Image-to-3D | - | Yes |
| Export formats | JSON | JSON, Parquet, LeRobot |

[Upgrade to Pro](https://buy.stripe.com/cNibJ0fTA5D5cdZdXgbEA00)

## Hybrid Control Architecture

RoboSim uses a **hybrid approach** for robot control, optimizing for both reliability and flexibility:

| Mode | Method | Best For |
|------|--------|----------|
| **Batch Demos** | Template-based | Training data generation |
| **Chat Control** | AI-planned (LLM) | Exploration & testing |

### Template-Based Demos (Reliable)
When you click "Generate 10 Demos", RoboSim uses **proven motion templates**:
- Pre-defined waypoint sequences for Pickup, Stack, and Place tasks
- Parameterized variations (position, speed, approach angle)
- Consistent, high-quality training data

### AI-Planned Chat (Flexible)
When you type in the chat box, an **LLM interprets your intent**:
- Natural language understanding ("stack the blue cube on red")
- Dynamic motion planning based on scene state
- Great for experimentation, but results may vary

This hybrid approach ensures training data is reliable while still allowing natural language control for exploration.

## Recent Updates (January 2025)

### Enhanced Sim-to-Real Export (NEW)
Major improvements for realistic data export to LeRobot/HuggingFace:

**Motor Dynamics Simulation**
- **Velocity/Acceleration Limits** - Per-joint limits matching STS3215 servo specs
- **P-Controller Response** - Realistic tracking with configurable gain
- **Target vs Actual Joints** - Separation for motor lag simulation
- **Latency Simulation** - Configurable command latency (0-50ms)
- Enable with: `useAppStore.getState().setMotorDynamics({ enabled: true })`

**Joint Velocity Estimation**
- **Velocity Export** - `observation.velocity` field (6-DOF in rad/s)
- **Computed from Delta** - Auto-computed from position changes when not recorded
- **Statistics Export** - Min/max/mean/std in `stats.json`

**Multi-Camera Export**
- **LeRobot Camera Views** - `cam_high`, `cam_wrist`, `cam_left`, `cam_right`
- **Per-Camera Directories** - `videos/observation.images.<view>/`
- **Auto Feature Registration** - Each camera registered in `info.json`

**Camera Intrinsics**
- **Pinhole Model** - Auto-computed fx, fy, cx, cy from FOV and resolution
- **Distortion Coefficients** - k1, k2, p1, p2, k3 for lens calibration
- **SO-101 Presets** - Default, overhead, side camera configurations

### Enhanced LeRobot Export
Major improvements to make exported datasets more realistic for sim-to-real transfer:

**Data Format Improvements**
- **Joint Units in Radians** - All joint angles now exported in radians (LeRobot standard), gripper normalized 0-1
- **30Hz Recording Rate** - Matches LeRobot standard control rate (was 60fps)
- **10Hz Camera Capture** - Images captured during motion at 10Hz, synced to nearest frames

**Image Domain Randomization**
- **Gaussian Noise** - Random sensor noise (0-10 sigma per episode)
- **Motion Blur** - Simulates camera/arm movement (0-3px)
- **Brightness Variation** - ±15 brightness adjustment per episode
- **Contrast Variation** - 0.9-1.1x contrast scaling

**HuggingFace Dataset Card**
- **YAML Front Matter** - Proper metadata for Hub discovery (license, tags, size)
- **Training Commands** - ACT and Diffusion policy commands included
- **Sim-to-Real Tips** - Camera calibration, action scaling, gripper mapping
- **Citation Info** - BibTeX for proper attribution

### Production-Ready Sim-to-Real Transfer
Complete pipeline for generating transfer-ready synthetic training data:

**Visual Domain Randomization**
- **Randomizable Lighting** - Intensity, color temperature, shadow variation per episode
- **Procedural Textures** - Floor textures (wood, concrete, metal, checker, noise) generated in-browser
- **Distractor Objects** - Random cubes, spheres, cylinders in the scene for visual robustness
- **Camera Jitter** - Position and rotation variation for viewpoint diversity

**Motion Quality**
- **Ease-in-out Cubic Interpolation** - Smooth, natural trajectories matching real robot motion
- **Approach Angle Variation** - ±1.5° base offset (conservative for reliable grasp)
- **Wrist Roll Variation** - 85-95° (within proven working range)
- **Speed Variation** - 0.9-1.1x speed factor per episode (realistic motor variance)
- **Joint Offset Variation** - ±1° shoulder/elbow offsets for approach diversity

**Post-Hoc Augmentation**
- **Image Augmentation** - Color jitter, random crop, cutout/occlusion, Gaussian noise
- **Time Warping** - Non-linear temporal stretching (sine, quadratic, smooth warp types)

**Sim-to-Real Calibration**
- **System Identification** - Per-joint friction, damping, backlash, inertia parameters
- **Action Calibration** - Sim-to-real angle mapping, PWM pulse conversion
- **Camera Presets** - SO-101 camera configurations matching real hardware
- **Export Metadata** - All calibration data included in LeRobot exports

### Google Colab Training Integration (NEW)
- **One-Click Colab** - "Train on Google Colab" button opens pre-configured notebook
- **Free GPU Training** - Uses Google's free T4 GPU (~2 hours for ACT policy)
- **No Setup Required** - LeRobot installs automatically in notebook
- **Dataset Auto-Fill** - Your HuggingFace dataset ID shown for easy copy-paste
- **Full Pipeline** - Record demos → Upload → Train on Colab → Deploy to real SO-101

### Batch Demo Generation (Updated Dec 2024)
- **"Generate 10 Demos" Button** - One-click generates 10 varied pickup demonstrations
- **Optimal Reach Zone** - Cube positions at 18-22cm forward (arm's natural reach), ±3cm sideways
- **Adaptive Joint Angles** - Shoulder/elbow interpolated per cube position for reliable grasp
- **Instant Gripper Close** - Immediate gripper close with 1s physics settle time
- **Proven 3-Move Sequence** - Position arm → Close gripper → Lift (verified working)
- **Real Training Data** - Each demo with varied position, speed (0.95-1.05x), and wrist roll (88-92°)

### LeRobot Format Compatibility (NEW)
Export format matches official SO-101 datasets on HuggingFace:
- **Same Joint Names** - shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper
- **Same Data Structure** - observation.state [6], action [6], episode_index, frame_index, timestamp
- **stats.json Normalization** - Min/max/mean/std for policy training
- **Parquet + MP4** - Native LeRobot v3.0 format
- **Tested Against** - [lerobot/svla_so101_pickplace](https://huggingface.co/datasets/lerobot/svla_so101_pickplace)

### LLM Training Data Collection
- **Automatic Success/Failure Logging** - Every pickup attempt is logged with outcome
- **Pickup Examples Store** - Successful pickups stored for few-shot learning
- **Similar Pickup Lookup** - Find working examples for similar objects/positions
- **Training Export** - Export successful pickups to LeRobot format
- **Stats Dashboard** - Track success rates by object type

### Few-Shot Learning in System Prompt (NEW)
- **Proven Working Examples** - System prompt includes verified pickup configurations
- **Dynamic Context** - Similar successful pickups shown for current scene objects
- **Critical Pickup Rules** - wristRoll orientation, timing, physics requirements documented
- **Success Rate Display** - LLM sees overall pickup success rate

### Reliable Chat-Based Pickup
- **Simplified 4-Step Sequence** - Position → Close (800ms) → Hold → Lift
- **Physics-Tuned Timing** - 800ms gripper close gives physics time to detect contact
- **Matches Demo Pick Up** - Chat pickup now as reliable as the one-click demo
- **IK-Solver Based** - Accurate joint angles from numerical inverse kinematics

### Production-Ready Training Data Pipeline
- **Camera Frame Capture** - Capture RGB frames at 30 FPS during chat-based recording
- **Task Success Detection** - Automatic verification that objects reached target positions
- **Physics Domain Randomization** - Vary friction, mass, motor latency per episode for sim-to-real transfer
- **Quality Gates** - Block export of low-quality episodes (jerky motion, static frames, failed tasks)

### WebGPU Renderer
- **Migrated to WebGPU** - Now uses Three.js WebGPU renderer via React Three Fiber v9
- **Node Materials** - All materials converted to TSL (Three Shading Language) node materials
- **Automatic Fallback** - Seamlessly falls back to WebGL on unsupported browsers
- **Browser Support**: Chrome 113+, Safari 18+, Edge 113+, Firefox (experimental)

### Simplified Training Objects
Streamlined object library focused on reliable training:
- **6 Training Cubes** - Red, Blue, Green, Yellow, Purple, Orange (2.5-3cm)
- **Optimized for SO-101** - Size matched to gripper capacity
- **Consistent Physics** - All objects have reliable grasp behavior
- **No Clutter** - Removed 30+ unused objects for cleaner UI

### Reliable Object Grasping
- **Grasp Manager** - Detects gripper closing, attaches objects kinematically
- **Jaw Position Targeting** - IK now targets jaw position (not tip), fixing 7.3cm offset issue
- **Physics System** - Proper collision, friction, and mass for all objects
- **Visual Feedback** - Grabbed objects glow green

### Improved UI
- **Floating Tools Button** - Access manual controls from right edge
- **No Screen Darkening** - Drawer slides without overlay

See `docs/GRIPPER_ANALYSIS.md` and `docs/GRASP_PROBLEM_ANALYSIS.md` for technical details.

## Features

### Robot Support
- **SO-101 Robot Arm** (Fully Supported) - 6-DOF open-source desktop arm from The Robot Studio
  - Realistic 3D model loaded from official URDF
  - STS3215 servo motors with 1/345 gear ratio
  - LeRobot (HuggingFace) Python export for real hardware
  - Full AI control, data recording, and policy execution
- **Wheeled Robot** (Coming Soon) - Differential drive mobile robot
- **Quadcopter Drone** (Coming Soon) - 4-motor drone with flight controls
- **Humanoid** (Coming Soon) - Bipedal robot with manipulation

### 3D Visualization
- **WebGPU Rendering** - Next-generation GPU API for faster rendering and better lighting
  - Automatic WebGL fallback for unsupported browsers
  - TSL (Three Shading Language) node materials
  - Works on Chrome 113+, Safari 18+, Firefox (behind flag)
- Real-time 3D rendering with PBR materials
- Physics simulation using Rapier
- Multiple environment options (empty, warehouse, outdoor, maze)
- Contact shadows and studio lighting

### Interactive Controls (SO-101)
- Joint sliders for precise control
- Preset positions and animations
- Multiple control modes (manual, keyboard, gamepad, IK click-to-move)

### Advanced Arm Controls (SO-101)
- **Inverse Kinematics** - Click-to-move in 3D space with reachability preview
- **Numerical IK Solver** - Jacobian-based solver with damped least squares and CCD methods
- **Keyboard Teleoperation** - WASD + arrow keys for real-time control
- **Gamepad Support** - Full controller support with analog sticks
- **Task Templates** - Pre-programmed pick & place, stacking, and demo sequences
- **Trajectory Planning** - Smooth cubic/quintic interpolated motion paths
- **Workspace Visualization** - Semi-transparent dome showing reachable area

### Numerical Inverse Kinematics
- **Damped Least Squares (DLS)** - Singularity-robust Jacobian pseudo-inverse method
- **Cyclic Coordinate Descent (CCD)** - Fast iterative solver for chain kinematics
- **Multi-Start Optimization** - Try multiple initial configurations to find best solution
- **Trajectory Generation** - Smooth interpolated paths through IK waypoints
- **Manipulability Analysis** - Real-time measure of dexterity and singularity detection
- **Configurable Parameters** - Damping factor, step size, convergence tolerance
- **Joint Limit Handling** - Respects joint limits with configurable safety margins

### Real-time Monitoring
- **Joint Trajectory Graph** - Live plotting of all joint positions over time
- **Sensor Panel** - Joint angles, velocities, and gripper status

### Hardware Integration
- **Web Serial Connection** - Connect to real robot via USB (Chrome/Edge)
- **Auto-sync Mode** - Mirror simulation to hardware in real-time (30-60 Hz)
- **PWM Command Generation** - Automatic servo microsecond conversion

### Sensors & Visualization
- Robot camera view (picture-in-picture)
- Joint position/velocity sensors
- End-effector position tracking
- Gripper state monitoring

### Sensor Noise Models (Sim-to-Real Transfer)
- **Configurable Realism Levels** - None, Low, Medium, High, Extreme
- **Noise Types Supported**:
  - Gaussian noise (configurable standard deviation)
  - Systematic bias
  - Quantization (discrete sensor resolution)
  - Dropout (random sensor failures)
  - Lag/latency simulation
  - Jitter (timing variations)
  - Spike artifacts (sudden large errors)
- **Per-Sensor Profiles** - Realistic defaults for encoder, IMU, camera, and joint sensors
- **Real-time Toggle** - Enable/disable noise without restarting
- **UI Panel** - Intuitive controls in the Tools sidebar

### Robot Vision (Camera Simulation)
- **RGB Image Capture** - Capture frames from 3D viewport
- **Blob Detection** - Color-based object detection with connected components
- **Color Presets** - Red, Green, Blue, Yellow, Orange, Purple filters
- **HSV Filtering** - Industry-standard hue/saturation/value thresholds
- **Real-time Processing** - Configurable capture rate (1-30 FPS)
- **Visual Overlay** - Bounding boxes and centroids displayed on feed
- **Image Processing** - Edge detection, blur, brightness/contrast utilities

### State Persistence
- **Named Save Slots** - Up to 10 named saves with timestamps
- **Auto-Save** - Automatic background saving at configurable intervals
- **Import/Export** - Download and upload save files as JSON
- **IndexedDB Storage** - Large state data stored in browser database
- **Quick Resume** - Load auto-save to continue from last session
- **State Preview** - See robot type and timestamp before loading

### Multi-Robot Instances
- **Up to 8 Robots** - Run multiple SO-101 arm instances simultaneously
- **Formation Patterns** - Line, grid, circle, and V-formation layouts
- **Per-Robot State** - Each instance maintains independent joint states
- **Active Robot Selection** - Click to switch control focus between robots
- **Clone Robots** - Duplicate existing robots with offset positions
- **Collision Detection** - Automatic proximity checking between robots
- **Enable/Disable** - Toggle individual robot visibility and updates
- **Swarm Robotics Ready** - Foundation for multi-agent coordination

### AI Environment Generator (Gemini Integration)
- **AI-Generated Backgrounds** - Create custom scene backdrops using natural language
  - Presets: Warehouse, Garden, Laboratory, Space Station, Cartoon Workshop
  - Styles: Realistic, Cartoon, Abstract, Minimalist
  - Moods: Bright, Dark, Warm, Cool
- **AI-Generated Textures** - Create floor and wall textures with tiling support
  - Seamless textures for realistic surfaces
  - Materials: Concrete, Wood, Metal, Custom descriptions
- **AI-Generated Objects** - Create interactive objects the robot can manipulate
  - Shapes: Cube, Sphere, Cylinder
  - Styles: Realistic, Cartoon
  - Physics-enabled for picking and placing
- **Google Gemini API** - Powered by Gemini 2.0 Flash image generation
- **Scene Integration** - Apply generated content directly to 3D viewport
- **Download Option** - Save generated images for external use

### Voice Control (Web Speech API)
- **Hands-free Operation** - Control robots using voice commands
- **Wake Word Support** - Optional "Hey Robot" activation
- **Continuous Listening** - Keep listening for commands
- **Voice Feedback** - Spoken confirmations of actions
- **Command Categories**:
  - Movement: "move left", "go forward", "turn right"
  - Gripper: "open gripper", "grab object", "release"
  - Presets: "wave hello", "go home", "dance"
  - Queries: "where are you?", "what's your position?"
- **Browser Support** - Chrome, Edge (Web Speech API required)

### Vision-Language Analysis (Claude Vision)
- **Scene Understanding** - Ask "What's in the scene?" and get detailed answers
- **Object Detection** - Local DETR model for detecting objects
- **Scene Classification** - Identify environment types (warehouse, lab, outdoor)
- **Graspable Object Recognition** - Identify objects the robot can pick up
- **Spatial Queries** - "Where is the red object?", "What can I grab?"
- **Suggested Actions** - AI recommends next steps based on scene analysis
- **Dual Mode** - Works locally with Transformers.js, enhanced with Claude API

### Code Copilot (AI-Powered Editor)
- **Smart Autocomplete** - Robot API function suggestions
- **Code Generation** - Generate code from comments (Ctrl+Shift+G)
- **Code Explanation** - Explain selected code (Ctrl+Shift+E)
- **Error Fixing** - AI suggests fixes for runtime errors
- **Code Templates** - Pre-built patterns for common tasks
- **Works Offline** - Basic features work without API key

### Text-to-3D Model Generation
- **Natural Language Input** - Describe objects like "red apple" or "wooden box"
- **Procedural Meshes** - Generates appropriate 3D geometry
- **AI Textures** - Optional Gemini-powered texture generation
- **Multiple Styles** - Realistic, Cartoon, Low-poly, Voxel
- **Physics Enabled** - Generated objects work with robot interaction
- **Preset Objects** - Quick generation of common items
- **Scene Generation** - Create multiple objects from descriptions

### Image-to-3D Object Generation (ENHANCED)
- **Photo to 3D Model** - Upload real object photos and convert to training-ready 3D models
- **Multi-Image Support** - Upload up to 4 photos from different angles for better 3D reconstruction
- **Multiple API Services**:
  - **fal.ai (TripoSR)** - Fast (~10-30s), affordable ($0.07/gen)
  - **CSM.ai** - High quality, free tier (10 credits)
  - **Rodin (Hyper3D)** - Highest quality, multiple tiers
- **Auto Mesh Analysis** - Automatically extracts real dimensions from generated GLB
- **Smart Physics Colliders**:
  - Spherical objects → Ball collider
  - Cylindrical objects → Cylinder collider
  - Complex shapes → Convex hull collider
  - Box-like objects → Box collider
- **Improved Grasp Estimation** - Object-type-aware grasp points (bottles, tools, flat objects, etc.)
- **Volume-Based Mass** - Mass calculated from actual mesh volume
- **Download & Use** - Download GLB file or add directly to scene with physics
- **Training Pipeline** - Generates parameterized task templates for the object

### Code Editor
- Built-in JavaScript code editor with Monaco
- Robot API for programmatic control
- Code templates for common tasks
- Console output panel
- **AI Code Copilot** - Intelligent completions and suggestions

### Hardware Export
- **LeRobot Python** - Export to HuggingFace LeRobot framework for SO-101
- **Arduino** - Export to Arduino C++ for various hardware kits
- **MicroPython** - Export to MicroPython for ESP32/Raspberry Pi Pico

### AI Chat Assistant (Prompt-First Architecture)
- **Natural Language Control** - Describe what you want in plain English
- **Reliable Pickup Commands** - "Pick up the red cube" works with physics-tuned 4-step sequence
- **Physics-Accurate Grasping** - 800ms gripper timing ensures reliable physics contact detection
- **Semantic State Awareness** - LLM sees robot state in natural language, not just raw numbers
- **Context-Aware Responses** - LLM understands current pose, can do relative movements ("move a bit left")
- **Bidirectional Communication** - Robot events appear in chat (task completed, errors, etc.)
- **Clarifying Questions** - LLM can ask for more details when needed

### Policy Loading from HuggingFace Hub
- **Browse LeRobot Policies** - Search and discover trained policies from HuggingFace Hub
- **ONNX Runtime** - Run policies locally in browser using ONNX Runtime Web
- **SafeTensors Support** - Load SafeTensors model weights directly (native HuggingFace format)
- **Policy Types Supported** - ACT (Action Chunking Transformer), Diffusion, TD-MPC, VQ-BeT
- **SO-101 Compatible** - Filter and load policies trained for SO-101/Koch robot arms
- **Real-time Inference** - Execute policies at 20Hz for smooth robot control
- **No Server Required** - All inference runs client-side in WebAssembly

### LeRobot Dataset Recording & Export (ENHANCED)
- **LeRobot v3.0 Compatible** - Full compatibility with HuggingFace LeRobot format
- **Complete 6-Joint Capture** - Records all SO-101 joints (base, shoulder, elbow, wrist, wristRoll, gripper)
- **Accurate Statistics** - Proper standard deviation calculation for feature normalization
- **Multi-Camera Recording** - Support for cam_high, cam_wrist, cam_left, cam_right views
- **Dataset Statistics Dashboard** - Analyze episode counts, success rates, joint coverage
- **Quality Recommendations** - Get feedback on data quality for training readiness
- **Dataset Browser** - Browse and preview LeRobot datasets from HuggingFace Hub
- **HuggingFace Upload** - Direct upload with proper LeRobot directory structure
- **Task Success Detection** - Automatic detection for reach, pick & place, push, stack tasks
- **Python Conversion Script** - Included `convert_to_parquet.py` for true Parquet format
- **Auto-Generated README** - Dataset documentation included in exports

### Interactive Tutorial System
- **Guided Tutorials** - Step-by-step walkthroughs for new users
- **Three Modules** - Getting Started, AI Features, Data Collection
- **Progress Tracking** - Completion status saved locally
- **Panel Highlighting** - Points to relevant UI elements
- **Tips & Hints** - Contextual tips for each step

### Guided Challenge System (NEW)
- **Interactive Challenges** - Learn robot control through hands-on exercises
- **Real-time Position Validation** - Visual feedback as you match target positions
- **Three Challenge Levels**:
  - Basic Movement: Learn individual joint controls
  - Reach Position: Practice moving to specific poses
  - Pick Motion Sequence: Master pick-and-place workflow
- **Progress Tracking** - Step-by-step indicators with auto-advance
- **Hints & Success Messages** - Get help when stuck, celebrate completions
- **Tolerance-based Matching** - Configurable accuracy requirements

### Parameterized Task Templates (NEW)
- **Configurable Waypoints** - Define robot motions with variable parameters
- **Variable References** - Use `${paramName}` syntax for dynamic values
- **Built-in Templates**:
  - Pick-and-Place: Configurable pick/place positions
  - Stack Objects: Multi-height stacking sequences
  - Reach Target: Precision positioning tasks
  - Wave Hello: Demo animation with timing control
- **Parameter Randomization** - Auto-generate variations for training data
- **Custom Template Creation** - Define your own parameterized tasks

### Visual Domain Randomization (NEW)
- **Lighting Controls** - Ambient intensity, directional light, shadow softness
- **Material Variations** - Metalness, roughness, color tinting
- **Camera Randomization** - FOV, position jitter for viewpoint diversity
- **Preset Configurations**:
  - Bright Studio: Clean, well-lit environment
  - Moody: Dark, dramatic lighting
  - Outdoor: Natural sunlight simulation
  - Factory: Industrial lighting conditions
- **Auto-Randomize Mode** - Continuously vary visual parameters
- **Sim-to-Real Ready** - Prepare policies for real-world transfer

### Dataset Augmentation (NEW)
- **Trajectory Augmentation** - Multiply datasets with variations
- **Augmentation Types**:
  - Action Noise: Gaussian noise on joint targets
  - Time Stretching: Speed up/slow down trajectories
  - Spatial Jitter: Small position variations
  - Temporal Dropout: Skip frames for robustness
  - Mirror/Flip: Create symmetric variations
- **Preview Before Apply** - See augmentation effects before generating
- **Configurable Multiplier** - 2x to 10x dataset expansion
- **Quality Preservation** - Maintains trajectory smoothness

### Auto-Episode Generator
- **One-Click Generation** - Create 100+ episodes instantly
- **Template-Based** - Uses parameterized task templates
- **Randomized Parameters** - Each episode has unique variations
- **Combined with Augmentation** - Base episodes × augmentation multiplier
- **Progress Tracking** - Real-time generation progress
- **Export Options**:
  - LeRobot Format: Direct HuggingFace compatibility
  - JSON Export: For custom training pipelines
- **Estimated Output** - Preview episode count before generating

### Object Library (Simplified)
- **6 Training Cubes** - Red, Blue, Green, Yellow, Purple, Orange cubes
- **Optimized Sizes** - 2.5-3cm cubes ideal for SO-101 gripper
- **3 Scene Presets** - Single Cube, Two Cubes, Color Set
- **One-Click Setup** - Load scenes instantly for training
- **Clean UI** - Streamlined from 34 objects to focus on what works

### LLM → Physics Recording (NEW)
- **Natural Language to Data** - Type "Stack the red block on blue" → generates training episodes
- **Physics Simulation** - Runs actual simulation with Rapier physics engine
- **Camera Capture** - Records RGB frames at 30 FPS during execution
- **Language-Conditioned Datasets** - Instructions embedded in metadata for RT-1/OpenVLA
- **Batch Generation** - Generate 1-50 varied episodes per instruction
- **Scene Integration** - Uses Object Library presets for realistic scenes
- **Motion Plan Parsing** - AI converts instructions to robot waypoints
- **Export Ready** - Direct LeRobot v3.0 format with images + language

### Chat → Training Data (NEW)
- **Live Recording from Chat** - Every chat command becomes a labeled training episode
- **Auto-Record Mode** - Automatically captures demonstrations as you chat
- **Session Management** - Start/stop recording sessions with full control
- **Quality Metrics** - Real-time smoothness, velocity, and duration tracking
- **Success/Fail Labeling** - Mark episodes for filtering during training
- **Language Instructions** - Chat messages become language labels automatically
- **Natural Demonstrations** - Create diverse data through natural conversation
- **Camera Frame Capture** - RGB frames captured at 30 FPS during recording
- **Task Verification** - Automatic success detection (did object reach target?)

### Quick Train Flow (Apple-Inspired UX)
- **"Generate 10 Demos" Button** - One-click creates 10 varied pickup demonstrations
- **Honest Physics** - 1.5cm grasp threshold ensures real training data (no fake pickups)
- **Position-Aware Reach** - Arm angles interpolate per object position
- **6 Training Cubes** - Simplified object library focused on what works
- **Photo to 3D** - Upload a photo and convert to training-ready 3D model via fal.ai
- **Direct HuggingFace Upload** - One-click export with automatic Parquet conversion
- **Train on Google Colab** - One-click opens pre-configured notebook with your dataset
- **Free GPU Training** - Uses Google's T4 GPU, no local setup required
- **Tools Drawer** - All advanced tools hidden in slide-out panel for minimal distraction

### Guided Teleoperation Recording (NEW)
- **Task Templates** - Pre-defined tasks: Pick & Place, Stacking, Pushing, Waypoint Navigation
- **Step-by-Step Visual Guides** - 3D overlays show target positions, arrows, and ghost gripper
- **Real-Time Quality Indicators** - Smoothness score, velocity tracking, duration monitoring
- **Automatic Language Generation** - Task templates include varied language instructions
- **Keyboard/Gamepad Teleoperation** - WASD + gamepad support for smoother demonstrations
  - Keyboard: WASD (base/shoulder), QE (elbow), RF (wrist), ZXC (gripper/roll)
  - Gamepad: Left stick (base/shoulder), Right stick (elbow/wrist), Triggers (gripper)
- **Quality Scoring** - Episodes rated as excellent/good/acceptable/poor
- **Dataset Statistics Dashboard** - Comprehensive analysis before export

### Enhanced Teleoperation for Dataset Collection
- **Smooth Acceleration** - Cubic easing for natural robot motion
- **Configurable Speed** - Shift to speed up, Ctrl to slow down
- **Preset Positions** - H for home, G for ready position
- **Dead Zone Control** - Adjustable gamepad sensitivity
- **Visual Feedback** - Active joint highlighting during control

### HuggingFace Hub Integration (NEW)
- **Direct Upload** - Push datasets to HuggingFace without CLI
- **Token Authentication** - Secure API token validation
- **Auto Repository Creation** - Creates dataset repos automatically
- **Dataset Card Generation** - Auto-generates README with metadata
- **Public/Private Toggle** - Control dataset visibility
- **Upload Progress** - Real-time progress tracking
- **Direct Link** - Open uploaded dataset in browser

### Minimal UI Design (Apple-Inspired)
- **One-Button Flow** - Main interface shows only the Quick Train wizard
- **Progressive Disclosure** - Complex features hidden until needed
- **Slide-Out Tools Drawer** - Access all 20+ panels via settings button
- **Step-Based Wizard** - Clear progression: Add Object → Demo → Generate → Upload
- **Distraction-Free** - Focus on the task, not the UI

### Physics Domain Randomization (NEW)
- **Per-Episode Variation** - Randomize physics parameters for each training episode
- **Friction Randomization** - Vary gripper, object, and floor friction (0.6x - 1.5x)
- **Mass Randomization** - Object mass varies between episodes (0.7x - 1.4x)
- **Motor Latency Simulation** - Simulate real servo command delays (0-50ms)
- **Motor Jitter** - Add realistic noise to joint commands (up to 0.02 rad)
- **Gravity Variation** - Small gravity changes for robustness (±0.2 m/s²)
- **Seeded Randomization** - Reproducible physics for debugging
- **Sim-to-Real Transfer** - Policies trained with randomization transfer better to real hardware

### Quality Gates for Export (NEW)
- **Automatic Quality Validation** - Episodes checked before export
- **Jerk Detection** - Reject jerky, unsmooth trajectories
- **Static Frame Detection** - Reject episodes with too much idle time
- **Action Variance Check** - Reject no-op episodes with minimal movement
- **Task Confidence Threshold** - Only export episodes with verified task success
- **Batch Quality Summary** - See pass/fail rates across all episodes
- **Filter or Block Modes** - Either skip failed episodes or block entire export
- **Quality Score (0-100)** - Overall episode quality rating

### Physics Simulation Realism (NEW)

RoboSim implements several features to ensure training data transfers well to real robots:

#### Numerical Inverse Kinematics Solver
- **URDF-Based Forward Kinematics** - Uses exact URDF joint transforms for accurate position calculation
- **Asymmetric Starting Configurations** - Optimized for reaching distant objects at low heights
- **Multi-Start Gradient Descent** - Tries 18+ starting configurations with 5 base angles
- **Sub-centimeter Accuracy** - Typical solutions achieve <2mm positioning error
- **Automatic Base Rotation** - Calculates optimal base angle to face target position
- **Adaptive Step Sizes** - 8 refinement passes from 10° down to 0.05° for precision
- **Graceful Fallback** - If IK fails, falls back to heuristic control with distance-based parameters

#### Physics-Realistic Gripper
- **Friction-Based Grasping** - Objects held by physics friction forces, not teleport-attach
- **Dual Kinematic Jaws** - Fixed and moving jaw as separate Rapier rigid bodies
- **URDF-Tracked Position** - Jaw colliders follow actual gripper link transforms
- **Tapered Jaw Geometry** - 3 colliders per jaw approximating real SO-101 jaw shape
- **High Friction Coefficient** - Jaw friction: 2.0, Object friction: 1.5 for reliable grip
- **Moving Jaw Rotation** - Jaw opens/closes based on gripper joint angle (0-100%)

#### Object Spawn Positioning
- **Polar Coordinate Spawning** - Objects spawn in reachable workspace using distance + angle
- **Distance Range** - 18-25cm from robot base for optimal manipulation
- **Angular Range** - ±40° from +X axis (within ±110° base joint limit)
- **Minimum X Enforcement** - Objects guaranteed X ≥ 10cm to avoid dead zone
- **Scaled for Gripping** - Objects spawn at 60% template size for easier grasping

#### IK-Based Commands
- **Pick-up Sequences** - "pick up the cube" calculates three IK solutions (approach, grasp, lift)
- **Stack Commands** - "stack on the blue block" places held object on top of another using IK
- **Place Commands** - "place" and "put down" use FK to find current position, then IK to lower
- **Move to Object** - "move to the red cube" positions gripper above the specified object
- **Elevated Objects** - Pick-up/stack automatically adjusts heights for objects on shelves or other surfaces
- **Click-to-Move** - Click anywhere in 3D view and IK calculates joint angles to reach it
- **Fallback Mode** - If IK fails (unreachable position), gracefully falls back to heuristic control

#### Realistic Motor Dynamics
- **Velocity-Limited Motion** - Joints respect the STS3215 servo's 180°/s maximum velocity
- **Rise Time Simulation** - 150ms first-order response matching real servo behavior
- **S-Curve Easing** - Quintic S-curve (not cubic) for smooth acceleration/deceleration
- **Minimum Duration Enforcement** - Large movements automatically take longer (velocity-limited)

#### Why This Matters for Sim-to-Real
| Feature | Before | After | Real Robot |
|---------|--------|-------|------------|
| Joint velocity | Instant | 180°/s max | 180°/s max ✓ |
| Motion profile | Cubic ease | S-curve | S-curve ✓ |
| IK accuracy | ~70mm error | <2mm error | <2mm error ✓ |
| Pick-up planning | Heuristic | IK-based | IK-based ✓ |
| Gripper physics | Teleport-attach | Friction-based | Friction-based ✓ |
| Stack commands | Not supported | IK-based | IK-based ✓ |
| Move to object | Not supported | IK-based | IK-based ✓ |
| Object spawning | Random X,Z | Polar reachable | N/A |
| Friction | Fixed | Randomized ±50% | Varies ✓ |
| Mass | Fixed | Randomized ±40% | Varies ✓ |
| Motor latency | None | 0-50ms | 10-30ms ✓ |
| Motor jitter | None | ±0.02 rad | Present ✓ |
| Motor dynamics | Instant | P-controller | P-controller ✓ |
| Velocity export | None | rad/s per joint | rad/s ✓ |
| Camera intrinsics | None | Pinhole model | Calibrated ✓ |
| Multi-camera | Single | 4 views | Multi-view ✓ |

Training data generated with these improvements will transfer better to real SO-101 hardware because the simulated trajectories match what the real servos can actually achieve, and domain randomization ensures policies are robust to real-world variations.

## End-to-End Training Workflow

RoboSim provides a complete pipeline from demonstration to trained policy:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ROBOSIM TRAINING PIPELINE                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. SNAP IT              2. TEACH IT             3. TRAIN IT            │
│   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐         │
│   │  📸 Photo   │   →    │  💬 Chat    │   →    │  🚀 Colab   │         │
│   │  or Object  │        │  Commands   │        │  Training   │         │
│   │  Library    │        │  "pick up"  │        │  (Free GPU) │         │
│   └─────────────┘        └─────────────┘        └─────────────┘         │
│         │                       │                      │                 │
│         ▼                       ▼                      ▼                 │
│   3D model in scene      50-100 episodes       Trained ACT policy       │
│                          on HuggingFace        ready for SO-101         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Guide

1. **Click "Generate 10 Demos"** - Auto-runs 10 pickups at varied positions
2. **Click "Generate Training Data"** - Augments 10 → 50 episodes
3. **Upload to HuggingFace** - One-click upload with your HF token
4. **Train on Colab** - Click "Train on Google Colab" button
5. **Run notebook** - Just click "Run All" in the Colab notebook
6. **Deploy** - Download trained model and run on real SO-101

### Training Requirements

| Component | Requirement |
|-----------|-------------|
| Demos needed | 10 (auto-generated with one click) |
| Episodes generated | 50 (augmented from 10 base demos) |
| Training time | ~2 hours on free Colab GPU |
| GPU required | No (Colab provides free T4) |
| Local setup | None (everything in browser + Colab) |

### Google Colab Notebook

The included notebook (`notebooks/train_so101_colab.ipynb`) handles:
- LeRobot installation
- Dataset loading from HuggingFace
- ACT policy training configuration
- Model saving to HuggingFace Hub
- Download option for local deployment

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/hshadab/robosim/blob/main/notebooks/train_so101_colab.ipynb)

## Tech Stack

- **Frontend**: React 19, TypeScript
- **3D Graphics**: Three.js (WebGPU), React Three Fiber v9, React Three Drei
  - WebGPU renderer with automatic WebGL fallback
  - TSL node materials for cross-renderer compatibility
- **Physics**: Rapier (via @react-three/rapier)
- **ML Inference**: ONNX Runtime Web, HuggingFace Transformers.js
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Modern browser with WebGPU support (Chrome 113+, Safari 18+) or WebGL fallback

### Installation

```bash
# Clone the repository
git clone https://github.com/hshadab/robosim.git
cd robosim

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Testing

RoboSim uses a multi-tier testing strategy for fast feedback during development and comprehensive validation before deployment.

#### Quick Start

```bash
# Fast tests for development (~41 seconds total)
npm run test:all

# Unit tests only (~1 second)
npm run test:unit

# Smoke E2E tests (~40 seconds)
npm run test:e2e:smoke

# Full E2E tests (~7 minutes)
npm run test:e2e:full
```

#### Test Commands

| Command | Time | Description |
|---------|------|-------------|
| `npm run test:all` | **~41s** | Unit tests + smoke E2E (recommended for dev) |
| `npm run test:unit` | **~1s** | 17 unit tests for batch demo logic |
| `npm run test:e2e:smoke` | **~40s** | 3 quick E2E tests (app load, single demo, 3 batch demos) |
| `npm run test:e2e:full` | **~7min** | Full 10-demo batch test with camera capture |
| `npm run test:e2e:headed` | varies | Run E2E with visible browser for debugging |
| `npm run test:e2e:ui` | interactive | Playwright UI mode for test development |

#### Unit Tests (Vitest)

Fast tests that validate batch demo logic without a browser:

```bash
npm run test:unit
```

**Coverage (17 tests, <1 second):**
- Position variety validation (x: 16/17/18cm positions)
- Synthetic frame generation at 30fps
- Easing curves (smooth cubic interpolation)
- Joint limits validation
- Timestamp monotonicity
- Episode structure (~81 frames per demo)
- Data quality checks

#### E2E Tests (Playwright)

Browser-based tests that validate the full application:

```bash
# Quick smoke tests for development
npm run test:e2e:smoke

# Full comprehensive tests
npm run test:e2e:full
```

**Smoke Tests (3 tests, ~40 seconds):**
- App loads with canvas and controls
- Single demo pickup works
- Batch demos start (3 demos verified)

**Full Tests (3 tests, ~7 minutes):**
- Single demo spawns cube correctly
- Batch demo completes 10 demos with 81 frames each
- Camera capture (3 key images per demo) and position variety

**Sample Output:**
```
Demo 1 detected: shoulder=-50.0, elbow=30.0
...
Demo 10 detected: shoulder=-50.0, elbow=30.0
Recorded frames: 81, key images: 3
Episode 10 recorded: 81 frames, duration=3.46s
All demos complete. Total episodes: 10
3 passed (6.7m)
```

#### Running Tests in CI

For continuous integration, use the full test suite:

```bash
# CI recommended command
npm run test:unit && npm run test:e2e:full
```

#### Debugging Failed Tests

```bash
# Run with visible browser
npm run test:e2e:headed

# Use Playwright UI for step-by-step debugging
npm run test:e2e:ui

# Run specific test
npx playwright test demo-pickup.spec.ts --grep "Single"
```

## Technical Approach: Accurate Robot Models

This section documents the methodology used to create physically accurate robot simulations from real robot specifications.

### Step 1: Source Official Robot Data

For accurate simulations, start with official manufacturer data:

- **URDF files** - Unified Robot Description Format from the robot's official repository
- **STL meshes** - 3D geometry files linked in the URDF
- **Joint limits** - From URDF `<limit>` tags (converted from radians to degrees)
- **Gear ratios** - From manufacturer documentation (e.g., LeRobot docs for SO-101)

For SO-101, we use:
```
public/models/so101/
├── so101.urdf           # Official URDF from TheRobotStudio/SO-ARM100
└── meshes/
    ├── base_link.stl
    ├── shoulder_link.stl
    ├── upper_arm_link.stl
    ├── forearm_link.stl
    ├── wrist_link.stl
    ├── gripper_link.stl
    └── sts3215_*.stl    # Servo motor meshes
```

### Step 2: URDF Parsing with urdf-loader

Use the `urdf-loader` library to parse URDF and load STL meshes:

```typescript
import URDFLoader from 'urdf-loader';

const loader = new URDFLoader();
loader.packages = '/models/so101';  // Base path for mesh loading

// Custom STL loader with materials
loader.loadMeshCb = (path, manager, onComplete) => {
  const stlLoader = new STLLoader(manager);
  stlLoader.load(path, (geometry) => {
    const isServo = path.includes('sts3215');
    const material = isServo ? SERVO_MATERIAL : PRINTED_MATERIAL;
    const mesh = new THREE.Mesh(geometry, material);
    onComplete(mesh);
  });
};

loader.load('/models/so101/so101.urdf', (robot) => {
  // Robot is now a Three.js object with articulated joints
  robot.rotation.x = -Math.PI / 2;  // Z-up (URDF) to Y-up (Three.js)
});
```

### Step 3: Apply Realistic Materials

Differentiate between 3D-printed parts and servo motors:

```typescript
// 3D printed plastic (PLA/PETG)
const PRINTED_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#F5F0E6',  // Off-white filament
  metalness: 0.0,
  roughness: 0.4,
});

// STS3215 servo motors
const SERVO_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#1a1a1a',  // Black plastic housing
  metalness: 0.2,
  roughness: 0.3,
});
```

### Step 4: Joint Control via URDF

The urdf-loader provides `setJointValue()` for each joint:

```typescript
// Map UI names to URDF joint names
const JOINT_MAP = {
  base: 'shoulder_pan',
  shoulder: 'shoulder_lift',
  elbow: 'elbow_flex',
  wrist: 'wrist_flex',
  wristRoll: 'wrist_roll',
  gripper: 'gripper',
};

// Update joints (convert degrees to radians)
robot.joints[JOINT_MAP.shoulder].setJointValue((angle * Math.PI) / 180);
```

### Step 5: Self-Collision Prevention

Since URDF models are purely kinematic (no inter-link collision), we implement software constraints to prevent impossible poses:

```typescript
// src/lib/selfCollision.ts
export function preventSelfCollision(joints: JointState, robotId: string): JointState {
  if (robotId !== 'so-101') return joints;

  const corrected = { ...joints };

  // Shoulder+Elbow constraint: prevent arm folding through base
  // More shoulder tilt = less elbow can fold back
  if (corrected.shoulder > 40) {
    const minSum = -10;
    if (corrected.shoulder + corrected.elbow < minSum) {
      corrected.elbow = minSum - corrected.shoulder;
    }
  }

  return corrected;
}
```

This is applied in the Zustand store whenever joints are updated.

### Step 6: Physics Integration

Wrap the URDF model in Rapier physics:

```typescript
<RigidBody type="fixed" colliders={false}>
  <CuboidCollider args={[0.06, 0.04, 0.06]} position={[0, 0.04, 0]} />
  <primitive object={robot} />
</RigidBody>
```

The base is fixed, and the arm moves kinematically (driven by joint angles rather than physics forces).

### Benefits of This Approach

1. **Accuracy** - Real dimensions, joint limits, and gear ratios from manufacturer
2. **Visual fidelity** - Actual 3D geometry, not approximations
3. **Hardware compatibility** - Same joint names/limits as real hardware
4. **Maintainability** - Update by replacing URDF/STL files from upstream

## Architecture: Prompt-First Robot Control

RoboSim is designed with a **prompt-first** architecture where natural language is the primary interface for robot control, not an afterthought.

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│  USER PROMPT                                            │
│  "Pick up the block and move it to the left"            │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  SEMANTIC STATE (Natural Language Context)              │
│                                                         │
│  "Arm is rotated 45° left, gripper open.                │
│   End effector at (0.15m, 0.12m, 0.08m).                │
│   Last action: wave completed 10s ago."                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  LLM (Claude/GPT)                                       │
│  - Understands spatial relationships                    │
│  - Can reference current position ("from here")         │
│  - Generates trajectory or asks clarifying questions    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  ROBOT EXECUTION                                        │
│  - Smooth trajectory interpolation                      │
│  - Task tracking (start/complete/fail)                  │
│  - Event emission for feedback                          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  CHAT FEEDBACK                                          │
│  "🤖 Task completed: Picked up object"                  │
└─────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Robot Context | `src/lib/robotContext.ts` | Central state + event bus |
| Semantic State | `src/lib/semanticState.ts` | Converts state to natural language |
| Claude API | `src/lib/claudeApi.ts` | LLM integration with semantic context |
| Pickup Examples | `src/lib/pickupExamples.ts` | Training data from successful pickups |
| Chat Panel | `src/components/chat/ChatPanel.tsx` | Bidirectional UI |

### Example Conversation

```
User: "Wave hello"
Assistant: "Waving hello!"
🤖 Task completed: Waving hello!

User: "Now move a bit to the left"
Assistant: "I see you're currently at 45° base rotation.
            Moving left to 75°."
🤖 Task completed: Moving left

User: "What's the gripper doing?"
Assistant: "The gripper is currently fully open, positioned
            at medium height, reaching forward."
```

## Project Structure

```
src/
├── components/
│   ├── simulation/      # 3D robot components
│   │   ├── SO101Arm3D.tsx       # SO-101 arm with URDF
│   │   ├── SO101Kinematics.ts   # Forward/Inverse kinematics
│   │   ├── ClickToMove.tsx      # IK-based click targeting
│   │   ├── WheeledRobot3D.tsx
│   │   ├── Drone3D.tsx
│   │   ├── Humanoid3D.tsx
│   │   └── ...
│   ├── controls/        # UI control panels
│   │   ├── ConsolidatedToolsPanel.tsx # Tabbed tool categories (Control, AI, Data, Hardware, Settings)
│   │   ├── AdvancedControlsPanel.tsx  # IK, keyboard, gamepad modes
│   │   ├── TaskTemplatesPanel.tsx     # Pick & place sequences
│   │   ├── PolicyBrowserPanel.tsx     # HuggingFace policy loader
│   │   ├── DatasetBrowserPanel.tsx    # Browse LeRobot datasets
│   │   ├── DatasetStatsPanel.tsx      # Dataset quality analysis
│   │   ├── TutorialPanel.tsx          # Interactive tutorials
│   │   ├── AIEnvironmentPanel.tsx     # AI-generated environments and objects
│   │   ├── VoiceControlPanel.tsx      # Voice command interface
│   │   ├── VisionAnalysisPanel.tsx    # Scene understanding with AI
│   │   ├── TextTo3DPanel.tsx          # Text-to-3D object generation
│   │   ├── ImageTo3DPanel.tsx         # Image-to-3D with CSM API
│   │   ├── ObjectLibraryPanel.tsx     # Physics object library browser
│   │   ├── LLMRecordingPanel.tsx      # LLM → Physics recording
│   │   ├── JointTrajectoryGraph.tsx   # Real-time plotting
│   │   ├── SerialConnectionPanel.tsx  # Hardware connection
│   │   └── ...
│   ├── editor/          # Code editor components
│   ├── chat/            # AI chat interface
│   └── layout/          # Layout components
├── hooks/               # Custom React hooks
│   ├── useTrajectoryExecution.ts  # Smooth motion execution
│   ├── useRobotContext.ts         # Robot state + events hook
│   ├── useCodeCopilot.ts          # AI code completion for Monaco
│   └── ...
├── lib/                 # Robot APIs and utilities
│   ├── robotContext.ts        # Central state aggregator + event bus
│   ├── semanticState.ts       # Natural language state translation
│   ├── sensorNoise.ts         # Realistic sensor noise models
│   ├── visionSimulation.ts    # Camera capture and blob detection
│   ├── statePersistence.ts    # Save/load state with IndexedDB
│   ├── multiRobot.ts          # Multi-robot instance management
│   ├── numericalIK.ts         # Jacobian-based inverse kinematics solver
│   ├── aiImageGeneration.ts   # Gemini AI image generation for environments
│   ├── voiceControl.ts        # Web Speech API voice commands
│   ├── visionLanguage.ts      # Vision-language scene analysis
│   ├── codeCopilot.ts         # AI code completion and generation
│   ├── textTo3D.ts            # Text-to-3D model generation
│   ├── csmImageTo3D.ts        # CSM API for image-to-3D conversion
│   ├── objectTaskGenerator.ts # Auto-generate task templates for objects
│   ├── objectLibrary.ts       # Physics object definitions (YCB + primitives)
│   ├── physicsEpisodeGenerator.ts # LLM → Physics episode recording
│   ├── logger.ts              # Structured logging utility
│   ├── huggingfaceHub.ts      # HuggingFace Hub API integration
│   ├── policyRunner.ts        # ONNX Runtime policy execution
│   ├── safetensorsLoader.ts   # SafeTensors model format loader
│   ├── parquetWriter.ts       # Apache Parquet file writer
│   ├── taskDetection.ts       # Task success detection
│   ├── taskVerification.ts    # Before/after snapshot task verification
│   ├── cameraCapture.ts       # RGB frame capture from 3D viewport
│   ├── qualityGates.ts        # Episode quality validation for export
│   ├── huggingfaceUpload.ts   # HuggingFace Hub dataset upload
│   ├── pickupExamples.ts      # Training data from successful pickups
│   ├── trajectoryPlanner.ts   # Motion interpolation
│   ├── serialConnection.ts    # Web Serial API
│   └── ...
├── stores/              # Zustand state management
├── config/              # Robot profiles, environments, physics
│   ├── physics.ts       # Centralized physics constants + domain randomization
└── types/               # TypeScript type definitions
```

## Robot APIs

### SO-101 Robot Arm
```javascript
// Joint control (6-DOF)
robot.moveJoint('base', 45);      // Rotate base (shoulder_pan)
robot.moveJoint('shoulder', 30);  // Lift shoulder (shoulder_lift)
robot.moveJoint('elbow', -60);    // Bend elbow (elbow_flex)
robot.moveJoint('wrist', 20);     // Flex wrist (wrist_flex)
robot.moveJoint('wristRoll', 90); // Roll wrist (wrist_roll)

// Gripper control
robot.openGripper();              // Open gripper
robot.closeGripper();             // Close gripper
robot.setGripper(50);             // Set gripper to 50%

// Preset positions
robot.goHome();                   // Return to home position
```

### Keyboard Controls (SO-101)

Enable keyboard mode in the Advanced Controls panel:

| Key | Action |
|-----|--------|
| W/S | Shoulder up/down |
| A/D | Base rotate left/right |
| ↑/↓ | Elbow up/down |
| ←/→ | Wrist up/down |
| Q/E | Wrist roll left/right |
| Space | Open gripper |
| Shift | Close gripper |

### Gamepad Controls (SO-101)

| Control | Action |
|---------|--------|
| Left Stick X | Base rotation |
| Left Stick Y | Shoulder angle |
| Right Stick X | Wrist angle |
| Right Stick Y | Elbow angle |
| Left Bumper/Right Bumper | Wrist roll |
| Left Trigger | Close gripper |
| Right Trigger | Open gripper |

### Wheeled Robot (Coming Soon)
```javascript
robot.forward(150);               // Drive forward
robot.backward(100);              // Drive backward
robot.turnLeft(100);              // Turn left
robot.turnRight(100);             // Turn right
robot.stop();                     // Stop motors
```

### Drone (Coming Soon)
```javascript
drone.arm();                      // Arm motors
drone.takeoff(0.5);               // Take off to height (meters)
drone.land();                     // Land the drone
drone.setThrottle(60);            // Set throttle (0-100)
```

## Hardware Connection

### Web Serial (Real-time Mirror)

Connect directly to your SO-101 from the browser (Chrome/Edge required):

1. Click "Connect" in the Hardware Connection panel
2. Select your USB serial port (usually `/dev/ttyUSB0` or `COM3`)
3. Enable "Auto-sync" to mirror simulation to hardware in real-time

The default protocol sends servo PWM commands at configurable rates (1-60 Hz):
```
J0:1500,J1:1500,J2:1500,J3:1500,J4:1500,J5:1500
```

Configure your Arduino/ESP32 to parse this format and drive servos accordingly.

### Supported Baud Rates
- 9600, 19200, 38400, 57600, 115200 (default), 250000, 500000, 1000000

## Hardware Export

### LeRobot Python (SO-101)

Export your simulation code to run on real SO-101 hardware using the HuggingFace LeRobot framework:

```python
from lerobot.common.robot_devices.motors.feetech import FeetechMotorsBus

# Generated code includes SO101Controller class
robot = SO101Controller(port="/dev/ttyUSB0")
robot.move_joint("shoulder", 45)
robot.go_home()
robot.disconnect()
```

Setup for real hardware:
```bash
pip install lerobot
pip install -e ".[feetech]"  # For STS3215 servo support
lerobot-find-port             # Discover serial port
lerobot-calibrate             # Calibrate arm positions
```

## Deployment

### Hosted Version

The app is hosted on Render:
- **Frontend:** [robosim.onrender.com](https://robosim.onrender.com)
- **API:** [robosim-api.onrender.com](https://robosim-api.onrender.com)

### Self-Hosting

To deploy your own instance:

1. **Frontend (Static Site)**
   ```bash
   npm run build
   # Deploy the `dist/` folder to any static host
   ```

2. **API (Python)**
   ```bash
   cd api
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. **Environment Variables (API)**
   - `STRIPE_SECRET_KEY` - Stripe API key for payments
   - `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
   - `SUPABASE_URL` - Supabase project URL
   - `SUPABASE_SERVICE_KEY` - Supabase service role key

4. **Environment Variables (Frontend)**
   - `VITE_SUPABASE_URL` - Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Supabase anon/public key

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [The Robot Studio](https://www.therobotstudio.com/) - SO-101 robot arm design and URDF
- [HuggingFace LeRobot](https://github.com/huggingface/lerobot) - Robot learning framework
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [Rapier Physics](https://rapier.rs/)
- [Zustand](https://github.com/pmndrs/zustand)
- Berkeley Humanoid Lite design inspiration

## Development Roadmap

RoboSim aims to be the fastest path from zero to trained robot policy. The following features are planned to address key pain points in robotics education and data collection.

### Phase 1: Onboarding Improvements (Quick Wins)
- [x] **First-run tutorial modal** - Detect new users and prompt interactive onboarding
- [x] **Batch episode recording** - "Record N episodes" button for efficient data collection
- [x] **Trajectory noise augmentation** - Add configurable noise to recorded episodes for diversity

### Phase 2: Data Generation Tools (Medium Effort)
- [x] **Parameterized task templates** - Configurable waypoints with randomizable parameters
- [x] **Visual randomization UI** - Lighting, texture, and color variation controls
- [x] **Dataset augmentation panel** - Multiply episodes with automated variations

### Phase 3: Advanced Features (Major)
- [x] **Auto-episode generator** - One-click synthetic data generation (100+ episodes)
- [x] **Guided challenge system** - Interactive tutorials with position validation
- [x] **Direct HuggingFace upload** - Integrated Hub publishing without CLI

### Why These Features?

Based on research into robotics simulation pain points:

1. **Learning Curve**: Traditional tools like ROS/Gazebo require complex installation and version matching. RoboSim runs in any browser with zero setup.

2. **Data Collection Cost**: Imitation learning requires 50-200+ demonstration episodes, taking days of manual teleoperation. Automated generation can reduce this to minutes.

3. **Sim-to-Real Transfer**: Domain randomization (visual, sensor, trajectory) is essential for policies that work on real hardware.

See [ROADMAP.md](./ROADMAP.md) for detailed implementation plans.

## Resources

- [SO-101 Official Repository](https://github.com/TheRobotStudio/SO-ARM100)
- [LeRobot SO-101 Documentation](https://huggingface.co/docs/lerobot/so101)
- [SO-101 Assembly Tutorial](https://maegantucker.com/ECE4560/assignment6-so101/)
