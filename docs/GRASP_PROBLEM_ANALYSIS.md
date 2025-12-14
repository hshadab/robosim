# SO-101 Robot Arm Grasp Problem Analysis

## Problem Summary

The robot arm's gripper tip reaches the correct position but **fails to grasp objects** because the gripper jaws are positioned significantly higher than the tip.

## Current Behavior (from logs)

```
Object position:     [15.2, 5.2, -0.2]cm  (Y=5.2cm = object center)
Gripper tip actual:  [15.8, 5.5, -0.1]cm  (Y=5.5cm - CORRECT!)
Grasp joints:        shoulder=-92°, elbow=71°, wrist=81°
IK Error:            0.1cm (excellent!)
```

**The IK is working correctly!** The tip reaches the target position with sub-millimeter accuracy.

## Root Cause: Jaw-to-Tip Offset

The `gripper_frame_link` in the URDF represents the gripper **TIP**, not the **JAWS**.

From URDF geometry:
- `gripper_frame_link` (tip): at local Z = -9.81cm
- `moving_jaw`: at local Z = -2.34cm
- **Jaw-to-tip offset: ~7.5cm along gripper axis**

### With Steep Wrist Angles (75-90°)

When the gripper points nearly straight down (wrist ~80°):
- Tip is at the BOTTOM (lowest Y)
- Jaws are ~7cm ABOVE the tip in world coordinates

**Example calculation:**
- Tip at Y = 5.5cm
- Jaws at Y ≈ 5.5 + 7 = **12.5cm**
- Object center at Y = 5.2cm
- **Gap: 7.3cm - jaws completely miss the object!**

## Why This Is Hard to Fix

### Option 1: Target Tip Lower
- To get jaws at Y=5cm, tip needs to be at Y = 5 - 7 = **-2cm** (below table!)
- Physically impossible - tip would be underground

### Option 2: Use Horizontal Grasps (wrist ~0-30°)
- With horizontal grip, jaws and tip at similar height
- **Problem**: IK can't find solutions to reach low positions (Y < 8cm) with horizontal grip
- The arm geometry requires steep wrist angles to reach low/close positions

### Option 3: Spawn Objects Higher
- Objects at Y=12cm would allow jaws to reach
- **Problem**: This is unrealistically high (12cm above table surface)
- Real tabletop objects are at 3-6cm

## LeRobot Training Data Insight

From [youliangtan/so101-table-cleanup](https://huggingface.co/datasets/youliangtan/so101-table-cleanup):
```
shoulder_lift: -99°  (very bent)
elbow_flex:    92-98° (very bent)
wrist_flex:    71-75° (STEEP, not horizontal!)
```

Real SO-101 training uses steep wrist angles. This suggests either:
1. Objects in training data were positioned differently
2. The real robot has different jaw geometry
3. Additional calibration was performed

## Possible Solutions to Investigate

### 1. URDF Model Verification
- Verify gripper_frame_link position matches real robot
- Check if jaw positions in URDF are accurate
- Consider adjusting URDF if there's a mismatch

### 2. Grasp Point Adjustment
- Instead of targeting object center, calculate the actual jaw position needed
- Account for wrist angle when computing grasp target:
  ```
  jaw_offset_world_y = 7.5 * sin(wrist_angle_rad)
  target_tip_y = object_y - jaw_offset_world_y
  ```

### 3. Different Grasp Strategy
- Use side grasps instead of top-down
- Approach object from the side where jaw offset is horizontal, not vertical

### 4. Hardware Calibration Data
- Find real SO-101 grasp calibration data
- Compare simulated vs real gripper dimensions

## Files Involved

- `src/lib/claudeApi.ts` - IK solver and grasp calculations
- `src/components/simulation/SO101Arm3D.tsx` - URDF model and FK
- `src/components/simulation/SO101KinematicsURDF.ts` - FK calculations
- `public/models/so101/so101.urdf` - Robot geometry definition

## Log Analysis Commands

To debug further, look for these log patterns:
```
[GRASP HEIGHT]     - Shows actual gripper position during grasp attempt
[solveIKForTarget] - Shows IK target vs achieved position
[handlePickUpCommand] - Shows grasp planning calculations
```

## Status

**Unresolved** - The fundamental geometry constraint (7cm jaw-tip offset with steep wrist angles) prevents successful grasping of tabletop objects.

---
*Last updated: 2024-12-14*
*Related issue: Robot arm pickup reliability*
