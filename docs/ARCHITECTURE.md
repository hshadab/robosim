# RoboSim Architecture

This document describes the architectural decisions, design patterns, and technical choices in RoboSim.

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [AI Integration Strategy](#ai-integration-strategy)
4. [State Management](#state-management)
5. [3D Rendering Pipeline](#3d-rendering-pipeline)
6. [Design Decisions](#design-decisions)

---

## Overview

RoboSim is a web-based robotics simulation platform built with a **prompt-first architecture**. The primary interface is natural language, with traditional controls as a secondary option.

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| UI Framework | React 19 | Modern concurrent features, ecosystem |
| Type Safety | TypeScript | Catch errors at compile time |
| 3D Graphics | Three.js + R3F | Industry standard, React integration |
| Physics | Rapier | Fast WASM-based physics engine |
| State | Zustand | Lightweight, minimal boilerplate |
| Styling | Tailwind CSS | Utility-first, rapid development |
| Build | Vite | Fast HMR, modern ESM support |
| AI/ML | Claude API, Transformers.js, ONNX Runtime | Flexible local + cloud AI |

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐    │
│  │  Chat   │ │ Controls│ │  Code   │ │ 3D Viewport     │    │
│  │  Panel  │ │  Panel  │ │ Editor  │ │ (SimulationView)│    │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘    │
└───────┼──────────┼──────────┼────────────────┼──────────────┘
        │          │          │                │
        ▼          ▼          ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    React Hooks Layer                         │
│  ┌──────────────┐ ┌────────────────┐ ┌────────────────────┐ │
│  │ useLLMChat   │ │ useRobotContext│ │ useTrajectoryExec  │ │
│  └──────────────┘ └────────────────┘ └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      State Layer                             │
│         ┌──────────────────────────────────┐                │
│         │        Zustand Store             │                │
│         │  (useAppStore, useAuthStore)     │                │
│         └──────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ claudeApi│ │ voiceCtrl│ │ vision   │ │ aiImageGen     │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├────────────────┤  │
│  │semanticSt│ │ textTo3D │ │ copilot  │ │ policyRunner   │  │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├────────────────┤  │
│  │pickupEx. │ │ikSolver  │ │ (NEW)    │ │ (training)     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## AI Integration Strategy

### Prompt-First Design

Traditional robotics simulators expose joint angles and coordinates. RoboSim inverts this:

1. **Semantic State Translation**: Robot state is converted to natural language
2. **LLM Understanding**: The LLM sees "arm is raised, gripper open" not "shoulder: 45°"
3. **Relative Commands**: Users can say "move a bit left" instead of "set base to 30°"

```typescript
// src/lib/semanticState.ts
export function generateSemanticState(robotType, joints, ...): string {
  // "The arm is rotated 45° to the left, with the gripper fully open.
  //  The end effector is at medium height, reaching forward."
}
```

### LLM Training Data Collection

The system automatically learns from pickup attempts:

```
┌─────────────────────────────────────────────────────────────┐
│  User Chat: "pick up the cube"                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  handlePickUpCommand() in claudeApi.ts                       │
│  - Calculate IK for approach/grasp/lift                      │
│  - Returns pickupAttempt metadata                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  useLLMChat Hook                                             │
│  - logPickupAttempt() → stores attempt                       │
│  - executeArmSequence() → 4-step pickup                      │
│  - Check objects.isGrabbed                                   │
│  - markPickupSuccess() or markPickupFailure()                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  pickupExamples.ts (Training Store)                          │
│  - VERIFIED_PICKUPS: Demo Pick Up configurations             │
│  - Logged attempts with success/failure                      │
│  - findSimilarPickups() for few-shot learning                │
│  - exportForTraining() for LeRobot format                    │
└─────────────────────────────────────────────────────────────┘
```

Key files:
- `src/lib/pickupExamples.ts` - Training data storage
- `src/lib/claudeApi.ts` - IK calculation + pickupAttempt metadata
- `src/hooks/useLLMChat.ts` - Success/failure logging
- `src/lib/lerobotExporter.ts` - LeRobot format export
- `src/lib/qualityGates.ts` - Episode validation

> **See Also**: [TRAINING_DATA_GUIDE.md](./TRAINING_DATA_GUIDE.md) for detailed information on training data quality, known issues, and export best practices.

### Graceful Degradation

All AI features work in three modes:

| Mode | Availability | Features |
|------|--------------|----------|
| **Full** | API key configured | Claude Vision, advanced understanding |
| **Local** | Transformers.js models | Object detection, basic classification |
| **Demo** | No setup required | Simulated responses, pattern matching |

Example from `visionLanguage.ts`:
```typescript
if (!apiKey) {
  return askAboutSceneLocal(query);  // Use local DETR model
}
// Otherwise use Claude Vision API
```

### AI Feature Matrix

| Feature | Local Model | Cloud API | Offline Works? |
|---------|-------------|-----------|----------------|
| Voice Control | Web Speech API | - | Yes |
| Object Detection | DETR (Transformers.js) | - | Yes |
| Scene Questions | - | Claude Vision | No |
| Code Generation | Templates | Claude | Partial |
| Image Generation | - | Gemini | No |
| Policy Inference | ONNX Runtime | HuggingFace Hub | Cached |

---

## State Management

### Why Zustand?

We chose Zustand over Redux or Context for:

1. **Minimal Boilerplate**: No action creators, reducers, or dispatch
2. **TypeScript First**: Excellent type inference
3. **Performance**: Fine-grained subscriptions, no context re-renders
4. **Size**: ~1KB vs Redux's ~7KB

### Store Structure

```typescript
// src/stores/useAppStore.ts
interface AppState {
  // Robot state
  joints: JointState;
  wheeledRobot: WheeledRobotState;
  drone: DroneState;
  humanoid: HumanoidState;

  // Sensors
  sensors: SensorReading;

  // UI state
  activeRobot: ActiveRobotType;
  isAnimating: boolean;
  messages: ChatMessage[];

  // Actions
  setJoints: (joints: Partial<JointState>) => void;
  addMessage: (msg: ChatMessage) => void;
  // ...
}
```

### Event Bus Pattern

For cross-component communication (e.g., "task completed" → show in chat):

```typescript
// src/lib/robotContext.ts
class RobotContext {
  private eventListeners = new Map<string, Set<Function>>();

  emit(event: RobotEvent) {
    this.eventListeners.get(event.type)?.forEach(cb => cb(event));
  }

  subscribe(type: string, callback: Function) {
    // ...
  }
}
```

---

## 3D Rendering Pipeline

### URDF Loading

We use official URDF files from robot manufacturers:

```
public/models/so101/
├── so101.urdf           # Joint definitions, limits
└── meshes/
    ├── base_link.stl
    ├── shoulder_link.stl
    └── ...
```

The `urdf-loader` library parses URDF and loads STL meshes:

```typescript
// src/components/simulation/SO101Arm3D.tsx
loader.load('/models/so101/so101.urdf', (robot) => {
  robot.rotation.x = -Math.PI / 2;  // Z-up to Y-up
  setRobotModel(robot);
});
```

### Material System

```typescript
const PRINTED_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#F5F0E6',  // PLA plastic
  metalness: 0.0,
  roughness: 0.4,
});

const SERVO_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#1a1a1a',  // Black servo housing
  metalness: 0.2,
  roughness: 0.3,
});
```

### Physics Integration

Robots are primarily kinematic (joint-driven), not physics-driven:

```tsx
<RigidBody type="fixed" colliders={false}>
  <CuboidCollider args={[0.06, 0.04, 0.06]} position={[0, 0.04, 0]} />
  <primitive object={robot} />
</RigidBody>
```

Interactive objects use dynamic physics:
```tsx
<RigidBody type="dynamic" colliders="hull">
  <mesh geometry={cubeGeometry} />
</RigidBody>
```

---

## Design Decisions

### ADR-001: Prompt-First Architecture

**Context**: Traditional robotics interfaces are technical and intimidating.

**Decision**: Make natural language the primary interface.

**Consequences**:
- Lower barrier to entry for beginners
- Requires robust semantic state translation
- Demo mode needed for offline/no-API usage

### ADR-002: Browser-First Deployment

**Context**: Users shouldn't need to install software.

**Decision**: Run everything in the browser (no server required).

**Consequences**:
- Use WebAssembly for physics (Rapier) and ML (ONNX Runtime)
- Hardware connection via Web Serial API
- State persistence in IndexedDB
- Some features require Chrome/Edge

### ADR-003: Multiple Robot Support

**Context**: Different users have different hardware.

**Decision**: Abstract robot types behind a common interface.

**Consequences**:
- `ActiveRobotType` union: 'arm' | 'wheeled' | 'drone' | 'humanoid'
- Each type has its own state shape
- Commands are translated per-robot-type
- Multi-robot instances for swarm simulation

### ADR-004: Graceful AI Degradation

**Context**: Not all users have API keys.

**Decision**: Every AI feature must work without internet.

**Consequences**:
- Local models via Transformers.js
- Pattern-matching fallbacks
- Demo mode with simulated responses
- Clear indicators when running in limited mode

### ADR-005: Self-Collision Prevention

**Context**: URDF models are kinematic, not collision-aware.

**Decision**: Implement software constraints for impossible poses.

**Consequences**:
- Joint combinations are checked before applying
- Some valid poses may be incorrectly blocked
- Tradeoff between safety and flexibility

### ADR-006: LLM Training Data Collection

**Context**: Pickup commands need to improve over time.

**Decision**: Automatically log all pickup attempts with outcomes.

**Consequences**:
- Every pickup stores object position, joint sequence, IK errors
- Success/failure determined by checking gripper holds object
- System prompt includes similar successful examples (few-shot)
- Training data can be exported to LeRobot format
- Verified examples from Demo Pick Up seed the store

---

## File Organization

```
src/
├── components/           # React components
│   ├── simulation/       # 3D rendering (SO101Arm3D, etc.)
│   ├── controls/         # UI panels (JointControls, etc.)
│   ├── chat/             # LLM chat interface
│   ├── editor/           # Code editor (Monaco)
│   └── layout/           # App layout (MainLayout)
├── hooks/                # Custom React hooks
│   ├── useLLMChat.ts     # Chat with Claude
│   ├── useRobotContext.ts # Robot state + events
│   └── useCodeCopilot.ts  # AI code completion
├── lib/                  # Non-React utilities
│   ├── claudeApi.ts      # Claude API client + pickup commands
│   ├── pickupExamples.ts # Training data from pickup attempts
│   ├── ikSolverWorker.ts # Web Worker IK solver
│   ├── voiceControl.ts   # Web Speech API
│   ├── visionLanguage.ts # Scene understanding
│   ├── textTo3D.ts       # Mesh generation
│   └── logger.ts         # Structured logging
├── stores/               # Zustand stores
├── config/               # Static configuration
└── types/                # TypeScript definitions
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `JointControls.tsx` |
| Hooks | camelCase, `use` prefix | `useLLMChat.ts` |
| Utilities | camelCase | `semanticState.ts` |
| Types | PascalCase | `JointState` |
| Constants | SCREAMING_SNAKE | `DEFAULT_IK_CONFIG` |

---

## Performance Considerations

### Rendering Optimization

- Use `React.memo` for static 3D components
- Throttle joint updates to 60 FPS max
- Lazy load 3D models on first use
- Use `useFrame` for animation loops, not `setInterval`

### State Updates

- Zustand allows fine-grained subscriptions
- Only re-render components that use changed state
- Batch sensor updates to reduce re-renders

### AI Inference

- Cache loaded Transformers.js models
- Use ONNX Runtime WebAssembly for policies
- Debounce vision analysis requests
- Pre-load common models on idle

---

## Testing Strategy

| Type | Tool | Coverage |
|------|------|----------|
| Unit | Vitest | Core utilities, serializers |
| Component | React Testing Library | Planned |
| E2E | Playwright | Planned |
| Visual | Storybook | Planned |

Current test files:
- `src/test/codeExporter.test.ts`
- `src/test/hardwareKits.test.ts`
- `src/test/stateSerializer.test.ts`

---

## Future Considerations

### Planned Improvements

1. **TypeScript Strictness**: Remove remaining `any` types
2. **Error Boundaries**: Catch and display 3D rendering errors
3. **Metrics**: Usage analytics for feature prioritization
4. **PWA**: Offline support with service workers

### Scalability

- Current architecture supports 8 simultaneous robots
- IndexedDB can store unlimited save states
- WebGL context is shared across all 3D views

---

## Contributing

When adding new features:

1. Create types in `src/types/`
2. Add service logic in `src/lib/`
3. Create React hook if needed in `src/hooks/`
4. Build UI component in `src/components/`
5. Export from index files
6. Update this document if architectural decisions are made

---

## Monorepo Assessment

The refactoring work (Phases 1–4) identified clear module boundaries that could become separate packages if the project grows. Below are the candidate packages and the current recommendation.

### Identified Module Boundaries

| Package | Contents | Key Exports |
|---------|----------|-------------|
| `@robosim/core` | `src/types/`, `src/config/`, `src/lib/logger.ts`, `src/lib/retry.ts`, `src/lib/circuitBreaker.ts` | Types, constants, shared utilities |
| `@robosim/simulator` | `src/components/simulation/`, `src/lib/numericalIK.ts`, `src/lib/trajectoryPlanner.ts`, `src/lib/ikSolverWorker.ts` | Three.js scene, physics, robot models, IK solver |
| `@robosim/llm` | `src/lib/claude/`, `src/lib/claudeApi.ts`, `src/hooks/useLLMChat.ts`, `src/lib/semanticState.ts` | Claude API, streaming, chat hook |
| `@robosim/exporters` | `src/lib/exporters/`, `src/lib/lerobot/`, `src/lib/lerobotExporter.ts`, `src/lib/parquetWriter.ts` | LeRobot dataset, code export, Parquet |
| `@robosim/image-to-3d` | `src/lib/imageTo3D/`, `src/lib/rodinImageTo3D.ts`, `src/lib/csmImageTo3D.ts`, `src/lib/falImageTo3D.ts` | Provider system, 3D model generation |

### Dependency Graph

```
@robosim/core ← @robosim/simulator
                ← @robosim/llm
                ← @robosim/exporters
                ← @robosim/image-to-3d
```

All packages depend on `core`; no circular dependencies exist between the other packages.

### Recommendation: Defer Actual Split

**Current Vite chunk splitting is sufficient.** The module boundaries documented above are enforced by directory structure and barrel exports. A monorepo split (e.g., via Turborepo or Nx) would add tooling overhead without clear benefit at the current project size.

**When to revisit:**
- If multiple applications need to share `@robosim/core` or `@robosim/simulator`
- If CI build times exceed 5 minutes and parallelization would help
- If independent versioning of packages becomes necessary
