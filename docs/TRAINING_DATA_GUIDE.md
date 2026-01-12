# Training Data Quality Guide

This document describes the training data pipeline, known issues, and best practices for generating accurate training data for LeRobot and other imitation learning frameworks.

## Table of Contents

1. [Overview](#overview)
2. [Data Pipeline Architecture](#data-pipeline-architecture)
3. [Known Issues & Fixes](#known-issues--fixes)
4. [Data Format Specifications](#data-format-specifications)
5. [Quality Gates](#quality-gates)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

RoboSim generates training data for the SO-101 robot arm compatible with:
- **LeRobot** (HuggingFace) - Primary export target
- **ACT Policy** - Action Chunking Transformer
- **Diffusion Policy** - Denoising diffusion for actions

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/lerobotExporter.ts` | LeRobot v3.0 format export |
| `src/lib/parquetWriter.ts` | Parquet file generation |
| `src/lib/pickupExamples.ts` | Training data collection |
| `src/lib/qualityGates.ts` | Episode validation |
| `src/lib/datasetExporter.ts` | Core Episode/Frame types |
| `src/lib/physicsEpisodeGenerator.ts` | Physics-based episode recording |

---

## Data Pipeline Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Data Collection │────>│  Quality Gates   │────>│  LeRobot Export  │
│                  │     │                  │     │                  │
│  - LLM Chat      │     │  - Frame count   │     │  - Unit convert  │
│  - Demo Record   │     │  - Jerk check    │     │  - Parquet write │
│  - Physics Gen   │     │  - Variance      │     │  - Video encode  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Data Flow

1. **Collection**: Robot movements captured via `DatasetRecorder` or `PhysicsEpisodeGenerator`
2. **Storage**: Episodes stored with frames containing observations/actions
3. **Validation**: Quality gates check smoothness, completeness, timing
4. **Export**: Convert to LeRobot Parquet format with proper units

---

## Known Issues & Fixes

> **Status**: All critical and high-priority issues have been fixed as of January 2025.

### FIXED: Unit Conversion (Critical)

**Problem**: Joint angles were stored in degrees but LeRobot expects radians.

**Solution Applied** (`src/lib/parquetWriter.ts`):
- Added `convertToRadians()` helper function
- `episodesToParquetFormat()` now converts degrees → radians
- Gripper values normalized from 0-100 to 0-1

```typescript
function convertToRadians(joints: number[]): number[] {
  const DEG_TO_RAD = Math.PI / 180;
  return joints.map((val, idx) => {
    if (idx === 5) return val / 100; // Gripper: 0-100% → 0-1
    return val * DEG_TO_RAD;         // Joint angles: degrees → radians
  });
}
```

---

### FIXED: Velocity Computation (Critical)

**Problem**: `observation.velocity` was not computed in the parquetWriter path.

**Solution Applied** (`src/lib/parquetWriter.ts`):
- Velocity now computed from position deltas: `v = (pos - prevPos) / dt`
- First frame gets zero velocity
- Uses FPS parameter for correct time delta

---

### FIXED: Timestamp Format (High)

**Problem**: `PhysicsEpisodeGenerator` stored timestamps in seconds, but pipeline expects milliseconds.

**Solution Applied** (`src/lib/physicsEpisodeGenerator.ts`):
- Changed `frameTime = (Date.now() - this.startTime) / 1000` to `frameTime = Date.now() - this.startTime`
- Duration now stored in milliseconds consistently
- Export pipeline converts ms → seconds when writing Parquet

---

### FIXED: Action Offset (High)

**Problem**: Action data equaled current observation instead of commanded target.

**Solution Applied** (`src/lib/datasetExporter.ts`):
- Updated `recordFrame()` to accept `action.jointTargets`
- Falls back to observation if not provided
- Added documentation explaining correct usage

```typescript
// Callers should now provide the target:
recorder.recordFrame(
  currentState,
  { jointTargets: targetJointPositions },
  imageDataUrl,
  done
);
```

---

### FIXED: Quality Gate Thresholds (Medium)

**Problem**: Default thresholds were too lenient, allowing poor-quality episodes.

**Solution Applied** (`src/lib/qualityGates.ts`):

| Threshold | Old Value | New Value |
|-----------|-----------|-----------|
| minFrames | 30 | 45 |
| maxJerk | 50.0 | 35.0 |
| minActionVariance | 0.001 | 0.003 |
| maxStaticFrames | 60 | 45 |
| minTaskConfidence | 0.5 | 0.6 |
| minDuration | 1000 | 1500 |

Added three threshold levels:
- `DEFAULT_THRESHOLDS` - Balanced (updated)
- `STRICT_THRESHOLDS` - Production quality
- `LENIENT_THRESHOLDS` - For debugging/initial collection

---

### FIXED: Language Instructions (Medium)

**Problem**: Original user commands were lost during community export.

**Solution Applied** (`src/lib/pickupExamples.ts`):
- `SharedExampleResponse` now includes `userMessage` and `languageVariants`
- Export uses original message: `example.userMessage || fallback`

---

## Data Format Specifications

### LeRobot v3.0 Format

```
dataset/
├── meta/
│   ├── info.json          # Dataset metadata
│   ├── stats.json         # Feature statistics (min/max/mean/std)
│   ├── episodes.jsonl     # Episode descriptions
│   └── tasks.jsonl        # Task definitions
├── data/
│   └── chunk-000/
│       └── episode_*.parquet
└── videos/
    └── observation.images.cam_high/
        └── episode_*.mp4
```

### Feature Schema

| Feature | Type | Shape | Unit | Range |
|---------|------|-------|------|-------|
| `observation.state` | float32 | [6] | radians | joint-specific |
| `observation.velocity` | float32 | [6] | rad/s | computed |
| `action` | float32 | [6] | radians | joint-specific |
| `episode_index` | int64 | [1] | - | 0..N |
| `frame_index` | int64 | [1] | - | 0..M |
| `timestamp` | float32 | [1] | seconds | 0..duration |
| `next.done` | bool | [1] | - | true/false |
| `task_index` | int64 | [1] | - | 0..T |

### SO-101 Joint Limits (Radians)

| Joint | Name | Min (rad) | Max (rad) |
|-------|------|-----------|-----------|
| 0 | base | -1.92 | +1.92 |
| 1 | shoulder | -1.75 | +1.75 |
| 2 | elbow | -1.69 | +1.69 |
| 3 | wrist | -1.66 | +1.66 |
| 4 | wristRoll | -2.74 | +2.84 |
| 5 | gripper | 0.0 | 1.0 |

---

## Quality Gates

### Validation Checks

1. **Frame Count**: Minimum 30 frames (60 recommended)
2. **Duration**: Minimum 1000ms (2000ms recommended)
3. **Jerk**: Maximum average jerk 50 rad/s³ (25 recommended)
4. **Action Variance**: Minimum 0.001 (0.005 recommended)
5. **Static Frames**: Maximum 60 consecutive (30 recommended)
6. **Timestamp Gaps**: Maximum 100ms (50ms recommended)
7. **Task Confidence**: Minimum 0.5 (0.7 recommended)

### Using Quality Gates

```typescript
import { checkQualityGates, STRICT_THRESHOLDS } from './qualityGates';

const result = checkQualityGates(episode, STRICT_THRESHOLDS);
if (!result.passed) {
  console.log('Failed gates:', result.failures);
}
```

### Export with Filtering

```typescript
import { exportLeRobotDataset } from './lerobotExporter';

await exportLeRobotDataset(episodes, {
  datasetName: 'my_dataset',
  robotId: 'so-101',
  qualityGates: {
    enabled: true,
    filterFailedEpisodes: true,  // Remove bad episodes
    thresholds: STRICT_THRESHOLDS,
  },
});
```

---

## Best Practices

### 1. Always Use Quality Gates

```typescript
// Enable quality gates for all exports
const result = await exportLeRobotDataset(episodes, {
  qualityGates: { enabled: true, filterFailedEpisodes: true },
});
console.log(`Exported ${result.exportedEpisodes}, skipped ${result.skippedEpisodes}`);
```

### 2. Validate Before Training

```typescript
import { validateForLeRobot } from './lerobotExporter';

const validation = validateForLeRobot(episodes);
if (!validation.valid) {
  throw new Error(validation.errors.join('; '));
}
if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
}
```

### 3. Check Unit Consistency

Before export, verify units match LeRobot expectations:
- Joint angles: radians
- Gripper: 0-1 (normalized)
- Timestamps: seconds (in export)
- Velocities: rad/s

### 4. Include Language Instructions

Always capture the user's original command:

```typescript
recorder.endEpisode(
  success,
  'pickup_cube',                    // Task category
  userMessage                       // Original: "grab the red block"
);
```

### 5. Record at Consistent Frame Rate

Use physics-based recording for consistent timing:

```typescript
const generator = new PhysicsEpisodeGenerator({
  frameRate: 30,  // Fixed 30 FPS
  robotId: 'so-101',
});
```

### 6. Verify Export Integrity

After export, run the conversion script and validate:

```bash
python convert_to_parquet.py
python -c "
from lerobot.common.datasets.lerobot_dataset import LeRobotDataset
ds = LeRobotDataset('.')
print(f'Loaded {len(ds)} frames')
"
```

---

## Troubleshooting

### Model Outputs Wrong Values

**Symptom**: Trained model outputs joint angles 50-60x too large.

**Cause**: Training data in degrees instead of radians.

**Fix**: Ensure `parquetWriter.ts` converts units before export.

---

### Gripper Always Closed/Open

**Symptom**: Gripper commands don't work correctly.

**Cause**: Gripper normalization mismatch.

**Check**: Verify gripper values in exported Parquet are 0-1, not 0-100.

---

### Jerky Motion on Real Robot

**Symptom**: Robot moves smoothly in sim but jerky on hardware.

**Cause**: Low-quality training data passed quality gates.

**Fix**: Use `STRICT_THRESHOLDS` for quality gates:

```typescript
import { STRICT_THRESHOLDS } from './qualityGates';
```

---

### Missing Frames in Export

**Symptom**: Fewer frames than expected in Parquet files.

**Cause**: Quality gates filtering or timestamp gaps.

**Debug**:
```typescript
const result = checkBatchQuality(episodes);
console.log(`Pass rate: ${result.summary.passRate * 100}%`);
result.results.filter(r => !r.passed).forEach(r => {
  console.log('Failed:', r.failures.map(f => f.message));
});
```

---

### Policy Lags Behind Commands

**Symptom**: Robot actions are 1 timestep late.

**Cause**: Action data equals observation instead of next target.

**Fix**: Record target joints as action, not current joints.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01 | Initial documentation |
| 1.1 | 2025-01 | Added known issues section, quality gate recommendations |
| 2.0 | 2025-01 | **All critical issues fixed**: unit conversion, velocity computation, timestamp format, action offset, quality thresholds, language preservation |

---

## References

- [LeRobot Dataset Format](https://huggingface.co/docs/lerobot/en/lerobot-dataset-v3)
- [SO-101 Robot Specifications](https://github.com/TheRobotStudio/SO-ARM100)
- [ACT Policy Paper](https://arxiv.org/abs/2304.13705)
