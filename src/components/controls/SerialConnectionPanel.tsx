/**
 * Serial Connection Panel
 *
 * UI for connecting to real robot hardware via Web Serial API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Usb,
  Power,
  PowerOff,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Send,
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import {
  serialConnection,
  isSerialSupported,
  DEFAULT_SERIAL_CONFIG,
  generateServoCommand,
  type ConnectionState,
  type SerialConfig,
} from '../../lib/serialConnection';

export const SerialConnectionPanel: React.FC = () => {
  const { joints, activeRobotType } = useAppStore();

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncRate, setSyncRate] = useState(30); // Hz

  // Serial config state
  const [baudRate, setBaudRate] = useState(DEFAULT_SERIAL_CONFIG.baudRate);

  // Check if serial is supported
  const serialSupported = isSerialSupported();

  // Set up callbacks
  useEffect(() => {
    serialConnection.setCallbacks({
      onConnect: () => {
        setConnectionState('connected');
        setError(null);
      },
      onDisconnect: () => {
        setConnectionState('disconnected');
        setAutoSync(false);
      },
      onError: (err) => {
        setError(err.message);
        setConnectionState('error');
      },
      onJointFeedback: () => {
        // Could update UI with feedback here
      },
    });
  }, []);

  // Auto-sync joints to hardware
  useEffect(() => {
    if (!autoSync || connectionState !== 'connected') return;

    const sendJoints = async () => {
      const currentJoints = useAppStore.getState().joints;
      const command = generateServoCommand(currentJoints);
      await serialConnection.sendRaw(command);
      setLastSyncTime(Date.now());
    };

    const interval = setInterval(sendJoints, 1000 / syncRate);

    return () => clearInterval(interval);
  }, [autoSync, connectionState, syncRate]);

  const handleConnect = useCallback(async () => {
    setConnectionState('connecting');
    setError(null);

    const config: SerialConfig = {
      ...DEFAULT_SERIAL_CONFIG,
      baudRate,
    };

    const success = await serialConnection.connect(config);
    if (!success) {
      setConnectionState('error');
    }
  }, [baudRate]);

  const handleDisconnect = useCallback(async () => {
    await serialConnection.disconnect();
    setAutoSync(false);
  }, []);

  const handleSendOnce = useCallback(async () => {
    const command = generateServoCommand(joints);
    const success = await serialConnection.sendRaw(command);
    if (success) {
      setLastSyncTime(Date.now());
    }
  }, [joints]);

  // Only show for arm robot
  if (activeRobotType !== 'arm') return null;

  // Not supported browser message
  if (!serialSupported) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 text-yellow-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Web Serial not supported</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Use Chrome, Edge, or Opera to connect to hardware.
        </p>
      </div>
    );
  }

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'text-green-400';
      case 'connecting':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusIcon = () => {
    switch (connectionState) {
      case 'connected':
        return <Check className="w-3 h-3" />;
      case 'connecting':
        return <RefreshCw className="w-3 h-3 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <PowerOff className="w-3 h-3" />;
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Usb className="w-4 h-4 text-blue-400" />
          Hardware Connection
        </h3>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs ${getStatusColor()}`}>
            {getStatusIcon()}
            {connectionState}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick connect button */}
      {!expanded && (
        <div className="flex gap-2">
          {connectionState !== 'connected' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleConnect}
              disabled={connectionState === 'connecting'}
              className="flex-1"
            >
              <Power className="w-3 h-3 mr-1" />
              Connect
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendOnce}
                className="flex-1"
              >
                <Send className="w-3 h-3 mr-1" />
                Send
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDisconnect}
              >
                <PowerOff className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="space-y-3">
          {/* Connection controls */}
          <div className="flex gap-2">
            {connectionState !== 'connected' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnect}
                disabled={connectionState === 'connecting'}
                className="flex-1"
              >
                <Power className="w-3 h-3 mr-1" />
                {connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDisconnect}
                className="flex-1"
              >
                <PowerOff className="w-3 h-3 mr-1" />
                Disconnect
              </Button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-slate-400 hover:text-white transition-colors bg-slate-700/50 rounded-lg"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Settings */}
          {showSettings && (
            <div className="p-3 bg-slate-900/50 rounded-lg space-y-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Baud Rate</label>
                <select
                  value={baudRate}
                  onChange={(e) => setBaudRate(parseInt(e.target.value))}
                  className="w-full bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600"
                  disabled={connectionState === 'connected'}
                >
                  <option value={9600}>9600</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={57600}>57600</option>
                  <option value={115200}>115200</option>
                  <option value={250000}>250000</option>
                  <option value={500000}>500000</option>
                  <option value={1000000}>1000000</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Sync Rate: {syncRate} Hz
                </label>
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={syncRate}
                  onChange={(e) => setSyncRate(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Connected controls */}
          {connectionState === 'connected' && (
            <>
              {/* Auto-sync toggle */}
              <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                <div>
                  <div className="text-xs text-white">Auto-sync</div>
                  <div className="text-xs text-slate-400">
                    Mirror simulation to hardware
                  </div>
                </div>
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    autoSync ? 'bg-green-600' : 'bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      autoSync ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Manual send */}
              {!autoSync && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSendOnce}
                  className="w-full"
                >
                  <Send className="w-3 h-3 mr-1" />
                  Send Current Position
                </Button>
              )}

              {/* Status info */}
              <div className="text-xs text-slate-400">
                {autoSync && (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span>Syncing at {syncRate} Hz</span>
                  </div>
                )}
                {lastSyncTime && (
                  <div>Last sent: {new Date(lastSyncTime).toLocaleTimeString()}</div>
                )}
              </div>
            </>
          )}

          {/* Command preview */}
          <div className="p-2 bg-slate-900/50 rounded-lg">
            <div className="text-xs text-slate-400 mb-1">Command Preview:</div>
            <code className="text-xs text-green-400 font-mono break-all">
              {generateServoCommand(joints).trim()}
            </code>
          </div>
        </div>
      )}
    </div>
  );
};
