/**
 * Vision Panel
 *
 * Displays camera feed from robot and blob detection results.
 * Captures images from 3D viewport for vision processing.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Crosshair, Eye, EyeOff, Palette, RefreshCw } from 'lucide-react';
import {
  getVisionSimulator,
  detectBlobs,
  COLOR_PRESETS,
  type BlobDetection,
} from '../../lib/visionSimulation';

interface VisionPanelProps {
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const VisionPanel: React.FC<VisionPanelProps> = ({ canvasRef }) => {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>('red');
  const [blobs, setBlobs] = useState<BlobDetection[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [captureRate, setCaptureRate] = useState<number>(5); // FPS
  const [imageData, setImageData] = useState<ImageData | null>(null);

  const captureIntervalRef = useRef<number | null>(null);

  // Get the 3D canvas (passed from parent or find it)
  const getSourceCanvas = useCallback((): HTMLCanvasElement | null => {
    if (canvasRef?.current) return canvasRef.current;

    // Try to find the Three.js canvas
    const canvas = document.querySelector('canvas[data-engine]') as HTMLCanvasElement;
    return canvas;
  }, [canvasRef]);

  // Capture frame from 3D viewport
  const captureFrame = useCallback(() => {
    const sourceCanvas = getSourceCanvas();
    if (!sourceCanvas) return;

    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    const width = 320;
    const height = 240;

    // Set canvas size
    displayCanvas.width = width;
    displayCanvas.height = height;

    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    // Draw scaled version of 3D canvas
    ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, width, height);

    // Get image data for processing
    const imgData = ctx.getImageData(0, 0, width, height);
    setImageData(imgData);

    // Process with vision simulator
    const simulator = getVisionSimulator();
    simulator.processCapture(imgData);

    // Run blob detection
    const filter = COLOR_PRESETS[selectedColor] || COLOR_PRESETS['red'];
    const detectedBlobs = detectBlobs(imgData, filter, 50);
    setBlobs(detectedBlobs);

    // Draw overlay if enabled
    if (showOverlay && detectedBlobs.length > 0) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.font = '10px monospace';
      ctx.fillStyle = '#00ff00';

      for (const blob of detectedBlobs) {
        // Draw bounding box
        ctx.strokeRect(
          blob.boundingBox.x,
          blob.boundingBox.y,
          blob.boundingBox.width,
          blob.boundingBox.height
        );

        // Draw centroid
        ctx.beginPath();
        ctx.arc(blob.centroid.x, blob.centroid.y, 4, 0, Math.PI * 2);
        ctx.stroke();

        // Draw label
        ctx.fillText(
          `#${blob.id} (${Math.round(blob.area)}px)`,
          blob.boundingBox.x,
          blob.boundingBox.y - 4
        );
      }
    }

  }, [getSourceCanvas, selectedColor, showOverlay]);

  // Start/stop capture loop
  useEffect(() => {
    if (isEnabled && captureRate > 0) {
      const interval = 1000 / captureRate;
      captureIntervalRef.current = window.setInterval(captureFrame, interval);
    } else {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    }

    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [isEnabled, captureRate, captureFrame]);

  // Toggle enable
  const handleToggle = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  // Manual capture
  const handleManualCapture = useCallback(() => {
    captureFrame();
  }, [captureFrame]);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Camera className="w-4 h-4 text-purple-400" />
          Robot Vision
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualCapture}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Manual capture"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggle}
            className={`p-1 transition-colors ${isEnabled ? 'text-green-400' : 'text-slate-500'}`}
            title={isEnabled ? 'Disable vision' : 'Enable vision'}
          >
            {isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Camera Feed */}
      <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ aspectRatio: '4/3' }}>
        <canvas
          ref={displayCanvasRef}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
        {!isEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <span className="text-slate-500 text-sm">Vision disabled</span>
          </div>
        )}
        {isEnabled && (
          <div className="absolute top-2 right-2 bg-black/50 px-2 py-0.5 rounded text-xs text-green-400">
            {captureRate} FPS
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* Color Selector */}
        <div>
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Palette className="w-3 h-3" />
            Target Color
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(COLOR_PRESETS)
              .filter(([key]) => key !== 'redWrap')
              .map(([key, filter]) => (
                <button
                  key={key}
                  onClick={() => setSelectedColor(key)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedColor === key
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                  title={filter.name}
                >
                  {filter.name}
                </button>
              ))}
          </div>
        </div>

        {/* Capture Rate */}
        <div>
          <div className="text-xs text-slate-400 mb-1">Capture Rate: {captureRate} FPS</div>
          <input
            type="range"
            min="1"
            max="30"
            value={captureRate}
            onChange={(e) => setCaptureRate(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Overlay Toggle */}
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showOverlay}
            onChange={(e) => setShowOverlay(e.target.checked)}
            className="rounded bg-slate-700 border-slate-600"
          />
          <Crosshair className="w-3 h-3" />
          Show detection overlay
        </label>
      </div>

      {/* Detection Results */}
      {blobs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="text-xs text-slate-400 mb-2">
            Detected: {blobs.length} blob{blobs.length !== 1 ? 's' : ''}
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {blobs.slice(0, 5).map((blob) => (
              <div
                key={blob.id}
                className="flex items-center justify-between bg-slate-900/50 px-2 py-1 rounded text-xs"
              >
                <span className="text-slate-300">Blob #{blob.id}</span>
                <div className="flex items-center gap-2 text-slate-500">
                  <span>
                    ({Math.round(blob.centroid.x)}, {Math.round(blob.centroid.y)})
                  </span>
                  <span>{blob.area}px²</span>
                </div>
              </div>
            ))}
            {blobs.length > 5 && (
              <div className="text-xs text-slate-600 text-center">
                +{blobs.length - 5} more...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
        {imageData ? (
          <span>Image: {imageData.width}×{imageData.height}</span>
        ) : (
          <span>No image captured</span>
        )}
      </div>
    </div>
  );
};
