import React, { useState, useEffect } from 'react';
import { Play, Square, Bot, Save, Settings, Users, Download } from 'lucide-react';
import { Button, Select } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { ROBOT_PROFILES } from '../../config/robots';
import { ShareButton } from '../controls/ShareButton';
import { ApiKeySettings } from '../settings/ApiKeySettings';
import { getSharedStats, exportCommunityDataset } from '../../lib/pickupExamples';

export const Header: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [communityStats, setCommunityStats] = useState<{ total: number; loading: boolean }>({ total: 0, loading: true });
  const [downloading, setDownloading] = useState(false);
  const {
    selectedRobotId,
    setSelectedRobot,
    setActiveRobotType,
    simulation,
    setSimulationStatus,
    isAnimating,
  } = useAppStore();

  // Fetch community stats on mount
  useEffect(() => {
    getSharedStats().then(stats => {
      if (stats) {
        setCommunityStats({ total: stats.totalExamples, loading: false });
      } else {
        setCommunityStats({ total: 0, loading: false });
      }
    });
  }, []);

  const handleDownloadCommunityDataset = async () => {
    if (communityStats.total === 0) return;
    setDownloading(true);
    try {
      await exportCommunityDataset();
    } catch (error) {
      console.error('Failed to download community dataset:', error);
    } finally {
      setDownloading(false);
    }
  };

  const robotOptions = ROBOT_PROFILES.map((robot) => ({
    value: robot.id,
    label: `${robot.manufacturer} ${robot.name}`,
    description: robot.description,
  }));

  const handleRobotChange = (robotId: string) => {
    setSelectedRobot(robotId);
    // Also update the active robot type based on the selected profile
    const profile = ROBOT_PROFILES.find((r) => r.id === robotId);
    if (profile) {
      setActiveRobotType(profile.type as 'arm' | 'wheeled' | 'drone');
    }
  };

  const handleRun = () => {
    setSimulationStatus('running');
  };

  const handleStop = () => {
    setSimulationStatus('idle');
  };

  return (
    <header className="h-14 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-4">
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Bot className="w-7 h-7 text-blue-400" />
          <span className="text-lg font-bold text-white">RoboSim</span>
        </div>
        <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
          For SO-101
        </span>
        {/* Community Stats Badge with Download */}
        {!communityStats.loading && communityStats.total > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
              <Users className="w-3 h-3" />
              <span>{communityStats.total.toLocaleString()} demos</span>
            </div>
            <button
              onClick={handleDownloadCommunityDataset}
              disabled={downloading}
              className="flex items-center gap-1 text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30 hover:bg-purple-600/30 transition-colors disabled:opacity-50"
              title="Download community dataset (LeRobot format)"
            >
              <Download className="w-3 h-3" />
              <span>{downloading ? 'Downloading...' : 'LeRobot'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Robot Selector */}
      <div className="flex items-center gap-4">
        <Select
          options={robotOptions}
          value={selectedRobotId}
          onChange={handleRobotChange}
          className="w-56"
        />

        {/* Simulation Controls */}
        <div className="flex items-center gap-2">
          {simulation.status === 'running' ? (
            <Button
              variant="danger"
              size="md"
              leftIcon={<Square className="w-4 h-4" />}
              onClick={handleStop}
              disabled={isAnimating}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Play className="w-4 h-4" />}
              onClick={handleRun}
              disabled={isAnimating}
            >
              Run
            </Button>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <ShareButton />
        <Button variant="ghost" size="sm" leftIcon={<Save className="w-4 h-4" />}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Settings Modal */}
      <ApiKeySettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </header>
  );
};
