/**
 * Real-time Plot Component
 * Lightweight canvas-based plotting for time series data
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  LineChart,
  TrendingUp,
  Pause,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useDataRecorder, type RecorderMode } from '../../hooks/useDataRecorder';
import type { PlotSeries } from '../../types';

interface RealTimePlotProps {
  mode?: RecorderMode;
  height?: number;
  showLegend?: boolean;
  showControls?: boolean;
  title?: string;
}

export const RealTimePlot: React.FC<RealTimePlotProps> = ({
  mode = 'joints',
  height = 150,
  showLegend = true,
  showControls = true,
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const { series, config, toggleSeries, clearData } = useDataRecorder(
    mode,
    { enabled: !isPaused }
  );

  // Draw the chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isExpanded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const chartHeight = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, chartHeight);

    // Draw grid
    drawGrid(ctx, width, chartHeight);

    // Get visible series
    const visibleSeries = series.filter((s) => s.visible);
    if (visibleSeries.length === 0) return;

    // Calculate data range
    const { minTime, maxTime, minValue, maxValue } = calculateDataRange(
      visibleSeries,
      config.timeWindow
    );

    // Draw each series
    visibleSeries.forEach((s) => {
      drawSeries(ctx, s, width, chartHeight, minTime, maxTime, minValue, maxValue);
    });

    // Draw axis labels
    drawAxisLabels(ctx, width, chartHeight, minTime, maxTime, minValue, maxValue);
  }, [series, config.timeWindow, isExpanded]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
      }
    });

    resizeObserver.observe(canvas.parentElement!);
    return () => resizeObserver.disconnect();
  }, [height]);

  const displayTitle = title || (mode === 'joints' ? 'Joint Positions' : mode === 'sensors' ? 'Sensor Data' : 'All Data');

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-slate-800/80 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-300">{displayTitle}</span>
          {!isPaused && (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {showControls && isExpanded && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(!isPaused);
                }}
                className="p-1 hover:bg-slate-700 rounded"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? (
                  <Play className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Pause className="w-3.5 h-3.5 text-yellow-400" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearData();
                }}
                className="p-1 hover:bg-slate-700 rounded"
                title="Clear"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Chart */}
          <div className="relative" style={{ height }}>
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ height }}
            />
          </div>

          {/* Legend */}
          {showLegend && (
            <div className="flex flex-wrap gap-2 px-3 py-2 border-t border-slate-700/50">
              {series.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSeries(s.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                    s.visible
                      ? 'bg-slate-700/50 text-slate-200'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: s.visible ? s.color : '#64748b',
                    }}
                  />
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Helper functions for drawing
function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;

  // Horizontal lines
  const hLines = 5;
  for (let i = 0; i <= hLines; i++) {
    const y = (height / hLines) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Vertical lines
  const vLines = 10;
  for (let i = 0; i <= vLines; i++) {
    const x = (width / vLines) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

function calculateDataRange(
  series: PlotSeries[],
  timeWindow: number
): { minTime: number; maxTime: number; minValue: number; maxValue: number } {
  let minTime = Infinity;
  let maxTime = -Infinity;
  let minValue = Infinity;
  let maxValue = -Infinity;

  series.forEach((s) => {
    s.data.forEach((point) => {
      if (point.time < minTime) minTime = point.time;
      if (point.time > maxTime) maxTime = point.time;
      if (point.value < minValue) minValue = point.value;
      if (point.value > maxValue) maxValue = point.value;
    });
  });

  // Ensure we have a reasonable range
  if (minTime === Infinity) minTime = 0;
  if (maxTime === -Infinity) maxTime = timeWindow;
  if (minValue === Infinity) minValue = 0;
  if (maxValue === -Infinity) maxValue = 100;

  // Add some padding to value range
  const valuePadding = (maxValue - minValue) * 0.1 || 10;
  minValue -= valuePadding;
  maxValue += valuePadding;

  // Use time window for display
  if (maxTime - minTime > timeWindow) {
    minTime = maxTime - timeWindow;
  }

  return { minTime, maxTime, minValue, maxValue };
}

function drawSeries(
  ctx: CanvasRenderingContext2D,
  series: PlotSeries,
  width: number,
  height: number,
  minTime: number,
  maxTime: number,
  minValue: number,
  maxValue: number
) {
  const data = series.data.filter(
    (p) => p.time >= minTime && p.time <= maxTime
  );

  if (data.length < 2) return;

  const timeRange = maxTime - minTime || 1;
  const valueRange = maxValue - minValue || 1;

  ctx.strokeStyle = series.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  let started = false;
  data.forEach((point) => {
    const x = ((point.time - minTime) / timeRange) * width;
    const y = height - ((point.value - minValue) / valueRange) * height;

    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

function drawAxisLabels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  minTime: number,
  maxTime: number,
  minValue: number,
  maxValue: number
) {
  ctx.fillStyle = '#64748b';
  ctx.font = '10px monospace';

  // Y-axis labels
  ctx.textAlign = 'left';
  ctx.fillText(maxValue.toFixed(0), 4, 12);
  ctx.fillText(minValue.toFixed(0), 4, height - 4);

  // X-axis labels (time in seconds)
  ctx.textAlign = 'right';
  const maxTimeSec = (maxTime / 1000).toFixed(1);
  ctx.fillText(`${maxTimeSec}s`, width - 4, height - 4);
}

// Compact version for inline display
interface CompactPlotProps {
  seriesId: string;
  color?: string;
  width?: number;
  height?: number;
}

export const CompactPlot: React.FC<CompactPlotProps> = ({
  seriesId,
  color = '#3b82f6',
  width = 100,
  height = 30,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { series } = useDataRecorder('all');

  const targetSeries = series.find((s) => s.id === seriesId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !targetSeries) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, width, height);

    const data = targetSeries.data.slice(-50); // Last 50 points
    if (data.length < 2) return;

    // Find range
    let min = Infinity;
    let max = -Infinity;
    data.forEach((p) => {
      if (p.value < min) min = p.value;
      if (p.value > max) max = p.value;
    });
    const range = max - min || 1;

    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((point.value - min) / range) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }, [targetSeries, width, height, color]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="bg-slate-900/50 rounded"
    />
  );
};
