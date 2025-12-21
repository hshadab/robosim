# SO-101 Robot Arm Gripper Analysis & Fixes

## Status: RESOLVED (December 2024)

All grasp issues have been fixed. The robot can now reliably pick up objects.

---

## Summary of Issues (Historical)

### Issue 1: Jaw-Tip Offset (7.47cm) - FIXED

**Problem**: The gripper_frame_link (tip) was 7.47cm ahead of the actual jaw closing position.

- `gripper_frame_link` (tip): at Z=-0.0981m from gripper_link
- `moving_jaw`: at Z=-0.0234m from gripper_link
- **Offset: 9.81 - 2.34 = 7.47cm**

**Solution**: The IK solver now targets the **JAW position** instead of the tip position.

```typescript
// src/components/simulation/SO101KinematicsURDF.ts
const JAW_OFFSET_FROM_TIP = 0.073; // meters

export function calculateJawPositionURDF(joints: JointAngles): Vec3 {
  return calculateGripperPositionURDF(joints, true);
}
```

### Issue 2: Friction-Only Gripping - FIXED

**Problem**: Objects were held only by friction, causing slipping during movement.

**Solution**: Added GraspManager component that:
- Detects gripper closing on objects
- Locks object to gripper (kinematic attachment)
- Releases when gripper opens

```typescript
// src/components/simulation/GraspManager.tsx
const GRIPPER_CLOSED_THRESHOLD = 35; // Gripper value below this = grasped
const GRASP_DISTANCE = 0.04;          // 4cm detection radius
```

### Issue 3: Object Size Mismatch - FIXED

**Problem**: Default objects were too large for the SO-101 gripper.

**Solution**: Added LeRobot training-matched objects:
- 2.5cm cubes (graspable)
- 3cm stacking cubes
- 1.5cm precision lego blocks
- Pen-sized cylinders

---

## Current Implementation

### IK Solver Performance

```
Object position:     [14.4, 1.3, 15.0]cm
Jaw position:        [14.3, 1.3, 15.0]cm
IK Error:            0.09cm (sub-millimeter!)
```

### Physics System

| Component | Implementation |
|-----------|----------------|
| Collision | Rapier engine with Cuboid/Ball/Cylinder colliders |
| Gripper Jaws | Kinematic colliders, friction 2.0 |
| Objects | Dynamic bodies, friction 1.5, proper mass |
| Floor | Fixed collider at Y=0 |

### Grasp Manager

| Feature | Value |
|---------|-------|
| Close threshold | 35% gripper value |
| Open threshold | 50% gripper value |
| Detection radius | 4cm from jaw center |
| Visual feedback | Green glow when grabbed |

### Object Library

**LeRobot Training Objects:**
- LeRobot Cube (Red/Blue/Green/Yellow) - 2.5cm
- Stack Cube - 3cm
- Pink Lego Block - 1.5cm
- Target Zone (Box) - 5cm flat
- Pens (Black/Red/Blue) - 1.6cm diameter

**Scene Presets:**
- LeRobot Pick & Place
- LeRobot Stacking
- LeRobot Color Sorting
- LeRobot Table Cleanup
- LeRobot Precision

---

## Files Summary

| File | Purpose |
|------|---------|
| `SO101KinematicsURDF.ts` | FK with jaw position calculation |
| `claudeApi.ts` | IK solver targeting jaw position |
| `GraspManager.tsx` | Object attachment on grip |
| `RealisticGripperPhysics.tsx` | Jaw physics colliders |
| `PhysicsObjects.tsx` | Object physics with grab state |
| `objectLibrary.ts` | LeRobot training objects |

---

## How Grasping Works Now

1. **IK Planning**: `calculateGraspJoints()` finds joint angles to place **JAWS** at object center
2. **Approach**: Arm moves above object with gripper open
3. **Descent**: Arm lowers, jaws positioned around object
4. **Close**: Gripper closes → GraspManager detects object → attaches kinematically
5. **Lift**: Object follows gripper as arm rises
6. **Release**: Gripper opens → GraspManager releases → object returns to dynamic physics

---

## Testing

Run Playwright test:
```bash
node playwright-cylinder-test.mjs
```

Expected output:
- IK Error < 0.5cm
- Jaw Y matches object Y
- "[GraspManager] Grasped object:" in console

---

*Last updated: 2024-12-21*
*Status: All issues resolved*
