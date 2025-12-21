# SO-101 Robot Arm Grasp Problem Analysis

## Problem Summary

The robot arm's gripper tip reaches the correct position but **fails to grasp objects** because the gripper jaws are positioned significantly higher than the tip.

## Root Cause: Jaw-to-Tip Offset

The `gripper_frame_link` in the URDF represents the gripper **TIP**, not the **JAWS**.

From URDF geometry:
- `gripper_frame_link` (tip): at local Z = -9.81cm
- `moving_jaw`: at local Z = -2.34cm
- **Jaw-to-tip offset: ~7.3cm along gripper axis**

## SOLUTION IMPLEMENTED (December 2024)

### Fix 1: FK Model Updated to Target Jaw Position

The IK solver now targets the **JAW position** instead of the tip position.

**File:** `src/components/simulation/SO101KinematicsURDF.ts`

```typescript
// Jaw offset from gripper_frame (tip) - jaws are ~7.3cm behind tip
const JAW_OFFSET_FROM_TIP = 0.073; // meters

export function calculateJawPositionURDF(joints: JointAngles): Vec3 {
  return calculateGripperPositionURDF(joints, true); // useJawPosition=true
}
```

**File:** `src/lib/claudeApi.ts`

```typescript
function calculateGripperPos(joints: JointAngles): [number, number, number] {
  // Use JAW position for IK - this is where the object will be grasped
  return calculateJawPositionURDF(joints);
}
```

### Fix 2: Grasp Attachment System

Added a GraspManager that reliably attaches objects when gripped.

**File:** `src/components/simulation/GraspManager.tsx`

Features:
- Detects when gripper closes below threshold (35%)
- Finds objects within 4cm of jaw position
- Attaches object to gripper (kinematic lock)
- Object follows gripper during movement
- Releases when gripper opens above threshold (50%)
- Visual feedback: grabbed objects glow green

### Fix 3: LeRobot Training Objects

Added objects matching the SO-101 training data sizes.

**File:** `src/lib/objectLibrary.ts`

| Object | Size | Purpose |
|--------|------|---------|
| LeRobot Cube | 2.5cm | Pick and place (svla_so101_pickplace) |
| Stack Cube | 3cm | Stacking tasks (svla_so100_stacking) |
| Pink Lego | 1.5cm | Precision grasping |
| Pens | ~1.6cm dia | Table cleanup |
| Target Zone | 5cm | Placement target |

## Current IK Performance

After fixes:
```
Object position:     [14.4, 1.3, 15.0]cm
Jaw position:        [14.3, 1.3, 15.0]cm
IK Error:            0.09cm (excellent!)
```

The jaw now reaches the **exact object center height**.

## Scene Presets

**File:** `src/lib/objectLibrary.ts`

- **LeRobot Pick & Place** - Single cube + target zone
- **LeRobot Stacking** - Two cubes for stacking
- **LeRobot Color Sorting** - Multiple colored cubes
- **LeRobot Table Cleanup** - Pens on table
- **LeRobot Precision** - Small lego blocks

## Physics System

### Collision Detection
- Rapier physics engine with CuboidCollider, BallCollider, CylinderCollider
- Floor collider at Y=0

### Gripper Physics
**File:** `src/components/simulation/RealisticGripperPhysics.tsx`
- Two kinematic jaw colliders that follow joint angles
- High friction (2.0) for grip contact
- Tapered jaw shape matching real SO-101

### Object Physics
**File:** `src/components/simulation/PhysicsObjects.tsx`
- Objects have proper mass (0.3-0.5 kg)
- Friction coefficient 1.5 for grippability
- Switch to kinematic when grabbed, dynamic when released

## Files Summary

| File | Purpose |
|------|---------|
| `SO101KinematicsURDF.ts` | FK model with jaw position calculation |
| `claudeApi.ts` | IK solver using jaw position |
| `GraspManager.tsx` | Object attachment on grip |
| `RealisticGripperPhysics.tsx` | Jaw colliders |
| `PhysicsObjects.tsx` | Object physics with grab state |
| `objectLibrary.ts` | LeRobot training objects |

## Status

**RESOLVED** - The grasp system now:
1. Correctly positions jaws at object center
2. Reliably attaches objects when gripped
3. Uses training-matched object sizes

---
*Last updated: 2024-12-21*
*Solution: Jaw position targeting + Grasp attachment system*
