/**
 * Voice Control Panel
 *
 * Provides hands-free robot control using voice commands.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../common';
import {
  VoiceControlManager,
  isVoiceControlSupported,
  type VoiceControlState,
  type VoiceCommand,
  VOICE_COMMAND_PATTERNS,
} from '../../lib/voiceControl';
import { useLLMChat } from '../../hooks/useLLMChat';

// Collapsible wrapper for the panel
const CollapsiblePanel: React.FC<{
  title: string;
  icon: React.FC<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-800/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/30 transition"
      >
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-300 flex-1">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-slate-700/50">
          {children}
        </div>
      )}
    </div>
  );
};

interface VoiceControlPanelProps {
  defaultOpen?: boolean;
}

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({
  defaultOpen = false,
}) => {
  const [isSupported] = useState(isVoiceControlSupported());
  const [voiceManager] = useState(() => new VoiceControlManager());
  const [state, setState] = useState<VoiceControlState>('inactive');
  const [lastTranscript, setLastTranscript] = useState('');
  const [speakResponses, setSpeakResponses] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const { sendMessage } = useLLMChat();

  // Handle voice commands
  const handleCommand = useCallback((command: VoiceCommand) => {
    setLastTranscript(command.transcript);

    // Send to LLM chat for processing
    sendMessage(command.transcript);

    // Speak acknowledgment if enabled
    if (speakResponses) {
      voiceManager.speak('Got it');
    }
  }, [sendMessage, speakResponses, voiceManager]);

  // Set up voice control
  useEffect(() => {
    if (!isSupported) return;

    const unsubCommand = voiceManager.onCommand(handleCommand);
    const unsubState = voiceManager.onStateChange(setState);

    return () => {
      unsubCommand();
      unsubState();
      voiceManager.stop();
    };
  }, [isSupported, voiceManager, handleCommand]);

  // Update config when settings change
  useEffect(() => {
    voiceManager.configure({
      speakResponses,
      wakeWordEnabled,
    });
  }, [voiceManager, speakResponses, wakeWordEnabled]);

  const toggleListening = () => {
    if (state === 'inactive' || state === 'error') {
      voiceManager.start();
    } else {
      voiceManager.stop();
    }
  };

  const getStateColor = () => {
    switch (state) {
      case 'listening':
        return 'text-green-400';
      case 'processing':
        return 'text-yellow-400';
      case 'speaking':
        return 'text-blue-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStateText = () => {
    switch (state) {
      case 'listening':
        return wakeWordEnabled ? 'Listening for "Hey Robot"...' : 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'speaking':
        return 'Speaking...';
      case 'error':
        return 'Error - Click to retry';
      default:
        return 'Click to start';
    }
  };

  if (!isSupported) {
    return (
      <CollapsiblePanel
        title="Voice Control"
        icon={MicOff}
        defaultOpen={defaultOpen}
      >
        <div className="p-3 text-center text-slate-400 text-sm">
          <p>Voice control is not supported in this browser.</p>
          <p className="text-xs mt-1">Try Chrome or Edge.</p>
        </div>
      </CollapsiblePanel>
    );
  }

  return (
    <CollapsiblePanel
      title="Voice Control"
      icon={Mic}
      defaultOpen={defaultOpen}
    >
      <div className="p-3 space-y-4">
        {/* Main Control */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={toggleListening}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              state === 'listening'
                ? 'bg-green-500/20 ring-2 ring-green-500 animate-pulse'
                : state === 'processing'
                ? 'bg-yellow-500/20 ring-2 ring-yellow-500'
                : state === 'speaking'
                ? 'bg-blue-500/20 ring-2 ring-blue-500'
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {state === 'inactive' ? (
              <Mic className="w-8 h-8 text-slate-300" />
            ) : state === 'error' ? (
              <MicOff className="w-8 h-8 text-red-400" />
            ) : (
              <Mic className={`w-8 h-8 ${getStateColor()}`} />
            )}
          </button>

          <span className={`text-sm ${getStateColor()}`}>{getStateText()}</span>
        </div>

        {/* Last Transcript */}
        {lastTranscript && (
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Last command:</div>
            <div className="text-sm text-slate-300">"{lastTranscript}"</div>
          </div>
        )}

        {/* Quick Settings */}
        <div className="flex justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSpeakResponses(!speakResponses)}
            title={speakResponses ? 'Disable voice feedback' : 'Enable voice feedback'}
          >
            {speakResponses ? (
              <Volume2 className="w-4 h-4 text-blue-400" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <Settings className={`w-4 h-4 ${showSettings ? 'text-blue-400' : ''}`} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            title="Help"
          >
            <HelpCircle className={`w-4 h-4 ${showHelp ? 'text-blue-400' : ''}`} />
          </Button>
        </div>

        {/* Settings */}
        {showSettings && (
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
            <div className="text-xs font-semibold text-slate-400 mb-2">Settings</div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wakeWordEnabled}
                onChange={(e) => setWakeWordEnabled(e.target.checked)}
                className="rounded bg-slate-700 border-slate-600"
              />
              <span className="text-sm text-slate-300">
                Wake word ("Hey Robot")
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={speakResponses}
                onChange={(e) => setSpeakResponses(e.target.checked)}
                className="rounded bg-slate-700 border-slate-600"
              />
              <span className="text-sm text-slate-300">Voice feedback</span>
            </label>
          </div>
        )}

        {/* Help */}
        {showHelp && (
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-400 mb-2">Voice Commands</div>

            {Object.entries(VOICE_COMMAND_PATTERNS).map(([category, { patterns }]) => (
              <div key={category} className="text-xs">
                <span className="text-slate-400 capitalize">{category}:</span>
                <span className="text-slate-500 ml-1">
                  {patterns.slice(0, 4).join(', ')}
                </span>
              </div>
            ))}

            <div className="text-xs text-slate-500 mt-2">
              Speak naturally - e.g., "Move left", "Open gripper", "Wave hello"
            </div>
          </div>
        )}
      </div>
    </CollapsiblePanel>
  );
};
