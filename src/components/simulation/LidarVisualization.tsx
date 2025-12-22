/**
 * Lidar Visualization Components
 * 3D rays in scene + 2D minimap overlay
 */

import React, { useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useLidarSimulation, DEFAULT_LIDAR_CONFIG } from '../../hooks/useLidarSimulation';
import type { LidarReading, LidarConfig, LidarPoint } from '../../types';

interface LidarVisualization3DProps {
  config?: Partial<LidarConfig>;
  showRays?: boolean;
  showPoints?: boolean;
  rayColor?: string;
  hitColor?: string;
  pointSize?: number;
}

// 3D Visualization in the scene
export const LidarVisualization3D: React.FC<LidarVisualization3DProps> = ({
  config = {},
  showRays = true,
  showPoints = true,
  rayColor = '#00ff00',
  hitColor = '#ff0000',
  pointSize = 0.008,
}) => {
  const [lidarData, setLidarData] = useState<LidarReading | null>(null);

  const fullConfig = { ...DEFAULT_LIDAR_CONFIG, ...config };

  const handleScan = useCallback((reading: LidarReading) => {
    setLidarData(reading);
  }, []);

  useLidarSimulation(config, handleScan);

  // Generate ray lines
  const rayLines = useMemo(() => {
    if (!lidarData || !showRays) return [];

    return lidarData.points
      .filter((_, i) => i % 3 === 0) // Only show every 3rd ray for performance
      .map((point, i) => {
        const origin = new THREE.Vector3(0, fullConfig.mountHeight, 0);
        const end = new THREE.Vector3(point.x, fullConfig.mountHeight, point.z);

        return {
          key: i,
          points: [origin, end] as [THREE.Vector3, THREE.Vector3],
          color: point.hit ? hitColor : rayColor,
          opacity: point.hit ? 0.8 : 0.3,
        };
      });
  }, [lidarData, showRays, fullConfig.mountHeight, rayColor, hitColor]);

  // Generate hit points
  const hitPoints = useMemo(() => {
    if (!lidarData || !showPoints) return [];

    return lidarData.points
      .filter((point) => point.hit)
      .map((point) => ({
        position: [point.x, fullConfig.mountHeight, point.z] as [number, number, number],
      }));
  }, [lidarData, showPoints, fullConfig.mountHeight]);

  if (!lidarData) return null;

  return (
    <group>
      {/* Rays */}
      {rayLines.map((ray) => (
        <Line
          key={ray.key}
          points={ray.points}
          color={ray.color}
          lineWidth={1}
          transparent
          opacity={ray.opacity}
        />
      ))}

      {/* Hit points */}
      {hitPoints.map((point, i) => (
        <mesh key={i} position={point.position}>
          <sphereGeometry args={[pointSize, 8, 8]} />
          <meshBasicMaterial color={hitColor} />
        </mesh>
      ))}

      {/* Lidar origin indicator */}
      <mesh position={[0, fullConfig.mountHeight, 0]}>
        <ringGeometry args={[0.01, 0.015, 32]} />
        <meshBasicMaterial color="#00ff00" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// 2D Minimap overlay component (for use outside Canvas)
interface LidarMinimapProps {
  lidarData: LidarReading | null;
  size?: number;
  maxRange?: number;
  backgroundColor?: string;
  pointColor?: string;
  gridColor?: string;
}

export const LidarMinimap: React.FC<LidarMinimapProps> = ({
  lidarData,
  size = 150,
  maxRange = 0.5,
  backgroundColor = 'rgba(15, 23, 42, 0.9)',
  pointColor = '#00ff00',
  gridColor = 'rgba(71, 85, 105, 0.5)',
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !lidarData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;
    const scale = (size / 2) / maxRange;

    // Clear
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);

    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Concentric circles
    for (let r = 0.1; r <= maxRange; r += 0.1) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(size, centerY);
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, size);
    ctx.stroke();

    // Draw lidar points
    ctx.fillStyle = pointColor;
    lidarData.points.forEach((point) => {
      if (point.hit) {
        // Convert to canvas coordinates
        const x = centerX + point.x * scale;
        const y = centerY - point.z * scale; // Flip Z for top-down view

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw robot position
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw robot direction indicator
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY - 10);
    ctx.stroke();
  }, [lidarData, size, maxRange, backgroundColor, pointColor, gridColor]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-lg border border-slate-700"
      />
      <div className="absolute bottom-1 left-1 text-[10px] text-slate-500">
        {maxRange * 100}cm
      </div>
    </div>
  );
};

// Combined Lidar Panel with controls
interface LidarPanelProps {
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
}

export const LidarPanel: React.FC<LidarPanelProps> = ({
  enabled = true,
  onToggle,
}) => {
  const [lidarData, setLidarData] = useState<LidarReading | null>(null);
  const [showPanel, setShowPanel] = useState(true);

  // These are used below but not currently connected to the Canvas context
  void setLidarData;
  void onToggle;

  // This would need to be called from within the Canvas context
  // For now, we'll pass data through props or context

  return (
    <div className="bg-slate-800/90 rounded-lg border border-slate-700 overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer"
        onClick={() => setShowPanel(!showPanel)}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              enabled ? 'bg-green-500 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span className="text-sm font-medium text-slate-300">Lidar</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(!enabled);
          }}
          className={`text-xs px-2 py-0.5 rounded ${
            enabled
              ? 'bg-green-500/20 text-green-400'
              : 'bg-slate-600 text-slate-400'
          }`}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {showPanel && enabled && (
        <div className="p-2 border-t border-slate-700">
          <LidarMinimap lidarData={lidarData} size={140} />
          <div className="mt-2 text-xs text-slate-500">
            {lidarData
              ? `${lidarData.points.filter((p: LidarPoint) => p.hit).length} hits`
              : 'No data'}
          </div>
        </div>
      )}
    </div>
  );
};

// Context-aware wrapper that can be used inside Canvas
interface LidarContextProviderProps {
  children: React.ReactNode;
  config?: Partial<LidarConfig>;
  onDataUpdate?: (data: LidarReading) => void;
}

export const LidarScanner: React.FC<LidarContextProviderProps> = ({
  children,
  config,
  onDataUpdate,
}) => {
  const handleScan = useCallback(
    (reading: LidarReading) => {
      onDataUpdate?.(reading);
    },
    [onDataUpdate]
  );

  useLidarSimulation(config, handleScan);

  return <>{children}</>;
};
