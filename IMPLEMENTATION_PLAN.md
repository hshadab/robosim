# RoboSim Feature Implementation Plan

## Overview

This plan covers 11 new features organized into 4 phases based on dependencies and complexity.

---

## Phase 1: Core Runtime & API (Foundation)

These features unlock the ability to run user code and provide the foundation for everything else.

### 1.1 Built-in Robotics API Library
**Priority: HIGH | Complexity: Medium | Est. Files: 4-5**

Create a proper JavaScript API that users can call from the code editor.

```typescript
// New file: src/lib/robotAPI.ts
const robot = {
  // Movement
  moveJoint(joint: string, angle: number, speed?: number): Promise<void>
  moveTo(x: number, y: number, z: number): Promise<void>
  goHome(): Promise<void>

  // Gripper
  openGripper(): Promise<void>
  closeGripper(): Promise<void>
  setGripper(percent: number): Promise<void>

  // Sensors
  readUltrasonic(): number
  readIR(sensor: 'left' | 'center' | 'right'): boolean
  readGyro(): { x: number, y: number, z: number }
  readAccelerometer(): { x: number, y: number, z: number }

  // Utilities
  wait(ms: number): Promise<void>
  print(message: string): void
  getJointPosition(joint: string): number
}
```

**Implementation:**
- Create `src/lib/robotAPI.ts` - API implementation connected to store
- Create `src/lib/codeRunner.ts` - Safe code execution with API injection
- Update `CodeEditor.tsx` - Add "Run" button
- Update store - Add console output state

### 1.2 Console Output Panel
**Priority: HIGH | Complexity: Low | Est. Files: 2**

Capture `robot.print()` and `console.log()` output from user code.

```typescript
// New state in store
consoleOutput: Array<{
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}>
```

**Implementation:**
- Create `src/components/editor/ConsolePanel.tsx` - Output display with clear button
- Add to `CodeEditor.tsx` or create tabbed interface (Code | Console)
- Wire `robot.print()` to append messages to store

### 1.3 Controller Templates
**Priority: Medium | Complexity: Low | Est. Files: 2**

Pre-built code snippets for common tasks.

```typescript
// New file: src/config/codeTemplates.ts
export const CODE_TEMPLATES = {
  'pick-and-place': { name: 'Pick & Place', code: '...' },
  'line-following': { name: 'Line Following', code: '...' },
  'obstacle-avoidance': { name: 'Obstacle Avoidance', code: '...' },
  'sorting': { name: 'Color Sorting', code: '...' },
  'drawing': { name: 'Drawing Pattern', code: '...' },
}
```

**Implementation:**
- Create `src/config/codeTemplates.ts` - Template definitions
- Add template selector dropdown in `CodeEditor.tsx`

---

## Phase 2: Extended Sensors & Visualization

### 2.1 More Sensor Types
**Priority: Medium | Complexity: Medium | Est. Files: 3-4**

Add GPS, accelerometer, gyroscope, touch sensors.

```typescript
// Extended SensorReading type
interface SensorReading {
  // Existing
  ultrasonic?: number;
  leftIR?: boolean;
  centerIR?: boolean;
  rightIR?: boolean;

  // New sensors
  gps?: { x: number; y: number; z: number };
  accelerometer?: { x: number; y: number; z: number };
  gyroscope?: { x: number; y: number; z: number };
  imu?: { roll: number; pitch: number; yaw: number };
  touchSensors?: { front: boolean; left: boolean; right: boolean; back: boolean };
  temperature?: number;
}
```

**Implementation:**
- Update `src/types/index.ts` - Extended sensor types
- Create `src/hooks/useSensorSimulation.ts` - Simulate sensor values based on robot state
- Update `SensorPanel.tsx` - Display new sensors
- Connect sensors to physics state (collision = touch, position = GPS, etc.)

### 2.2 Lidar Visualization
**Priority: Medium | Complexity: High | Est. Files: 2-3**

Simulated 2D/360° lidar with point cloud visualization.

