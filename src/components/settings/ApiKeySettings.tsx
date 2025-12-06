import React, { useState, useEffect } from 'react';
import { X, Key, Check, AlertCircle } from 'lucide-react';
import { Button } from '../common';
import { getClaudeApiKey, setClaudeApiKey } from '../../lib/claudeApi';

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Use timeout to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        const existingKey = getClaudeApiKey();
        setHasKey(!!existingKey);
        setApiKey(existingKey || '');
        setSaved(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = () => {
    setClaudeApiKey(apiKey || null);
    setHasKey(!!apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setClaudeApiKey(null);
    setApiKey('');
    setHasKey(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">API Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Claude API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-400">
              <p className="mb-1">Your API key is stored locally in your browser and never sent to our servers.</p>
              <p>Without an API key, the chat uses demo mode with simulated responses.</p>
            </div>
          </div>

          {hasKey && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <Check className="w-4 h-4" />
              <span>API key configured</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            Clear Key
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              {saved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
