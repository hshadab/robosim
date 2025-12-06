/**
 * Save/Load Panel
 *
 * UI for saving and loading simulation state.
 * Supports named saves, auto-save, and file import/export.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  Clock,
  Bot,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import {
  saveState,
  loadState,
  deleteState,
  getSaveSlots,
  loadAutoSave,
  hasAutoSave,
  exportStateToFile,
  importStateFromFile,
  formatTimestamp,
  type SaveSlotMeta,
  type SavedState,
} from '../../lib/statePersistence';

export const SaveLoadPanel: React.FC = () => {
  const [slots, setSlots] = useState<SaveSlotMeta[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [newSaveName, setNewSaveName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewSave, setShowNewSave] = useState(false);
  const [hasAutoSaveData, setHasAutoSaveData] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current state from store
  const {
    selectedRobotId,
    activeRobotType,
    joints,
    wheeledRobot,
    drone,
    humanoid,
    currentEnvironment,
    objects,
    code,
    setSelectedRobot,
    setActiveRobotType,
    setJoints,
    setWheeledRobot,
    setDrone,
    setHumanoid,
    setEnvironment,
  } = useAppStore();

  // Refresh slots on mount
  useEffect(() => {
    setSlots(getSaveSlots());
    setHasAutoSaveData(hasAutoSave());
  }, []);

  // Clear message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Get current state for saving
  const getCurrentState = useCallback(() => {
    return {
      robotId: selectedRobotId,
      robotType: activeRobotType,
      joints,
      wheeledRobot: activeRobotType === 'wheeled' ? wheeledRobot : undefined,
      drone: activeRobotType === 'drone' ? drone : undefined,
      humanoid: activeRobotType === 'humanoid' ? humanoid : undefined,
      environment: currentEnvironment,
      objects,
      codeContent: code.source,
    };
  }, [selectedRobotId, activeRobotType, joints, wheeledRobot, drone, humanoid, currentEnvironment, objects, code.source]);

  // Apply loaded state
  const applyState = useCallback((state: SavedState) => {
    setSelectedRobot(state.robotId);
    setActiveRobotType(state.robotType);
    setJoints(state.joints);
    setEnvironment(state.environment);

    if (state.wheeledRobot) setWheeledRobot(state.wheeledRobot);
    if (state.drone) setDrone(state.drone);
    if (state.humanoid) setHumanoid(state.humanoid);
  }, [setSelectedRobot, setActiveRobotType, setJoints, setWheeledRobot, setDrone, setHumanoid, setEnvironment]);

  // Handle save
  const handleSave = useCallback(async (name: string, slotId?: string) => {
    setIsLoading(true);
    try {
      const state = getCurrentState();
      await saveState(state, name, slotId);
      setSlots(getSaveSlots());
      setMessage({ type: 'success', text: 'State saved successfully' });
      setNewSaveName('');
      setShowNewSave(false);
    } catch {
      setMessage({ type: 'error', text: 'Failed to save state' });
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentState]);

  // Handle load
  const handleLoad = useCallback(async (slotId: string) => {
    setIsLoading(true);
    try {
      const state = await loadState(slotId);
      if (state) {
        applyState(state);
        setMessage({ type: 'success', text: 'State loaded successfully' });
      } else {
        setMessage({ type: 'error', text: 'Save not found' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load state' });
    } finally {
      setIsLoading(false);
    }
  }, [applyState]);

  // Handle delete
  const handleDelete = useCallback(async (slotId: string) => {
    setIsLoading(true);
    try {
      await deleteState(slotId);
      setSlots(getSaveSlots());
      if (selectedSlot === slotId) setSelectedSlot(null);
      setMessage({ type: 'success', text: 'Save deleted' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete save' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedSlot]);

  // Handle load auto-save
  const handleLoadAutoSave = useCallback(() => {
    const autoSaveData = loadAutoSave();
    if (autoSaveData) {
      applyState(autoSaveData);
      setMessage({ type: 'success', text: 'Auto-save loaded' });
    } else {
      setMessage({ type: 'error', text: 'No auto-save found' });
    }
  }, [applyState]);

  // Handle export
  const handleExport = useCallback(async (slotId: string) => {
    const state = await loadState(slotId);
    if (state) {
      exportStateToFile(state);
      setMessage({ type: 'success', text: 'Export started' });
    }
  }, []);

  // Handle import
  const handleImport = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const state = await importStateFromFile(file);
      await saveState(state, state.name, state.id);
      setSlots(getSaveSlots());
      setMessage({ type: 'success', text: 'Save imported successfully' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to import save file' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get robot type icon
  const getRobotTypeLabel = (type: string) => {
    switch (type) {
      case 'arm': return 'Arm';
      case 'wheeled': return 'Wheeled';
      case 'drone': return 'Drone';
      case 'humanoid': return 'Humanoid';
      default: return type;
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Save className="w-4 h-4 text-blue-400" />
          Save / Load
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Import save file"
          >
            <Upload className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
            className="hidden"
          />
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded mb-3 ${
          message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-3 h-3" />
          ) : (
            <AlertCircle className="w-3 h-3" />
          )}
          {message.text}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setShowNewSave(true)}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          New Save
        </button>
        {hasAutoSaveData && (
          <button
            onClick={handleLoadAutoSave}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Load Auto-Save
          </button>
        )}
      </div>

      {/* New Save Input */}
      {showNewSave && (
        <div className="mb-3 p-2 bg-slate-900/50 rounded-lg">
          <input
            type="text"
            value={newSaveName}
            onChange={(e) => setNewSaveName(e.target.value)}
            placeholder="Save name..."
            className="w-full bg-slate-800 text-white text-sm px-3 py-1.5 rounded border border-slate-600 focus:border-blue-500 focus:outline-none mb-2"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleSave(newSaveName || `Save ${slots.length + 1}`)}
              disabled={isLoading}
              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowNewSave(false);
                setNewSaveName('');
              }}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Save Slots */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {slots.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-xs">
            No saves yet. Create your first save!
          </div>
        ) : (
          slots.map((slot) => (
            <div
              key={slot.id}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                selectedSlot === slot.id
                  ? 'bg-slate-700/50 border-blue-500/50'
                  : 'bg-slate-900/30 border-slate-700/30 hover:border-slate-600'
              }`}
              onClick={() => setSelectedSlot(selectedSlot === slot.id ? null : slot.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{slot.name}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Bot className="w-3 h-3" />
                      {getRobotTypeLabel(slot.robotType)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(slot.timestamp)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions (shown when selected) */}
              {selectedSlot === slot.id && (
                <div className="flex gap-1 mt-2 pt-2 border-t border-slate-700/50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoad(slot.id);
                    }}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs rounded disabled:opacity-50"
                  >
                    <FolderOpen className="w-3 h-3" />
                    Load
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSave(slot.name, slot.id);
                    }}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    Overwrite
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(slot.id);
                    }}
                    className="p-1 bg-slate-700/50 hover:bg-slate-700 text-slate-400 rounded"
                    title="Export"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(slot.id);
                    }}
                    disabled={isLoading}
                    className="p-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
        {slots.length} / 10 save slots used
      </div>
    </div>
  );
};
