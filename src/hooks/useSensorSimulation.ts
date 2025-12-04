/**
 * Sensor Simulation Hook
 * Simulates realistic sensor values based on robot state and environment
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { SensorReading, JointState, Vector3D, IMUReading, TouchSensors } from '../types';

// Calculate gripper position using forward kinematics
const calculateGripperPosition = (joints: JointState): Vector3D => {
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;

  // Segment lengths (meters)
  const baseHeight = 0.12;
  const upperArm = 0.1;
  const forearm = 0.088;
  const wrist = 0.045;
  const gripper = 0.05;

  // Calculate cumulative angles
  const angle1 = shoulderRad;
  const angle2 = angle1 + elbowRad;
  const angle3 = angle2 + wristRad;

  // Forward kinematics
  let x = 0;
  let y = baseHeight;
  let z = 0;

  // Upper arm
  x += upperArm * Math.sin(angle1) * Math.cos(-baseRad);
  y += upperArm * Math.cos(angle1);
  z += upperArm * Math.sin(angle1) * Math.sin(-baseRad);

  // Forearm
  x += forearm * Math.sin(angle2) * Math.cos(-baseRad);
  y += forearm * Math.cos(angle2);
  z += forearm * Math.sin(angle2) * Math.sin(-baseRad);

  // Wrist + gripper
  x += (wrist + gripper) * Math.sin(angle3) * Math.cos(-baseRad);
  y += (wrist + gripper) * Math.cos(angle3);
  z += (wrist + gripper) * Math.sin(angle3) * Math.sin(-baseRad);

  return { x, y, z };
};

// Calculate IMU orientation from joint angles
const calculateIMU = (joints: JointState): IMUReading => {
  // Simplified IMU - reports arm end effector orientation
  const pitch = joints.shoulder + joints.elbow + joints.wrist;
  const yaw = joints.base;
  const roll = 0; // Arm doesn't have roll capability

  return {
    roll: roll,
    pitch: Math.max(-180, Math.min(180, pitch)),
    yaw: Math.max(-180, Math.min(180, yaw)),
  };
};

// Calculate accelerometer values (simplified - based on movement)
const calculateAccelerometer = (
  currentPos: Vector3D,
  prevPos: Vector3D,
  prevVelocity: Vector3D,
  deltaTime: number
): { acceleration: Vector3D; velocity: Vector3D } => {
  // Calculate velocity
  const velocity: Vector3D = {
    x: (currentPos.x - prevPos.x) / deltaTime,
    y: (currentPos.y - prevPos.y) / deltaTime,
    z: (currentPos.z - prevPos.z) / deltaTime,
  };

  // Calculate acceleration
  const acceleration: Vector3D = {
    x: (velocity.x - prevVelocity.x) / deltaTime,
    y: (velocity.y - prevVelocity.y) / deltaTime + 9.81, // Add gravity
    z: (velocity.z - prevVelocity.z) / deltaTime,
  };

  return { acceleration, velocity };
};

// Calculate gyroscope values (angular velocity)
const calculateGyroscope = (
  currentIMU: IMUReading,
  prevIMU: IMUReading,
  deltaTime: number
): Vector3D => {
  return {
    x: (currentIMU.roll - prevIMU.roll) / deltaTime,
    y: (currentIMU.yaw - prevIMU.yaw) / deltaTime,
    z: (currentIMU.pitch - prevIMU.pitch) / deltaTime,
  };
};

// Simulate touch sensors based on gripper state and objects
const calculateTouchSensors = (
  gripperPercent: number,
  objects: { isGrabbed: boolean }[]
): TouchSensors => {
  const hasGrabbedObject = objects.some(obj => obj.isGrabbed);
  const gripperClosed = gripperPercent < 30;

  return {
    gripperLeft: hasGrabbedObject && gripperClosed,
    gripperRight: hasGrabbedObject && gripperClosed,
    base: false, // Would need collision detection for this
  };
};

// Simulate temperature based on motor activity
const calculateTemperature = (
  joints: JointState,
  prevJoints: JointState,
  prevTemp: number
): number => {
  // Calculate total joint movement
  const movement =
    Math.abs(joints.base - prevJoints.base) +
    Math.abs(joints.shoulder - prevJoints.shoulder) +
    Math.abs(joints.elbow - prevJoints.elbow) +
    Math.abs(joints.wrist - prevJoints.wrist) +
    Math.abs(joints.gripper - prevJoints.gripper);

  // Temperature rises with movement, cools down when idle
  const heatGain = movement * 0.02;
  const heatLoss = (prevTemp - 25) * 0.01; // Cool towards ambient 25°C

  const newTemp = prevTemp + heatGain - heatLoss;
  return Math.max(25, Math.min(80, newTemp)); // Clamp between 25-80°C
};

// Simulate ultrasonic distance
const calculateUltrasonic = (
  gripperPos: Vector3D,
  objects: { position: [number, number, number] }[]
): number => {
  // Simple distance calculation to nearest object
  let minDistance = 100; // max range in cm

  for (const obj of objects) {
    const dx = gripperPos.x - obj.position[0];
    const dy = gripperPos.y - obj.position[1];
    const dz = gripperPos.z - obj.position[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) * 100; // Convert to cm

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  // Add some noise
  const noise = (Math.random() - 0.5) * 0.5;
  return Math.max(2, Math.min(100, minDistance + noise));
};

// Simulate IR sensors (detect objects below threshold)
const calculateIRSensors = (
  gripperPos: Vector3D,
  baseYaw: number,
  objects: { position: [number, number, number] }[]
): { left: boolean; center: boolean; right: boolean } => {
  const threshold = 0.1; // 10cm detection range
  const yawRad = (baseYaw * Math.PI) / 180;

  // IR sensor offsets (relative to gripper)
  const leftOffset = { x: -0.03, z: 0 };
  const rightOffset = { x: 0.03, z: 0 };

  // Rotate offsets by base yaw
  const rotatePoint = (offset: { x: number; z: number }) => ({
    x: offset.x * Math.cos(yawRad) - offset.z * Math.sin(yawRad),
    z: offset.x * Math.sin(yawRad) + offset.z * Math.cos(yawRad),
  });

  const leftPos = rotatePoint(leftOffset);
  const rightPos = rotatePoint(rightOffset);

  const checkDetection = (sensorX: number, sensorZ: number): boolean => {
    for (const obj of objects) {
      const dx = gripperPos.x + sensorX - obj.position[0];
      const dz = gripperPos.z + sensorZ - obj.position[2];
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance < threshold) return true;
    }
    return false;
  };

  return {
    left: checkDetection(leftPos.x, leftPos.z),
    center: checkDetection(0, 0),
    right: checkDetection(rightPos.x, rightPos.z),
  };
};

export const useSensorSimulation = (updateInterval: number = 50) => {
  const joints = useAppStore(state => state.joints);
  const objects = useAppStore(state => state.objects);
  const setSensors = useAppStore(state => state.setSensors);

  // Previous state for derivative calculations
  const prevState = useRef({
    joints: { ...joints },
    position: calculateGripperPosition(joints),
    velocity: { x: 0, y: 0, z: 0 } as Vector3D,
    imu: calculateIMU(joints),
    temperature: 25,
    lastUpdate: 0,
  });

  const updateSensors = useCallback(() => {
    const now = performance.now();
    const deltaTime = Math.max(0.001, (now - prevState.current.lastUpdate) / 1000);

    // Calculate current state
    const currentPosition = calculateGripperPosition(joints);
    const currentIMU = calculateIMU(joints);

    // Calculate derived sensor values
    const { acceleration, velocity } = calculateAccelerometer(
      currentPosition,
      prevState.current.position,
      prevState.current.velocity,
      deltaTime
    );

    const gyroscope = calculateGyroscope(
      currentIMU,
      prevState.current.imu,
      deltaTime
    );

    const touchSensors = calculateTouchSensors(joints.gripper, objects);
    const temperature = calculateTemperature(
      joints,
      prevState.current.joints,
      prevState.current.temperature
    );

    const ultrasonic = calculateUltrasonic(currentPosition, objects);
    const irSensors = calculateIRSensors(currentPosition, joints.base, objects);

    // Build sensor reading
    const sensors: SensorReading = {
      // Distance sensors
      ultrasonic: Math.round(ultrasonic * 10) / 10,
      leftIR: irSensors.left,
      centerIR: irSensors.center,
      rightIR: irSensors.right,

      // Power (simulated)
      battery: 85 + Math.random() * 5,

      // Extended sensors
      gps: {
        x: Math.round(currentPosition.x * 1000) / 1000,
        y: Math.round(currentPosition.y * 1000) / 1000,
        z: Math.round(currentPosition.z * 1000) / 1000,
      },
      accelerometer: {
        x: Math.round(acceleration.x * 100) / 100,
        y: Math.round(acceleration.y * 100) / 100,
        z: Math.round(acceleration.z * 100) / 100,
      },
      gyroscope: {
        x: Math.round(gyroscope.x * 10) / 10,
        y: Math.round(gyroscope.y * 10) / 10,
        z: Math.round(gyroscope.z * 10) / 10,
      },
      imu: {
        roll: Math.round(currentIMU.roll * 10) / 10,
        pitch: Math.round(currentIMU.pitch * 10) / 10,
        yaw: Math.round(currentIMU.yaw * 10) / 10,
      },
      touchSensors,
      temperature: Math.round(temperature * 10) / 10,
    };

    setSensors(sensors);

    // Update previous state
    prevState.current = {
      joints: { ...joints },
      position: currentPosition,
      velocity,
      imu: currentIMU,
      temperature,
      lastUpdate: now,
    };
  }, [joints, objects, setSensors]);

  // Run simulation at specified interval
  useEffect(() => {
    prevState.current.lastUpdate = performance.now();
    updateSensors();
    const interval = setInterval(updateSensors, updateInterval);
    return () => clearInterval(interval);
  }, [updateSensors, updateInterval]);

  return null;
};
