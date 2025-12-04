/**
 * Lidar Simulation Hook
 * Simulates a 2D lidar scanner using raycasting
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useAppStore } from '../stores/useAppStore';
import type { LidarReading, LidarPoint, LidarConfig } from '../types';

const DEFAULT_LIDAR_CONFIG: LidarConfig = {
  enabled: true,
  numRays: 72,          // 5-degree resolution (360/5 = 72)
  maxRange: 0.5,        // 50cm max range
  minRange: 0.02,       // 2cm min range
  scanRate: 10,         // 10 Hz
  mountHeight: 0.13,    // Mounted just above base
};

export const useLidarSimulation = (
  config: Partial<LidarConfig> = {},
  onScan?: (reading: LidarReading) => void
) => {
  const { scene } = useThree();
  const objects = useAppStore((state) => state.objects);

  const fullConfig = useMemo(
    () => ({ ...DEFAULT_LIDAR_CONFIG, ...config }),
    [config]
  );
  const raycaster = useRef(new THREE.Raycaster());
  const lastScanTime = useRef(0);

  // Get objects to scan against (exclude robot parts)
  const getScannableObjects = useCallback(() => {
    const scannables: THREE.Object3D[] = [];

    scene.traverse((object) => {
      // Include meshes that are likely environment/objects
      if (object instanceof THREE.Mesh) {
        const name = object.name.toLowerCase();
        // Exclude robot arm parts, floor, and grid
        if (
          !name.includes('arm') &&
          !name.includes('servo') &&
          !name.includes('gripper') &&
          !name.includes('bracket') &&
          !name.includes('grid') &&
          object.parent?.type !== 'GridHelper'
        ) {
          scannables.push(object);
        }
      }
    });

    return scannables;
  }, [scene]);

  // Perform a single lidar scan
  const performScan = useCallback((): LidarReading => {
    const points: LidarPoint[] = [];

    // Lidar origin at base of robot
    const origin = new THREE.Vector3(0, fullConfig.mountHeight, 0);

    // Get objects to scan
    const scannables = getScannableObjects();

    // Add environment objects from store
    const envObjects = objects.map((obj) => {
      // Create temporary meshes for physics objects
      const geometry =
        obj.type === 'ball'
          ? new THREE.SphereGeometry(obj.scale * 0.015)
          : obj.type === 'cylinder'
          ? new THREE.CylinderGeometry(obj.scale * 0.015, obj.scale * 0.015, obj.scale * 0.04)
          : new THREE.BoxGeometry(obj.scale * 0.03, obj.scale * 0.03, obj.scale * 0.03);

      const mesh = new THREE.Mesh(geometry);
      mesh.position.set(...obj.position);
      return mesh;
    });

    const allScannables = [...scannables, ...envObjects];

    // Perform raycasts for each angle
    for (let i = 0; i < fullConfig.numRays; i++) {
      const angle = (i / fullConfig.numRays) * 360;
      const angleRad = (angle * Math.PI) / 180;

      // Direction in world space (rotated by base)
      const direction = new THREE.Vector3(
        Math.sin(angleRad),
        0,
        Math.cos(angleRad)
      );

      raycaster.current.set(origin, direction);
      raycaster.current.far = fullConfig.maxRange;
      raycaster.current.near = fullConfig.minRange;

      const intersections = raycaster.current.intersectObjects(allScannables, true);

      let distance = fullConfig.maxRange;
      let hit = false;

      if (intersections.length > 0) {
        const closest = intersections[0];
        if (closest.distance >= fullConfig.minRange && closest.distance <= fullConfig.maxRange) {
          distance = closest.distance;
          hit = true;
        }
      }

      // Calculate world coordinates of the point
      const x = origin.x + direction.x * distance;
      const z = origin.z + direction.z * distance;

      points.push({
        angle,
        distance,
        hit,
        x,
        z,
      });
    }

    // Clean up temporary geometries
    envObjects.forEach((mesh) => mesh.geometry.dispose());

    return {
      points,
      timestamp: Date.now(),
      scanComplete: true,
    };
  }, [objects, fullConfig, getScannableObjects]);

  // Run scans at specified rate
  useEffect(() => {
    if (!fullConfig.enabled) return;

    const scanInterval = 1000 / fullConfig.scanRate;

    const runScan = () => {
      const now = Date.now();
      if (now - lastScanTime.current >= scanInterval) {
        const reading = performScan();
        onScan?.(reading);
        lastScanTime.current = now;
      }
    };

    const interval = setInterval(runScan, scanInterval);
    return () => clearInterval(interval);
  }, [fullConfig.enabled, fullConfig.scanRate, performScan, onScan]);

  return {
    performScan,
    config: fullConfig,
  };
};

export { DEFAULT_LIDAR_CONFIG };
