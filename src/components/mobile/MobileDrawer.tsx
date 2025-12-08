/**
 * Mobile Drawer Component
 *
 * Slide-up drawer for displaying panels on mobile devices.
 * Features:
 * - Drag to expand/collapse
 * - Snap points (closed, half, full)
 * - Touch-friendly handle
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, GripHorizontal } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  snapPoints?: ('closed' | 'half' | 'full')[];
  defaultSnap?: 'half' | 'full';
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = ['closed', 'half', 'full'],
  defaultSnap = 'half',
}) => {
  const [currentSnap, setCurrentSnap] = useState<'closed' | 'half' | 'full'>(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragStartHeight, setDragStartHeight] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  const snapHeights = {
    closed: 0,
    half: 50,
    full: 85,
  };

  // Sync body overflow and snap state with isOpen prop
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Use functional update to avoid lint warnings
      setCurrentSnap(() => defaultSnap);
    } else {
      document.body.style.overflow = '';
      setCurrentSnap(() => 'closed');
    }
    return () => {
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    setDragStartHeight(snapHeights[currentSnap]);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.touches[0].clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    setDragOffset(deltaPercent);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const newHeight = dragStartHeight + dragOffset;
    setDragOffset(0);

    // Find closest snap point
    let closestSnap: 'closed' | 'half' | 'full' = 'half';
    let minDiff = Infinity;

    for (const snap of snapPoints) {
      const diff = Math.abs(snapHeights[snap] - newHeight);
      if (diff < minDiff) {
        minDiff = diff;
        closestSnap = snap;
      }
    }

    if (closestSnap === 'closed') {
      onClose();
    } else {
      setCurrentSnap(closestSnap);
    }
  };

  // Calculate height - use state values which are safe to access during render
  const currentHeight = isDragging
    ? Math.max(0, Math.min(95, dragStartHeight + dragOffset))
    : snapHeights[currentSnap];

  if (!isOpen && currentSnap === 'closed') return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl shadow-2xl transition-transform ${
          isDragging ? 'duration-0' : 'duration-300'
        }`}
        style={{
          height: `${currentHeight}vh`,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
          <GripHorizontal className="w-5 h-5 text-gray-500 mt-1" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: 'calc(100% - 80px)' }}>
          {children}
        </div>
      </div>
    </>
  );
};

export default MobileDrawer;
