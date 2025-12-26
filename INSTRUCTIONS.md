# RoboSim User Guide

Complete instructions for using all controls and features in RoboSim.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Training Workflow (End-to-End)](#training-workflow-end-to-end)
3. [Robot Types](#robot-types)
4. [Control Panels](#control-panels)
5. [AI Features](#ai-features)
6. [Code Editor](#code-editor)
7. [3D Simulation](#3d-simulation)
8. [Data & Export](#data--export)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Launch

1. Open RoboSim in your browser (Chrome or Edge recommended)
2. Click **GET STARTED** on the landing page
3. The simulator loads with the SO-101 Robot Arm by default

### Interface Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Logo    Features    How It Works    Learn More    GET STARTED  │
├─────────────────────────────────────────────────────────────────┤
│                                              │                  │
│                                              │  Control Panels  │
│           3D Simulation Viewport             │  (collapsible)   │
│                                              │                  │
│                                              │                  │
├──────────────────────────────────────────────┴──────────────────┤
│  Code Editor                │           Chat Panel              │
│  (JavaScript)               │         (AI Assistant)            │
└─────────────────────────────┴───────────────────────────────────┘
```

### Quick Start Actions

1. **Move the robot**: Use joint sliders in the Controls panel
2. **Talk to AI**: Type commands in the Chat panel (e.g., "wave hello")
3. **Run code**: Write JavaScript in the Code Editor and click Run
4. **Change robots**: Use the Robot Selector dropdown

---

## Training Workflow (End-to-End)

RoboSim provides a complete pipeline from demonstration to trained robot policy.

### Overview

```
SNAP IT → TEACH IT → TRAIN IT → DEPLOY IT
   │          │          │          │
   ▼          ▼          ▼          ▼
Add object  Record    Train on   Run on
from photo  demos     Colab      real robot
or library  via chat  (free GPU)
```

### Step 1: Add an Object

1. Click **"Use LeRobot Objects"** in the left panel
2. Select a cube (recommended: "LeRobot Cube 2.5cm")
3. Object appears in the scene in the optimal pickup zone

**Alternative:** Upload a photo of your own object to generate a 3D model.

### Step 2: Record Demonstrations

1. Type **"pick up the cube"** in the chat panel
2. Watch the robot pick up the cube
3. Repeat **10 times** with slight variations
4. The app automatically records each successful pickup

**Tips for good demos:**
- Let the robot finish each pickup before starting the next
- Occasional failures are okay (they're filtered out)
- Vary your phrasing: "grab the cube", "pick up the red block"

### Step 3: Generate Episodes

1. Click **"Generate Variations"** button
2. App creates 50-100 episodes from your ~10 demos
3. Wait a few seconds for generation

### Step 4: Upload to HuggingFace

1. Click **"Upload to HuggingFace"**
2. Enter your HuggingFace token (get one at huggingface.co/settings/tokens)
3. Dataset uploads automatically
4. Note your dataset ID (e.g., `username/cube-pickup-training-123456`)

### Step 5: Train on Google Colab

1. Click **"Train on Google Colab"** button
2. Colab notebook opens in new tab
3. Enter your dataset ID in the notebook
4. Click **Runtime → Run all**
5. Wait ~2 hours for training to complete
6. Trained model saves to HuggingFace

### Step 6: Deploy to Real SO-101

On your computer with the SO-101 connected:

```bash
# Install LeRobot
pip install lerobot

# Run your trained policy
python -m lerobot.scripts.control_robot record \
  --robot-path lerobot/configs/robot/so100.yaml \
  --policy.path=YOUR_USERNAME/YOUR_MODEL_REPO \
  --fps 30
```

### Training Requirements

| Requirement | Details |
|-------------|---------|
| Human demos | ~10 successful pickups |
| Total episodes | 50-100 (auto-generated) |
| Training time | ~2 hours |
| GPU needed locally | No (Colab provides free T4) |
| Cost | Free |

### Troubleshooting Training

**Pickup failing?**
- Objects should spawn nearly straight ahead (small angle from robot)
- Clear and add a new object if position looks wrong
- Demo Pick Up button always works as reference

**Upload failing?**
- Check your HuggingFace token is valid
- Token needs "write" permission

**Training not starting?**
- Make sure GPU is enabled: Runtime → Change runtime type → GPU
- Check dataset ID is correct in notebook

---

## Robot Types

### SO-101 Robot Arm (6-DOF) - Available

A desktop robotic arm from The Robot Studio with 6 degrees of freedom.

| Joint | Range | Description |
|-------|-------|-------------|
| Base | ±110° | Rotates the entire arm left/right |
| Shoulder | ±100° | Lifts the upper arm up/down |
| Elbow | ±97° | Bends the forearm |
| Wrist Pitch | ±95° | Tilts the wrist up/down |
| Wrist Roll | -157° to +163° | Rotates the wrist |
| Gripper | 0-100% | Opens/closes the gripper |

**Quick Actions:**
- Home Position - Return to rest state
- Open/Close Gripper - Toggle gripper state

---

### 4WD Wheeled Robot - Coming Soon

A four-wheel drive mobile robot with differential steering.

| Control | Range | Description |
|---------|-------|-------------|
| Left Motor | -255 to +255 | Left wheel speed |
| Right Motor | -255 to +255 | Right wheel speed |
| Head Servo | ±90° | Camera pan angle |

**Quick Actions:** Forward, Backward, Stop, Turn Left, Turn Right

---

### Quadcopter Drone - Coming Soon

A four-rotor aerial vehicle with 6-DOF movement.

| Control | Range | Description |
|---------|-------|-------------|
| Throttle | 0-100% | Altitude control |
| Roll | ±45° | Left/right tilt |
| Pitch | ±45° | Forward/backward tilt |
| Yaw | ±180° | Rotation |

**Flight Modes:** Stabilize, Altitude Hold, Position Hold

**Quick Actions:** Arm, Disarm, Takeoff, Land

---

### Berkeley Humanoid (22-DOF) - Coming Soon

A bipedal humanoid robot with articulated limbs.

| Body Part | Joints | Range |
|-----------|--------|-------|
| Hip | Pitch, Roll | ±60°, ±30° |
| Knee | Bend | 0° to 120° |
| Shoulder | Pitch | -180° to +60° |
| Elbow | Bend | 0° to 135° |
| Wrist | Rotation | ±90° |

**Quick Actions:** Walk, Wave, Squat, Reset Pose

---

## Control Panels

All control panels are collapsible. Click the header to expand/collapse.

### Joint Controls

**Location:** Right sidebar → Controls

Provides direct slider control for each robot joint.

- **Sliders**: Drag to set joint angle/position
- **Value Display**: Shows current angle in degrees or percentage
- **Disabled State**: Sliders lock during animations

**Usage:**
1. Expand the Controls panel
2. Drag any slider to move that joint
3. The robot moves in real-time

---

### Advanced Controls

**Location:** Right sidebar → Advanced Controls

Four control modes for different interaction styles:

#### Manual Mode
Traditional slider control (same as Joint Controls)

#### Click-to-Move Mode
Click anywhere in the 3D viewport and the robot uses Inverse Kinematics to reach that point.

1. Select "Click-to-Move" mode
2. Click a point in the 3D scene
3. Robot calculates and executes the path

#### Keyboard Mode
Control the robot with keyboard keys.

| Key | Action |
|-----|--------|
| W / S | Shoulder up/down |
| A / D | Base left/right |
| ↑ / ↓ | Elbow up/down |
| ← / → | Wrist pitch |
| Q / E | Wrist roll |
| Space | Open gripper |
| Shift | Close gripper |

#### Gamepad Mode
Use a connected game controller.

| Input | Action |
|-------|--------|
| Left Stick | Base / Shoulder |
| Right Stick | Elbow / Wrist |
| Bumpers (L1/R1) | Wrist Roll |
| Triggers | Gripper open/close |

**Deadzone:** 0.15 (adjustable)

---

### Hand Tracking

**Location:** Right sidebar → Hand Tracking

Control the robot arm using hand gestures via your webcam.

**Requirements:** Camera access, works with arm robots only

**Gestures:**
| Gesture | Action |
|---------|--------|
| Pinch (thumb + index) | Close gripper |
| Open hand | Open gripper |
| Point | Move in pointing direction |
| Fist | Hold current grip |

**Usage:**
1. Click "Start Tracking"
2. Allow camera access
3. Position your hand in the camera view
4. Move your hand to control the robot

---

### Numerical IK (Inverse Kinematics)

**Location:** Right sidebar → Numerical IK

Calculate joint angles to reach a target position.

**Solver Methods:**
- **DLS (Damped Least Squares)**: Stable, handles singularities
- **CCD (Cyclic Coordinate Descent)**: Fast, iterative

**Parameters:**
| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Max Iterations | 10-500 | 100 | Solver attempts |
| Damping Factor | 0.01-1.0 | 0.01 | DLS stability |
| Step Size | 0.1-1.0 | 0.5 | CCD step amount |
| Tolerance | 0.5-10mm | 5mm | Position accuracy |

**Usage:**
1. Enter target X, Y, Z coordinates (in meters)
2. Or click "Use Current" to capture gripper position
3. Click "Solve IK" for single solution
4. Click "Multi-Start" for best of 5 attempts
5. Click "Animate" to smoothly move to target

**Diagnostics:**
- Manipulability score
- Singularity warnings
- Convergence status

---

### Multi-Robot

**Location:** Right sidebar → Multi-Robot

Manage multiple robot instances (max 8).

**Actions:**
| Button | Action |
|--------|--------|
| + | Add new robot |
| Clone | Duplicate selected robot |
| Eye icon | Toggle visibility |
| Trash | Remove robot |

**Formation Patterns:**
- Line - Robots in a row
- Grid - 2D array layout
- Circle - Circular arrangement
- V-Formation - Flying V pattern

**Usage:**
1. Click + to add a robot
2. Click on a robot in the list to select it
3. Selected robot receives all control inputs
4. Use formations for swarm behaviors

---

### Voice Control

**Location:** Right sidebar → Voice Control

Control the robot using voice commands.

**Requirements:** Chrome or Edge browser, microphone access

**Status Indicators:**
| Color | State |
|-------|-------|
| Gray | Inactive |
| Green (pulsing) | Listening |
| Yellow | Processing |
| Blue | Speaking response |
| Red | Error |

**Configuration:**
- **Wake Word**: Optional "Hey Robot" activation
- **Voice Feedback**: Robot speaks responses

**Supported Commands:**

| Category | Examples |
|----------|----------|
| Movement | "move left", "move right", "forward", "backward" |
| Gripper | "open gripper", "close gripper", "grab", "release" |
| Pick-up | "pick up the cube", "grab the red block", "pick up the ball" |
| Stacking | "stack on the blue block", "place on the red cube" |
| Move to | "move to the green ball", "go to the cylinder" |
| Placing | "place", "put down", "drop" |
| Actions | "wave hello", "scan the area", "dance" |
| Positions | "go home", "reach forward", "move up" |

**Usage:**
1. Click the microphone button to start
2. Say your command clearly
3. Wait for the robot to respond
4. Click again to stop listening

---

### Vision (Camera)

**Location:** Right sidebar → Vision

Basic computer vision with color detection.

**Settings:**
| Option | Range | Description |
|--------|-------|-------------|
| Resolution | 320×240 | Fixed camera resolution |
| Frame Rate | 1-30 FPS | Capture frequency |

**Color Detection:**
Detects and tracks colored objects:
- Red, Green, Blue
- Yellow, Orange
- Custom colors

**Output:**
- Centroid position (X, Y)
- Bounding box
- Area in pixels²
- Detection confidence

**Usage:**
1. Toggle camera on
2. Select color to detect
3. View detected blob overlay
4. Use centroid for object tracking

---

### Vision Analysis (AI)

**Location:** Right sidebar → Vision Analysis

Advanced scene understanding using Claude Vision API.

**Requirements:** Claude API key configured

**Quick Questions:**
- "What's in the scene?"
- "What can the robot pick up?"
- "Describe the environment"
- "Where are the objects?"

**Output:**
- Natural language scene description
- List of detected objects with confidence
- Spatial relationships
- Suggested robot actions

**Usage:**
1. Ensure API key is set in Chat panel
2. Click a quick question or type your own
3. AI analyzes the current viewport
4. Review response and suggested actions

---

### AI Environment Generator

**Location:** Right sidebar → AI Environment

Generate backgrounds, textures, and objects using AI.

**Requirements:** Google Gemini API key

#### Background Tab
Create custom scene backgrounds.

**Options:**
| Setting | Choices |
|---------|---------|
| Style | Realistic, Cartoon, Abstract, Minimalist |
| Mood | Bright, Dark, Warm, Cool |

**Presets:** Laboratory, Warehouse, Space Station, Nature, Underwater, Factory

**Usage:**
1. Enter description or select preset
2. Choose style and mood
3. Click "Generate"
4. Preview and apply to scene

#### Texture Tab
Generate floor and wall textures.

**Surface Types:** Floor, Wall

**Usage:**
1. Select surface type
2. Describe material (e.g., "worn concrete", "oak wood planks")
3. Generate seamless texture
4. Apply to scene surfaces

#### Object Tab
Create 3D objects from descriptions.

**Shapes:** Cube/Box, Sphere/Ball, Cylinder

**Presets:** Apple, Orange, Banana, Can, Box, Ball

**Usage:**
1. Describe the object
2. Select base shape
3. Choose style (Realistic/Cartoon)
4. Generate and spawn in scene

---

### Text-to-3D

**Location:** Right sidebar → Text-to-3D

Generate 3D objects from text descriptions.

**Options:**
| Setting | Choices |
|---------|---------|
| Style | Realistic, Cartoon, Low-Poly, Voxel |
| Scale | 0.5x to 3.0x |
| AI Texture | On/Off |

**Presets:**
- Red Apple
- Blue Cube
- Yellow Ball
- Metal Can
- Wooden Box
- Orange Cone

**Usage:**
1. Type object description
2. Select style and scale
3. Toggle AI textures if desired
4. Click "Generate"
5. Object appears in scene

**Management:**
- View generated objects list
- Mark objects as grabbable
- Remove individual objects
- Clear all generated objects

---

### Dataset Recorder

**Location:** Right sidebar → Dataset Recorder

Record robot demonstrations for machine learning.

**Format Options:**
- **LeRobot v3.0**: HuggingFace compatible format
- **JSON**: Simple JSON export

**Recording Settings:**
| Setting | Value |
|---------|-------|
| Frame Rate | 30 FPS |
| Video | Optional |

**Data Captured:**
- Joint states (position, velocity)
- Robot type and ID
- Task name/description
- Video frames (if enabled)
- Episode metadata

**Usage:**
1. Set task name/description
2. Choose recording format
3. Click "Record" to start
4. Perform the demonstration
5. Click "Stop" when done
6. Mark as Success or Fail
7. Export dataset

**Export:**
- Compatible with LeRobot fine-tuning
- Upload instructions for HuggingFace Hub

---

### Save/Load

**Location:** Right sidebar → Save Load

Manage simulation states.

**Storage:** Up to 10 named save slots + auto-save

**Saved Data:**
- Robot type and ID
- All joint positions
- Environment state
- Physics objects
- Code editor content

**Actions:**
| Button | Action |
|--------|--------|
| New Save | Create named save slot |
| Load Auto-Save | Restore last auto-save |
| Load | Restore selected slot |
| Overwrite | Update existing slot |
| Export | Download as JSON file |
| Import | Load from JSON file |
| Delete | Remove save slot |

**Usage:**
1. Configure simulation as desired
2. Click "New Save"
3. Enter a descriptive name
4. Save is stored in browser

---

### Policy Browser (LeRobot)

**Location:** Right sidebar → LeRobot Policies

Load and run pre-trained robot policies.

**Source:** HuggingFace Hub

**Supported Policy Types:**
- ACT (Action Chunking Transformer)
- Diffusion
- TDMPC
- VQBET

**Features:**
- Search by robot type or task
- Filter by policy architecture
- ONNX model validation
- Download progress tracking
- 20Hz real-time inference

**Usage:**
1. Search for policies (e.g., "so101 pick")
2. Select compatible policy
3. Click "Download"
4. Click "Run" to start inference
5. Robot executes learned behavior
6. Click "Stop" to end

---

### Sensor Realism

**Location:** Right sidebar → Sensor Realism

Configure realistic sensor simulation.

**Available Sensors:**
| Sensor | Output | Range |
|--------|--------|-------|
| Ultrasonic | Distance (cm) | 2-400 cm |
| IR Left | 0/1 (line detected) | - |
| IR Center | 0/1 (line detected) | - |
| IR Right | 0/1 (line detected) | - |
| Battery | Percentage | 0-100% |

**Noise Models:**
- Gaussian noise (standard deviation)
- Spike noise (random outliers)

**Usage:**
1. Enable desired sensors
2. Configure noise levels
3. Sensor values appear in readings
4. Use in code via `sensors.ultrasonic`, etc.

---

### Hardware Connection

**Location:** Right sidebar → Serial Connection

Connect to physical robot hardware.

**Requirements:** Web Serial API (Chrome/Edge)

**Settings:**
- Port selection
- Baud rate
- Data format

**Usage:**
1. Connect hardware via USB
2. Click "Connect"
3. Select serial port
4. Commands sent to physical robot

---

## AI Features

### Chat Panel (Claude AI)

**Location:** Bottom right panel

Natural language interface for robot control.

**Setup:**
1. Click settings icon in Chat panel
2. Enter Claude API key (sk-ant-...)
3. Key is saved locally

**Quick Prompts by Robot:**

| Robot | Example Commands |
|-------|------------------|
| Arm | "wave hello", "pick up the cube", "stack on the blue block", "move to the red ball", "place", "go home" |
| Wheeled | "drive forward", "turn around", "follow line", "stop" |
| Drone | "take off", "hover", "fly forward", "land" |
| Humanoid | "walk forward", "wave", "squat", "raise arms" |

**Capabilities:**
- Natural language robot control
- Scene questions ("what do you see?")
- Code generation assistance
- Task planning and sequencing
- Real-time status updates

**Usage:**
1. Type command in input field
2. Press Enter or click Send
3. AI processes and executes command
4. Robot moves accordingly
5. Response appears in chat

---

### Pickup Training (LLM Learning)

The chat pickup system automatically learns from every attempt to improve over time.

**How It Works:**

1. **Automatic Logging** - Every pickup command is logged with:
   - Object position and type
   - Joint sequence used
   - IK solver errors
   - Success/failure outcome

2. **Success Detection** - After the 4-step pickup sequence:
   - System checks if gripper is holding an object
   - Logs SUCCESS or FAILURE automatically
   - Failed attempts include reason (e.g., "No object grabbed")

3. **Few-Shot Learning** - The system prompt includes:
   - Verified working pickup examples from Demo Pick Up
   - Similar successful pickups for current scene objects
   - Critical rules (wristRoll, timing, physics)

**Training Data Access:**

Open browser console to view pickup stats:
```javascript
import { getPickupStats } from './lib/pickupExamples';
console.log(getPickupStats());
// { total: 10, successful: 8, failed: 2, successRate: 0.8, byObjectType: {...} }
```

**Verified Working Examples:**

| Object Position | Type | Joint Configuration |
|----------------|------|---------------------|
| [16, 2, 1]cm | Cube | base=5°, shoulder=-22°, elbow=51°, wrist=63° |
| [12, 2, 15]cm | Cube | base=51°, shoulder=-50°, elbow=80°, wrist=10° |

**Critical Rules:**
- Use `wristRoll=90°` for cubes/balls (vertical fingers)
- Use `wristRoll=0°` for cylinders (horizontal fingers)
- Gripper close needs 800ms for physics detection
- Use `_gripperOnly: true` flag for gripper-only steps

---

### Code Copilot

**Location:** Integrated in Code Editor

AI-powered code assistance.

**Features:**
- Context-aware suggestions
- Robot API completions
- Bug detection
- Code explanations

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+G | Generate code from comment |
| Ctrl+Shift+E | Explain selected code |

**Usage:**
1. Write a comment describing desired code
2. Press Ctrl+Shift+G
3. AI generates code below comment
4. Or select code and press Ctrl+Shift+E for explanation

---

## Code Editor

**Location:** Bottom left panel

Write and run JavaScript code to control robots.

### Editor Features

- Monaco editor (VS Code engine)
- Syntax highlighting
- Line numbers
- Auto-completion
- Error detection

### Robot API

```javascript
// Movement
robot.moveTo({ base: 45, shoulder: 30, elbow: -60 });
robot.setJoint('base', 90);
robot.home();

// Gripper
robot.openGripper();
robot.closeGripper();
robot.setGripper(50); // 0-100%

// Queries
const pos = robot.getPosition();
const joints = robot.getJoints();

// Timing
await robot.wait(1000); // milliseconds
await robot.moveSmooth({ base: 45 }, 2000); // with duration

// Sensors
const distance = sensors.ultrasonic;
const lineLeft = sensors.irLeft;

// Logging
console.log('Status:', robot.status);
```

### Code Templates

**Basic:**
- Hello World - Simple movements
- Joint Explorer - Test each joint
- Sensor Reader - Display sensor values

**Intermediate:**
- Pick and Place - Object manipulation
- Scanning Pattern - Survey area
- Wave Hello - Greeting gesture

**Advanced:**
- Obstacle Avoidance - Safe navigation
- Sorting Demo - Object sorting
- Drawing Pattern - Trace shapes

### Running Code

1. Write code in editor
2. Click green **Run** button
3. Watch console for output
4. Click red **Stop** to halt

### Export Code

Export to hardware platforms:

| Platform | Output |
|----------|--------|
| Arduino | .ino (C++) |
| MicroPython | .py |
| CircuitPython | .py |
| Raspberry Pi | .py |

**Export Options:**
- Include comments
- Auto pin mapping
- Setup instructions

---

## 3D Simulation

### Viewport Controls

| Action | Control |
|--------|---------|
| Rotate view | Left-click + drag |
| Pan view | Right-click + drag |
| Zoom | Scroll wheel |
| Reset view | Double-click |

### Physics Objects

Objects in the scene have physics properties:
- Mass and weight
- Collision bounds
- Grabbable flag
- Material properties

**Spawning Objects:**
- Use Text-to-3D panel
- Use AI Environment → Object tab
- Generate via code

### Environment

**Components:**
- Ground plane
- Walls/boundaries
- Lighting and shadows
- Background (customizable)
- Textures (customizable)

### Workspace Visualization

Toggle to show:
- Reachable workspace bounds
- Joint limits
- Collision zones

---

## Data & Export

### Export Formats

| Type | Format | Use Case |
|------|--------|----------|
| Save State | JSON | Resume later |
| Code | .ino/.py | Run on hardware |
| Dataset | LeRobot v3.0 | ML training |
| Video | MP4 (30 FPS) | Documentation |
| Image | PNG | Screenshots |

### Sharing

- Generate shareable URL
- QR code for mobile
- Export state file

---

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| Enter | Send chat message |
| Escape | Cancel current action |

### Code Editor

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save code |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+/ | Toggle comment |
| Ctrl+Shift+G | Generate from comment |
| Ctrl+Shift+E | Explain selection |

### Keyboard Control Mode

| Key | Action |
|-----|--------|
| W | Shoulder up |
| S | Shoulder down |
| A | Base left |
| D | Base right |
| ↑ | Elbow up |
| ↓ | Elbow down |
| ← | Wrist pitch left |
| → | Wrist pitch right |
| Q | Wrist roll left |
| E | Wrist roll right |
| Space | Open gripper |
| Shift | Close gripper |

---

## Troubleshooting

### Voice Control Not Working

- **Check browser**: Use Chrome or Edge
- **Allow microphone**: Grant permission when prompted
- **Speak clearly**: Avoid background noise
- **Check status**: Ensure indicator shows "Listening"

### Hand Tracking Issues

- **Camera access**: Allow camera permission
- **Lighting**: Ensure good lighting on hands
- **Background**: Use plain background
- **Distance**: Keep hands 30-60cm from camera

### Robot Not Moving

- **Check animation**: Wait for current animation to complete
- **Joint limits**: Values may be at limits
- **Collision**: Check for self-collision warnings
- **Code errors**: Check console for errors

### AI Features Not Working

- **API key**: Ensure valid key is entered
- **Key format**: Claude keys start with `sk-ant-`
- **Quota**: Check API usage limits
- **Network**: Ensure internet connection

### Code Execution Errors

- **Syntax**: Check for typos
- **API calls**: Use correct method names
- **Async/await**: Add `await` for async operations
- **Console**: Check error messages

### Physics Issues

- **Object stuck**: Try resetting simulation
- **Clipping**: Reduce object count
- **Performance**: Lower physics quality settings

### Save/Load Issues

- **Storage full**: Delete old saves
- **Browser data**: Don't clear site data
- **Export**: Use file export for backup

---

## Limits & Constraints

| Resource | Limit |
|----------|-------|
| Robot instances | 8 max |
| Save slots | 10 max |
| Physics objects | 30 max |
| Camera resolution | 320×240 |
| Policy inference | 20Hz |
| Dataset recording | 30 FPS |

---

## Browser Support

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| 3D Rendering | ✓ | ✓ | ✓ | ✓ |
| Voice Control | ✓ | ✓ | ✗ | ✗ |
| Hand Tracking | ✓ | ✓ | ✓ | ✓ |
| Serial Connection | ✓ | ✓ | ✗ | ✗ |
| Gamepad | ✓ | ✓ | ✓ | ✓ |

**Recommended:** Chrome or Edge for full feature support

---

## Getting Help

- **Documentation**: Click "Learn More" on landing page
- **Issues**: Report bugs at GitHub repository
- **Community**: Join discussions on GitHub

---

*Last updated: December 2024*
