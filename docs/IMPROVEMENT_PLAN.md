# RoboSim Improvement Plan for LeRobot Export

## Goal
Export realistic SO-101 data to the LeRobot community on HuggingFace for sim-to-real transfer.

---

## Completed Improvements (January 2025)

### Camera Intrinsics Export
- **Status**: COMPLETED
- **Files**: `src/types/index.ts`, `src/lib/lerobotExporter.ts`
- **Features**:
  - Added `CameraIntrinsics` interface with fx, fy, cx, cy, distortion coefficients
  - Auto-computes intrinsics from FOV and resolution using pinhole camera model
  - SO-101 camera presets (`SO-101-default`, `SO-101-overhead`, `SO-101-side`)
  - Exported in `info.json` under `simToReal.cameraIntrinsics`

### Joint Velocity Estimation
- **Status**: COMPLETED
- **Files**: `src/lib/lerobotExporter.ts`, `src/lib/parquetWriter.ts`
- **Features**:
  - Added `observation.velocity` field (6-DOF joint velocities in rad/s)
  - Computes velocities from position deltas when not recorded
  - Included in Parquet schema and feature definitions
  - Statistics (min/max/mean/std) computed and exported in `stats.json`

### Multi-Camera Export
- **Status**: COMPLETED
- **Files**: `src/lib/lerobotExporter.ts`
- **Features**:
  - Added `LeRobotCameraView` type: `cam_high`, `cam_wrist`, `cam_left`, `cam_right`
  - `MultiCameraVideoBlobs` interface for multiple simultaneous camera views
  - Automatic feature registration per camera in `info.json`
  - Per-camera video directories: `videos/observation.images.<view>/`
  - Updated README generator with multi-camera documentation
  - Backwards compatible (legacy `videoBlobs` still works)

### Motor Dynamics Simulation
- **Status**: COMPLETED
- **Files**: `src/stores/useAppStore.ts`, `src/components/simulation/SO101Arm3D.tsx`
- **Features**:
  - Added `MotorDynamicsConfig` with velocity/acceleration limits per joint
  - Separated `joints` (target) from `actualJoints` (after motor dynamics)
  - P-controller with velocity/acceleration limiting
  - Configurable latency simulation
  - Default SO-101 servo specs (STS3215 motor characteristics)
  - Disabled by default for backwards compatibility
  - Enable with: `useAppStore.getState().setMotorDynamics({ enabled: true })`

### Action Calibration Integration
- **Status**: COMPLETED (was already implemented)
- **Files**: `src/lib/actionCalibration.ts`, `src/lib/lerobotExporter.ts`
- **Features**:
  - Per-joint offset, scale, direction correction
  - PWM pulse width mapping for real servos
  - Auto-calibration from data points
  - Minimum-jerk trajectory generation
  - Fully integrated into LeRobot export metadata

---

## Previously Implemented Features

### Joint Calibration
- Degrees → Radians conversion in `lerobotExporter.ts`
- Gripper mapping: 0-100% → 0-1.0

### Recording Rate
- 30Hz control rate (LeRobot standard)
- 10Hz image capture during animation

### LeRobot Export Pipeline
- **Parquet**: Real Parquet files via `parquet-wasm`
- **MP4 Video**: Via ffmpeg worker
- **Metadata**: Full LeRobot v3.0 schema
- **Quality Gates**: Frame count, success rate, motion smoothness

### Sim-to-Real Metadata
- Camera configuration export
- Physics identification export
- Domain randomization settings

### Image Augmentation
- Gaussian noise: 0-10 sigma per episode
- Motion blur: 0-3px
- Brightness/contrast variation

### HuggingFace Integration
- Direct upload via `huggingfaceUpload.ts`
- Token validation
- Dataset card generation
- Policy browser for LeRobot policies

### Google Colab Training
- Pre-configured notebook: `notebooks/train_so101_colab.ipynb`
- Free T4 GPU training (~2 hours)
- ACT policy training

---

## Usage Examples

### Enable Motor Dynamics for Training Data
```typescript
import { useAppStore } from './stores/useAppStore';

// Enable realistic servo simulation
useAppStore.getState().setMotorDynamics({
  enabled: true,
  velocityLimits: {
    base: 120,      // deg/s
    shoulder: 90,
    elbow: 90,
    wrist: 120,
    wristRoll: 150,
    gripper: 180,
  },
  accelerationLimits: {
    base: 500,      // deg/s²
    shoulder: 400,
    elbow: 400,
    wrist: 600,
    wristRoll: 800,
    gripper: 1000,
  },
  latencyMs: 20,    // 20ms command latency
});
```

### Export with Multi-Camera Videos
```typescript
import { exportLeRobotDataset } from './lib/lerobotExporter';

await exportLeRobotDataset(episodes, {
  datasetName: 'my-so101-dataset',
  robotId: 'so-101',
  fps: 30,
  multiCameraVideoBlobs: {
    cam_high: overheadVideos,    // Blob[] for each episode
    cam_wrist: wristVideos,      // Optional wrist camera
  },
  simToReal: {
    cameraConfig: SO101_CAMERA_PRESETS['SO-101-default'],
    // cameraIntrinsics auto-computed from config
  },
});
```

### Read Joint Velocities from Export
```python
import pandas as pd

# Load exported episode
df = pd.read_parquet('data/chunk-000/episode_000000.parquet')

# Velocities are in rad/s for joints 0-4, normalized for gripper
velocities = df['observation.velocity'].tolist()
```

---

## Files Reference

| Feature | Primary File | Description |
|---------|--------------|-------------|
| Motor Dynamics | `src/stores/useAppStore.ts` | Velocity/acceleration limits, P-controller |
| Camera Intrinsics | `src/types/index.ts` | CameraIntrinsics interface, SO101 presets |
| Joint Velocity | `src/lib/lerobotExporter.ts` | Velocity estimation from position delta |
| Multi-Camera | `src/lib/lerobotExporter.ts` | Multi-view video export |
| Action Calibration | `src/lib/actionCalibration.ts` | Sim-to-real servo mapping |
| Parquet Writer | `src/lib/parquetWriter.ts` | LeRobot data format |
| LeRobot Export | `src/lib/lerobotExporter.ts` | Main export pipeline |

---

## Remaining Ideas (Future Work)

| Feature | Priority | Notes |
|---------|----------|-------|
| Depth maps export | Low | Export depth buffer alongside RGB |
| Segmentation masks | Low | Object-level masks for training |
| Real-time physics viz | Medium | Show motor dynamics visually |
| Calibration wizard UI | Medium | GUI for servo calibration |
