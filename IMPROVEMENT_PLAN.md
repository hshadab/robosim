# RoboSim Improvement Plan for LeRobot Export

## Goal
Export realistic SO-101 data to the LeRobot community on HuggingFace for sim-to-real transfer.

---

## Priority 1: Fix Rendering Issues

### 1.1 Rapier Deprecation Warning (Cosmetic)
- **Status**: Known wasm-bindgen issue, does NOT affect functionality
- **Source**: `@dimforge/rapier3d-compat` WASM initialization
- **Fix**: Suppress console warning OR wait for upstream fix in Rapier
- **Reference**: [GitHub Issue #811](https://github.com/dimforge/rapier/issues/811)

### 1.2 Rendering Not Working
- **Possible causes**:
  1. WebGL context loss (Intel Arc GPU) - ✅ Already has recovery code
  2. Canvas not mounting in container
  3. Three.js/R3F initialization timing
  4. Physics suspension blocking render
- **Diagnostic steps**:
  1. Check browser console for actual errors (not warnings)
  2. Verify WebGL support: `canvas.getContext('webgl2')`
  3. Check if `<Canvas>` component mounts (`onCreated` callback)
  4. Test with physics disabled

### 1.3 Intel Arc GPU Compatibility
- **Current fix**: StrictMode disabled in `main.tsx:19-21`
- **Enhancement**: Add WebGL capability detection on startup

---

## Priority 2: SO-101 Data Quality

### 2.1 Joint Calibration ✅ (Already Implemented)
- Degrees → Radians conversion in `lerobotExporter.ts:210-222`
- Gripper mapping: 0-100% → 0-1.0

### 2.2 Recording Rate ✅ (Already Implemented)
- 30Hz control rate (LeRobot standard)
- 10Hz image capture during animation
- See `MinimalTrainFlow.tsx:484` - synthetic frames at 30fps

### 2.3 Improvements Needed
| Feature | Current | Target | File |
|---------|---------|--------|------|
| Camera intrinsics | None | Export FOV/resolution | `lerobotExporter.ts` |
| Joint velocity | Not recorded | Add velocity estimation | `datasetExporter.ts` |
| Gripper force | Not recorded | Estimate from collision | `GraspManager.tsx` |

---

## Priority 3: LeRobot Export Enhancements

### 3.1 Export Pipeline ✅ (Already Robust)
- **Parquet**: Real Parquet files via `parquet-wasm` (`parquetWriter.ts`)
- **MP4 Video**: Via ffmpeg worker
- **Metadata**: Full LeRobot v3.0 schema
- **Quality Gates**: Frame count, success rate, motion smoothness

### 3.2 Sim-to-Real Metadata ✅ (Already Implemented)
Located in `lerobotExporter.ts:49-72`:
```typescript
interface SimToRealMetadata {
  cameraConfig?: SimCameraConfig;
  physicsIdentification?: PhysicsIdentification;
  actionCalibration?: ActionCalibrationConfig;
  augmentation?: {...};
  domainRandomization?: {...};
}
```

### 3.3 Image Augmentation ✅ (Already Implemented)
- Gaussian noise: 0-10 sigma per episode
- Motion blur: 0-3px
- Brightness/contrast variation
- See `cameraCapture.ts` - `applyAugmentations()`

### 3.4 Enhancements Needed
| Feature | Priority | Implementation |
|---------|----------|----------------|
| Multi-camera export | Medium | Add wrist_cam view option |
| Depth maps | Low | Export depth buffer |
| Segmentation masks | Low | Object-level masks |

---

## Priority 4: HuggingFace Integration ✅

### 4.1 Upload Pipeline (Already Implemented)
- **Direct upload**: `huggingfaceUpload.ts` - `uploadToHuggingFace()`
- **Backend API**: `uploadViaBackendAPI()` for Parquet conversion
- **Token validation**: `validateHFToken()`

### 4.2 Dataset Card ✅
- Auto-generated README.md with YAML front matter
- Tags: `lerobot`, `sim-to-real`, `imitation-learning`, `robot-manipulation`
- Usage instructions included

### 4.3 Policy Browser ✅
- `huggingfaceHub.ts` - Search and download LeRobot policies
- Filter by robot type (SO-101)
- ONNX/SafeTensors support

---

## Priority 5: Google Colab Training ✅

### 5.1 Notebook (Already Exists)
- `notebooks/train_so101_colab.ipynb`
- Free T4 GPU training (~2 hours)
- ACT policy training for manipulation

### 5.2 Link in UI ✅
- "Train on Google Colab" button in `MinimalTrainFlow.tsx:1462-1475`
- Dataset ID copy-paste workflow

---

## Implementation Checklist

### Immediate Fixes
- [ ] Suppress Rapier deprecation warning
- [ ] Add WebGL diagnostic on startup
- [ ] Verify canvas mount in SimulationViewport

### Short-term (This Week)
- [ ] Add camera intrinsics to export metadata
- [ ] Estimate joint velocities from position delta
- [ ] Add wrist camera view option

### Medium-term
- [ ] Physics system identification export
- [ ] Action calibration wizard
- [ ] Multi-episode batch recording UI

---

## Files Reference

| Feature | Primary File | Lines |
|---------|--------------|-------|
| 3D Rendering | `RobotArm3D.tsx` | 325-480 |
| Physics | `PhysicsObjects.tsx` | All |
| LeRobot Export | `lerobotExporter.ts` | All |
| HF Upload | `huggingfaceUpload.ts` | All |
| Train Flow | `MinimalTrainFlow.tsx` | All |
| Colab Notebook | `notebooks/train_so101_colab.ipynb` | All |
| Quality Gates | `qualityGates.ts` | All |
| Image Augment | `cameraCapture.ts` | `applyAugmentations` |
