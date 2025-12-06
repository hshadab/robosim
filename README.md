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

### Sensors & Visualization
- Ultrasonic distance sensor
- IR line sensors
- GPS, accelerometer, gyroscope simulation
- Lidar visualization (2D minimap and 3D rays)
- Robot camera view (picture-in-picture)

### Code Editor
- Built-in JavaScript code editor
- Robot API for programmatic control
- Code templates for common tasks
- Console output panel

### Hardware Export
- **LeRobot Python** - Export to HuggingFace LeRobot framework for SO-101
- **Arduino** - Export to Arduino C++ for various hardware kits
- **MicroPython** - Export to MicroPython for ESP32/Raspberry Pi Pico

### AI Chat Assistant
- Natural language robot control
- Context-aware responses per robot type
- Quick prompts for common commands

## Tech Stack

- **Frontend**: React 18, TypeScript
- **3D Graphics**: Three.js, React Three Fiber, React Three Drei
- **Physics**: Rapier (via @react-three/rapier)
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

## Project Structure

```
src/
├── components/
│   ├── simulation/      # 3D robot components
│   │   ├── PhysicsArm.tsx
│   │   ├── WheeledRobot3D.tsx
│   │   ├── Drone3D.tsx
│   │   ├── Humanoid3D.tsx
│   │   └── ...
│   ├── controls/        # UI control panels
│   ├── editor/          # Code editor components
│   ├── chat/            # AI chat interface
│   └── layout/          # Layout components
├── hooks/               # Custom React hooks
├── lib/                 # Robot APIs and utilities
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
