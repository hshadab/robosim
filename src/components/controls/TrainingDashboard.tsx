/**
 * Training Dashboard Component
 *
 * Displays training data statistics, pickup coverage visualization,
 * and export controls for LeRobot training data.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Download,
  Trash2,
  BarChart3,
  Target,
  CheckCircle,
  XCircle,
  Activity,
  Database,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import {
  getPickupStats,
  getVerifiedCounts,
  getAllVerifiedExamples,
  clearPromotedExamples,
  getSuccessfulPickups,
  getFailedPickups,
} from '../../lib/pickupExamples';
import {
  getContactStats,
  exportAsJSON as exportContactsJSON,
  clearSessions,
  getAllSessions,
  saveSessionsToStorage,
} from '../../lib/contactEvents';
import { generateLanguageVariants } from '../../lib/languageAugmentation';

export const TrainingDashboard: React.FC = () => {
  const { activeRobotType } = useAppStore();
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'coverage' | 'contacts' | 'export'>('overview');

  // Compute statistics
  const pickupStats = useMemo(() => getPickupStats(), []);
  const verifiedCounts = useMemo(() => getVerifiedCounts(), []);
  const contactStats = useMemo(() => getContactStats(), []);
  const allVerified = useMemo(() => getAllVerifiedExamples(), []);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Only show for arm robot
  if (activeRobotType !== 'arm') {
    return null;
  }

  // Export training data
  const handleExportPickups = useCallback(() => {
    const successfulPickups = getSuccessfulPickups();
    const data = {
      metadata: {
        exportTime: new Date().toISOString(),
        robotType: 'SO-101',
        totalExamples: successfulPickups.length,
      },
      examples: successfulPickups.map(pickup => ({
        id: pickup.id,
        timestamp: pickup.timestamp,
        objectType: pickup.objectType,
        objectPosition: pickup.objectPosition,
        objectScale: pickup.objectScale,
        jointSequence: pickup.jointSequence,
        ikErrors: pickup.ikErrors,
        userMessage: pickup.userMessage,
        // Generate language variants for training
        languageVariants: generateLanguageVariants('pick', pickup.objectName),
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robosim-pickups-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportContacts = useCallback(() => {
    const json = exportContactsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robosim-contacts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    saveSessionsToStorage();
  }, []);

  const handleClearPromoted = useCallback(() => {
    if (confirm('Clear all promoted pickup examples from localStorage?')) {
      clearPromotedExamples();
      refresh();
    }
  }, [refresh]);

  const handleClearContacts = useCallback(() => {
    if (confirm('Clear all contact event sessions?')) {
      clearSessions();
      refresh();
    }
  }, [refresh]);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4" key={refreshKey}>
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          Training Dashboard
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); refresh(); }}
            className="p-1 hover:bg-slate-700 rounded"
            title="Refresh stats"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-900/50 rounded-lg">
            {(['overview', 'coverage', 'contacts', 'export'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-4 gap-2">
                <StatCard
                  icon={<Target className="w-4 h-4" />}
                  label="Total Pickups"
                  value={pickupStats.total}
                  color="blue"
                />
                <StatCard
                  icon={<CheckCircle className="w-4 h-4" />}
                  label="Successful"
                  value={pickupStats.successful}
                  color="green"
                />
                <StatCard
                  icon={<XCircle className="w-4 h-4" />}
                  label="Failed"
                  value={pickupStats.failed}
                  color="red"
                />
                <StatCard
                  icon={<Activity className="w-4 h-4" />}
                  label="Success Rate"
                  value={`${(pickupStats.successRate * 100).toFixed(0)}%`}
                  color="purple"
                />
              </div>

              {/* Success Rate Bar */}
              <div className="p-2 bg-slate-900/50 rounded-lg">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Success Rate</span>
                  <span>{(pickupStats.successRate * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
                    style={{ width: `${pickupStats.successRate * 100}%` }}
                  />
                </div>
              </div>

              {/* By Object Type */}
              {Object.keys(pickupStats.byObjectType).length > 0 && (
                <div className="p-2 bg-slate-900/50 rounded-lg">
                  <div className="text-xs text-slate-400 mb-2">By Object Type</div>
                  <div className="space-y-1">
                    {Object.entries(pickupStats.byObjectType).map(([type, stats]) => (
                      <div key={type} className="flex items-center gap-2 text-xs">
                        <span className="text-white capitalize w-16">{type}</span>
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${stats.success / (stats.success + stats.fail) * 100}%` }}
                          />
                        </div>
                        <span className="text-slate-400 w-12 text-right">
                          {stats.success}/{stats.success + stats.fail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Coverage Tab */}
          {activeTab === 'coverage' && (
            <div className="space-y-3">
              {/* Verified Examples Count */}
              <div className="p-2 bg-slate-900/50 rounded-lg">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Verified Examples</span>
                  <span>{allVerified.length} total</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(verifiedCounts).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2 text-xs">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          type === 'cube' ? 'bg-blue-400' :
                          type === 'ball' ? 'bg-green-400' :
                          type === 'cylinder' ? 'bg-orange-400' : 'bg-slate-400'
                        }`}
                      />
                      <span className="text-white capitalize flex-1">{type}</span>
                      <span className="text-slate-400">{count} examples</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coverage Heatmap (simplified) */}
              <div className="p-2 bg-slate-900/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-2">Position Coverage (Top View)</div>
                <div className="relative w-full aspect-square bg-slate-800 rounded border border-slate-600">
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-cols-5 grid-rows-5">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} className="border border-slate-700/50" />
                    ))}
                  </div>

                  {/* Robot position */}
                  <div
                    className="absolute w-3 h-3 bg-purple-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: '50%', bottom: '10%' }}
                    title="Robot base"
                  />

                  {/* Verified positions */}
                  {allVerified.slice(0, 50).map((example, i) => {
                    // Map position to percentage (assuming workspace is ~30cm x ~30cm centered)
                    const x = ((example.objectPosition[0] / 0.30) + 0.5) * 100;
                    const z = ((example.objectPosition[2] / 0.30) + 0.5) * 100;
                    return (
                      <div
                        key={example.id || i}
                        className={`absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${
                          example.objectType === 'cube' ? 'bg-blue-400' :
                          example.objectType === 'ball' ? 'bg-green-400' :
                          example.objectType === 'cylinder' ? 'bg-orange-400' : 'bg-white'
                        }`}
                        style={{
                          left: `${Math.min(95, Math.max(5, x))}%`,
                          top: `${Math.min(95, Math.max(5, 100 - z))}%`,
                          opacity: example.id?.startsWith('promoted-') ? 1 : 0.6,
                        }}
                        title={`${example.objectType} at [${example.objectPosition.map(p => (p*100).toFixed(0)).join(', ')}]cm`}
                      />
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full" /> Cube
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full" /> Ball
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-orange-400 rounded-full" /> Cylinder
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <StatCard
                  icon={<Database className="w-4 h-4" />}
                  label="Sessions"
                  value={contactStats.totalSessions}
                  color="blue"
                />
                <StatCard
                  icon={<Activity className="w-4 h-4" />}
                  label="Events"
                  value={contactStats.totalEvents}
                  color="purple"
                />
                <StatCard
                  icon={<CheckCircle className="w-4 h-4" />}
                  label="Successful"
                  value={contactStats.successfulSessions}
                  color="green"
                />
              </div>

              {/* Event Types */}
              {Object.keys(contactStats.eventsByType).length > 0 && (
                <div className="p-2 bg-slate-900/50 rounded-lg">
                  <div className="text-xs text-slate-400 mb-2">Event Types</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(contactStats.eventsByType).map(([type, count]) => (
                      <span
                        key={type}
                        className={`px-2 py-0.5 rounded text-xs ${
                          type === 'grasp' ? 'bg-green-500/20 text-green-400' :
                          type === 'release' ? 'bg-blue-500/20 text-blue-400' :
                          type === 'contact' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}
                      >
                        {type}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Average Grasp Duration */}
              {contactStats.averageGraspDuration > 0 && (
                <div className="p-2 bg-slate-900/50 rounded-lg">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Avg Grasp Duration</span>
                    <span className="text-white">
                      {(contactStats.averageGraspDuration / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
              )}

              {/* Recent Sessions */}
              <div className="p-2 bg-slate-900/50 rounded-lg">
                <div className="text-xs text-slate-400 mb-2">Recent Sessions</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {getAllSessions().slice(-5).reverse().map(session => (
                    <div
                      key={session.id}
                      className="flex items-center gap-2 text-xs p-1 bg-slate-800/50 rounded"
                    >
                      {session.metadata.success ? (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400" />
                      )}
                      <span className="text-slate-300 flex-1 truncate">
                        {session.metadata.userCommand || 'Unnamed session'}
                      </span>
                      <span className="text-slate-500">
                        {session.events.length} events
                      </span>
                    </div>
                  ))}
                  {getAllSessions().length === 0 && (
                    <div className="text-slate-500 text-xs">No sessions yet</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-3">
              {/* Export Buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleExportPickups}
                  disabled={pickupStats.successful === 0}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Pickups ({pickupStats.successful} examples)
                </button>

                <button
                  onClick={handleExportContacts}
                  disabled={contactStats.totalSessions === 0}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Contacts ({contactStats.totalSessions} sessions)
                </button>
              </div>

              {/* Clear Buttons */}
              <div className="border-t border-slate-700 pt-3 space-y-2">
                <button
                  onClick={handleClearPromoted}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-red-600/50 text-slate-300 hover:text-white text-sm rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Promoted Examples
                </button>

                <button
                  onClick={handleClearContacts}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-red-600/50 text-slate-300 hover:text-white text-sm rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Contact Sessions
                </button>
              </div>

              {/* Format Info */}
              <div className="p-2 bg-slate-900/50 rounded-lg text-xs text-slate-400">
                <p className="mb-1">Export formats:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Pickups: JSON with joint sequences + language variants</li>
                  <li>Contacts: LeRobot-compatible episode format</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Stat card subcomponent
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'red' | 'purple' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-500/10',
    green: 'text-green-400 bg-green-500/10',
    red: 'text-red-400 bg-red-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
  };

  return (
    <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
      <div className={`${colorClasses[color].split(' ')[0]} mb-1`}>{icon}</div>
      <div className="text-white text-lg font-semibold">{value}</div>
      <div className="text-slate-400 text-xs">{label}</div>
    </div>
  );
};

export default TrainingDashboard;