```typescript
interface LidarConfig {
  enabled: boolean;
  numRays: number;        // e.g., 360 for 1° resolution
  maxRange: number;       // meters
  minRange: number;
  scanRate: number;       // Hz
  position: [number, number, number];  // mount position on robot
}

interface LidarReading {
  points: Array<{ angle: number; distance: number; hit: boolean }>;
  timestamp: number;
}
```

**Implementation:**
- Create `src/components/simulation/LidarVisualization.tsx` - 3D rays/point cloud
- Create `src/hooks/useLidarSimulation.ts` - Raycast against scene for distances
- Use Three.js Raycaster against physics objects
- Add lidar toggle to sensor panel

### 2.3 Camera View (Robot Eye View)
**Priority: Medium | Complexity: Medium | Est. Files: 2**

Picture-in-picture showing what the robot "sees".

**Implementation:**
- Create `src/components/simulation/RobotCameraView.tsx` - Secondary canvas/render target
- Use Three.js secondary camera positioned at gripper/head
- Render to texture, display in corner overlay
- Optional: Add simulated object detection overlays

### 2.4 Real-time Plots
**Priority: Medium | Complexity: Medium | Est. Files: 2-3**

Graph joint positions, sensor values over time.

```typescript
interface PlotData {
  label: string;
  data: Array<{ time: number; value: number }>;
  color: string;
}
```

**Implementation:**
- Install lightweight charting library (e.g., `recharts` or `uplot`)
- Create `src/components/visualization/RealTimePlot.tsx`
- Create `src/hooks/useDataRecorder.ts` - Ring buffer for time-series data
- Add collapsible plot panel to UI

---

## Phase 3: Robot Variety & Import

### 3.1 More Robot Types
**Priority: High | Complexity: High | Est. Files: 5-8**

Add wheeled robots, drones, and potentially humanoids.

**Wheeled Robot (Differential Drive):**
```typescript
interface WheeledRobotState {
  leftWheelSpeed: number;   // -255 to 255
  rightWheelSpeed: number;
  heading: number;          // degrees
  position: { x: number; y: number };
  servoHead: number;        // for ultrasonic mount
}
```

**Drone (Quadcopter):**
```typescript
interface DroneState {
  altitude: number;
  roll: number;
  pitch: number;
  yaw: number;
  throttle: number;
  position: { x: number; y: number; z: number };
}
```

**Implementation:**
- Create `src/components/simulation/WheeledRobot3D.tsx` - 3D model + physics
- Create `src/components/simulation/Drone3D.tsx` - 3D model + physics
- Create `src/lib/wheeledRobotAPI.ts` - API for wheeled robots
- Create `src/lib/droneAPI.ts` - API for drones
- Update `src/config/robots.ts` - Add new robot profiles
- Create robot selection UI with visual previews
- Abstract physics to support different robot types

### 3.2 URDF Import
**Priority: Low | Complexity: High | Est. Files: 3-4**

Parse and render URDF (Unified Robot Description Format) files.

```typescript
interface URDFRobot {
  name: string;
  links: URDFLink[];
  joints: URDFJoint[];
  materials: URDFMaterial[];
}
```

**Implementation:**
- Install or create URDF parser (`urdf-loader` npm package exists)
- Create `src/lib/urdfParser.ts` - Parse URDF XML
- Create `src/components/simulation/URDFRobot3D.tsx` - Render parsed robot
- Create `src/components/controls/URDFImporter.tsx` - File upload UI
- Map URDF joints to physics constraints

### 3.3 Modular Robot Builder
**Priority: Low | Complexity: Very High | Est. Files: 8-10**

Drag-and-drop robot construction.

```typescript
interface RobotPart {
  id: string;
  type: 'base' | 'link' | 'joint' | 'sensor' | 'actuator';
  model: string;           // 3D model reference
  attachPoints: AttachPoint[];
  properties: PartProperties;
}

interface RobotBlueprint {
  id: string;
  name: string;
  parts: Array<{ part: RobotPart; parentId?: string; attachPointId?: string }>;
}
```

