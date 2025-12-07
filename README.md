# RoboSim - Interactive Robotics Simulation Platform

A web-based 3D robotics simulation platform built with React, Three.js, and Rapier physics. Control and visualize multiple robot types including robotic arms, wheeled robots, drones, and humanoids.

## Features

### Multiple Robot Types
- **SO-101 Robot Arm** - 6-DOF open-source desktop arm from The Robot Studio
  - Realistic 3D model loaded from official URDF
  - STS3215 servo motors with 1/345 gear ratio
  - LeRobot (HuggingFace) Python export for real hardware
- **Wheeled Robot (Elegoo Smart Car v4)** - 4WD differential drive with ultrasonic & IR sensors
- **Drone (Mini Quadcopter)** - 4-motor drone with flight controls
- **Humanoid (Berkeley Humanoid Lite)** - 22-DOF bipedal robot

### 3D Visualization
- Real-time 3D rendering with PBR materials
- Physics simulation using Rapier
- Multiple environment options (empty, warehouse, outdoor, maze)
- Contact shadows and studio lighting

### Interactive Controls
- Joint sliders for precise control
- Preset positions and animations
- Motor speed controls for wheeled robots
- Flight controls for drones (arm/disarm, throttle, pitch, roll, yaw)

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
- **Sensor Panel** - Distance, IR, battery, motor status display

### Hardware Integration
- **Web Serial Connection** - Connect to real robot via USB (Chrome/Edge)
- **Auto-sync Mode** - Mirror simulation to hardware in real-time (30-60 Hz)
- **PWM Command Generation** - Automatic servo microsecond conversion

### Sensors & Visualization
- Ultrasonic distance sensor
- IR line sensors
- GPS, accelerometer, gyroscope simulation
- Lidar visualization (2D minimap and 3D rays)
- Robot camera view (picture-in-picture)

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
- **Per-Sensor Profiles** - Realistic defaults for ultrasonic, IR, IMU, accelerometer, gyroscope, encoder, temperature, battery, GPS, touch, and lidar
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
- **Up to 8 Robots** - Run multiple robot instances simultaneously
- **Mixed Types** - Combine arms, wheeled robots, drones, and humanoids
- **Formation Patterns** - Line, grid, circle, and V-formation layouts
- **Per-Robot State** - Each instance maintains independent joint/motor states
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
- **Semantic State Awareness** - LLM sees robot state in natural language, not just raw numbers
- **Bidirectional Communication** - Robot events appear in chat (task completed, errors, etc.)
- **Context-Aware Responses** - LLM understands current pose, can do relative movements ("move a bit left")
- **Live Status Bar** - Real-time robot state display in chat panel
- **Clarifying Questions** - LLM can ask for more details when needed

### Policy Loading from HuggingFace Hub
- **Browse LeRobot Policies** - Search and discover trained policies from HuggingFace Hub
- **ONNX Runtime** - Run policies locally in browser using ONNX Runtime Web
- **Policy Types Supported** - ACT (Action Chunking Transformer), Diffusion, TD-MPC, VQ-BeT
- **SO-101 Compatible** - Filter and load policies trained for SO-101/Koch robot arms
- **Real-time Inference** - Execute policies at 20Hz for smooth robot control
- **No Server Required** - All inference runs client-side in WebAssembly

## Tech Stack

- **Frontend**: React 18, TypeScript
- **3D Graphics**: Three.js, React Three Fiber, React Three Drei
- **Physics**: Rapier (via @react-three/rapier)
- **ML Inference**: ONNX Runtime Web, HuggingFace Transformers.js
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/robotics-simulation.git
cd robotics-simulation

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
│   │   ├── AdvancedControlsPanel.tsx  # IK, keyboard, gamepad modes
│   │   ├── TaskTemplatesPanel.tsx     # Pick & place sequences
│   │   ├── PolicyBrowserPanel.tsx     # HuggingFace policy loader
│   │   ├── AIEnvironmentPanel.tsx     # AI-generated environments and objects
│   │   ├── VoiceControlPanel.tsx      # Voice command interface
│   │   ├── VisionAnalysisPanel.tsx    # Scene understanding with AI
│   │   ├── TextTo3DPanel.tsx          # Text-to-3D object generation
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
│   ├── logger.ts              # Structured logging utility
│   ├── huggingfaceHub.ts      # HuggingFace Hub API integration
│   ├── policyRunner.ts        # ONNX Runtime policy execution
│   ├── trajectoryPlanner.ts   # Motion interpolation
│   ├── serialConnection.ts    # Web Serial API
│   └── ...
├── stores/              # Zustand state management
├── config/              # Robot profiles, environments
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

### Wheeled Robot
```javascript
robot.forward(150);               // Drive forward
robot.backward(100);              // Drive backward
robot.turnLeft(100);              // Turn left
robot.turnRight(100);             // Turn right
robot.stop();                     // Stop motors
robot.setServo(45);               // Set ultrasonic servo angle
```

### Drone
```javascript
drone.arm();                      // Arm motors
drone.disarm();                   // Disarm motors
drone.takeoff(0.5);               // Take off to height (meters)
drone.land();                     // Land the drone
drone.setThrottle(60);            // Set throttle (0-100)
drone.setAttitude(roll, pitch, yaw); // Set orientation
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

## Resources

- [SO-101 Official Repository](https://github.com/TheRobotStudio/SO-ARM100)
- [LeRobot SO-101 Documentation](https://huggingface.co/docs/lerobot/so101)
- [SO-101 Assembly Tutorial](https://maegantucker.com/ECE4560/assignment6-so101/)
