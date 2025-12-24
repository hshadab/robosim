/**
 * Object Library Panel
 *
 * Browse and add objects from the library to the scene.
 */

import React, { useState } from 'react';
import { Box, Layers, Plus, Trash2 } from 'lucide-react';
import {
  PRIMITIVE_OBJECTS,
  SCENE_PRESETS,
  OBJECT_CATEGORIES,
  createSimObjectFromTemplate,
  createSceneFromPreset,
  type ObjectTemplate,
} from '../../lib/objectLibrary';
import { useAppStore } from '../../stores/useAppStore';
import type { SimObject } from '../../types';
import { loggers } from '../../lib/logger';

const log = loggers.objects;

export const ObjectLibraryPanel: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('lerobot');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const { objects, spawnObject, removeObject, clearObjects } = useAppStore();

  const filteredObjects = PRIMITIVE_OBJECTS.filter(
    obj => obj.category === selectedCategory
  );

  const handleAddObject = (template: ObjectTemplate) => {
    // Random position in front of robot - optimal workspace zone
    // Use polar coordinates: distance 16-22cm, angle 30° to 60° from +X axis
    const distance = 0.16 + Math.random() * 0.06; // 16-22cm from base
    const angle = (Math.PI / 6) + Math.random() * (Math.PI / 6); // 30° to 60° from +X axis

    const x = Math.max(0.12, distance * Math.cos(angle)); // Ensure minimum X (12cm+)
    const z = Math.max(0.15, distance * Math.sin(angle)); // Ensure positive Z (15cm+)

    // Use the template's actual scale - Easy Grasp objects are already sized correctly
    const scale = template.scale;
    // Spawn objects ON the table (Y=0) - object center at half height
    // Cylinders are tall (height = 6*scale), cubes/balls use scale directly
    const y = template.type === 'cylinder' ? scale * 3 : scale / 2;

    const newObject = createSimObjectFromTemplate(template, [x, y, z]);
    // Remove the 'id' since spawnObject will generate one
    const { id, ...objWithoutId } = newObject;
    log.debug('Spawning object:', { name: template.name, scale, position: [x, y, z] });
    spawnObject({ ...objWithoutId, scale });
  };

  const handleLoadPreset = (presetId: string) => {
    // Clear existing objects first
    clearObjects();
    // Add all objects from preset
    const presetObjects = createSceneFromPreset(presetId);
    presetObjects.forEach(obj => {
      const { id, ...objWithoutId } = obj;
      spawnObject(objWithoutId);
    });
    setSelectedPreset(presetId);
  };

  const handleClearScene = () => {
    clearObjects();
    setSelectedPreset('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-slate-200">Object Library</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">{objects.length} objects</span>
          {objects.length > 0 && (
            <button
              onClick={handleClearScene}
              className="p-1 text-slate-400 hover:text-red-400 transition"
              title="Clear all objects"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scene Presets */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-400">Scene Presets</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {SCENE_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleLoadPreset(preset.id)}
              className={`text-left p-2 rounded-lg text-xs transition ${
                selectedPreset === preset.id
                  ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                  : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:border-slate-600/50'
              }`}
            >
              <div className="font-medium truncate">{preset.name}</div>
              <div className="text-slate-500 truncate">{preset.objects.length} objects</div>
            </button>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-slate-400">Add Individual Objects</span>
        <div className="flex flex-wrap gap-1">
          {OBJECT_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-1 rounded text-xs transition ${
                selectedCategory === cat.id
                  ? 'bg-purple-500/30 text-purple-300'
                  : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Object List */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {filteredObjects.map(template => (
          <button
            key={template.id}
            onClick={() => handleAddObject(template)}
            className="w-full flex items-center gap-3 p-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 hover:border-slate-600/50 transition group"
          >
            {/* Color preview */}
            <div
              className="w-6 h-6 rounded flex-shrink-0"
              style={{
                backgroundColor: template.color,
                borderRadius: template.type === 'ball' ? '50%' : template.type === 'cylinder' ? '20%' : '4px',
              }}
            />
            {/* Info */}
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate">
                {template.name}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {template.description}
              </div>
            </div>
            {/* Add button */}
            <Plus className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Current Objects */}
      {objects.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-700/50">
          <span className="text-xs font-medium text-slate-400">In Scene</span>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {objects.map((obj: SimObject, idx: number) => (
              <div
                key={obj.id}
                className="flex items-center gap-2 p-1.5 rounded bg-slate-800/30 text-xs"
              >
                <div
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{
                    backgroundColor: obj.color,
                    borderRadius: obj.type === 'ball' ? '50%' : '2px',
                  }}
                />
                <span className="flex-1 text-slate-300 truncate">
                  {obj.name || obj.type} #{idx + 1}
                </span>
                <button
                  onClick={() => removeObject(obj.id)}
                  className="p-0.5 text-slate-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
        <p>💡 Use presets for common manipulation tasks</p>
        <p>💡 Objects have physics - gripper can grab them</p>
      </div>
    </div>
  );
};