**Implementation:**
- Create `src/components/builder/RobotBuilder.tsx` - Main builder interface
- Create `src/components/builder/PartPalette.tsx` - Available parts
- Create `src/components/builder/PartInspector.tsx` - Part properties
- Create `src/config/robotParts.ts` - Part library
- Create `src/lib/robotAssembler.ts` - Convert blueprint to renderable robot
- Save/load blueprints to localStorage or URL

---

## Phase 4: Sharing & Collaboration

### 4.1 Shareable Simulations
**Priority: Medium | Complexity: Medium | Est. Files: 3-4**

URL-based scene sharing.

```typescript
interface ShareableState {
  robotId: string;
  environment: EnvironmentType;
  code: string;
  joints: JointState;
  objects: SimObject[];
  // Compressed and encoded in URL
}
```

**Implementation:**
- Create `src/lib/stateSerializer.ts` - Serialize/deserialize state
- Use `lz-string` for compression
- Encode in URL hash: `#/share/base64encodedstate`
- Create `src/components/controls/ShareButton.tsx` - Generate share URL
- Parse URL on app load to restore state
- Optional: Backend storage with short URLs

---

## Implementation Order (Recommended)

```
Week 1-2: Phase 1 (API + Console + Templates)
├── robotAPI.ts
├── codeRunner.ts
├── ConsolePanel.tsx
├── codeTemplates.ts
└── Run button integration

Week 3-4: Phase 2 (Sensors + Visualization)
├── Extended sensors
├── Lidar simulation
├── Camera view
└── Real-time plots

Week 5-6: Phase 3a (Robot Types)
├── Wheeled robot
├── Drone
└── Robot selection UI

Week 7-8: Phase 3b (Import/Builder)
├── URDF importer
└── Modular builder (basic)

Week 9+: Phase 4 (Sharing)
├── State serialization
└── URL sharing
```

---

## File Structure After Implementation

```
src/
├── lib/
│   ├── robotAPI.ts           # Core robot API
│   ├── wheeledRobotAPI.ts    # Wheeled robot specific
│   ├── droneAPI.ts           # Drone specific
│   ├── codeRunner.ts         # Safe code execution
│   ├── urdfParser.ts         # URDF parsing
│   ├── robotAssembler.ts     # Blueprint to robot
│   └── stateSerializer.ts    # Share state encoding
├── components/
│   ├── simulation/
│   │   ├── WheeledRobot3D.tsx
│   │   ├── Drone3D.tsx
│   │   ├── URDFRobot3D.tsx
│   │   ├── LidarVisualization.tsx
│   │   └── RobotCameraView.tsx
│   ├── editor/
│   │   ├── ConsolePanel.tsx
│   │   └── TemplateSelector.tsx
│   ├── visualization/
│   │   └── RealTimePlot.tsx
│   ├── builder/
│   │   ├── RobotBuilder.tsx
│   │   ├── PartPalette.tsx
│   │   └── PartInspector.tsx
│   └── controls/
│       └── ShareButton.tsx
├── hooks/
│   ├── useSensorSimulation.ts
│   ├── useLidarSimulation.ts
│   └── useDataRecorder.ts
└── config/
    ├── codeTemplates.ts
    └── robotParts.ts
```

---

## Dependencies to Add

```json
{
  "recharts": "^2.x",        // For real-time plots
  "lz-string": "^1.x",       // For URL compression
  "urdf-loader": "^0.x"      // For URDF parsing (optional)
}
```

---

## Questions to Consider

1. **Code execution security**: Run in Web Worker with timeout? Sandbox with limited API?
2. **Performance**: How many lidar rays before performance degrades?
3. **Robot builder complexity**: Start with preset parts or full customization?
4. **Sharing backend**: URL-only or add server-side storage for short links?

---

## Quick Wins (Can Start Immediately)

1. Console output panel (2-3 hours)
2. Code templates dropdown (2-3 hours)
3. Extended sensor types in store (1-2 hours)
4. Share button with URL encoding (3-4 hours)
