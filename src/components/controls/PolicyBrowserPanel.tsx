/**
 * Policy Browser Panel
 *
 * Browse and load trained LeRobot policies from HuggingFace Hub.
 * Supports ACT, Diffusion, and other policy architectures for SO-101.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Brain,
  Search,
  Download,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  Cpu,
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import {
  searchLeRobotPolicies,
  getPolicyDetails,
  downloadOnnxModel,
  downloadPolicyConfig,
  type LeRobotPolicyMeta,
} from '../../lib/huggingfaceHub';
import {
  getPolicyRunner,
  jointStateToArray,
  arrayToJointState,
  clampJoints,
} from '../../lib/policyRunner';

type LoadingState = 'idle' | 'searching' | 'loading' | 'running' | 'error';

export const PolicyBrowserPanel: React.FC = () => {
  const { activeRobotType, joints, setJoints, setIsAnimating } = useAppStore();
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('so-101');
  const [policies, setPolicies] = useState<LeRobotPolicyMeta[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [loadedPolicy, setLoadedPolicy] = useState<LeRobotPolicyMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const policyRunner = getPolicyRunner();

  // Search for policies
  const handleSearch = useCallback(async () => {
    setLoadingState('searching');
    setError(null);

    try {
      const results = await searchLeRobotPolicies(searchQuery);
      // Filter for SO-101 compatible policies
      const so101Policies = results.filter(
        p => p.robotType === 'so-101' || p.robotType === 'koch' || p.robotType === 'unknown'
      );
      setPolicies(so101Policies.slice(0, 20));
      setLoadingState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setLoadingState('error');
    }
  }, [searchQuery]);

  // Initial search
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load a policy
  const handleLoadPolicy = useCallback(async (policy: LeRobotPolicyMeta) => {
    setLoadingState('loading');
    setError(null);
    setDownloadProgress(0);

    try {
      // Get full policy details
      const details = await getPolicyDetails(policy.modelId);

      if (!details.hasOnnx) {
        throw new Error('No ONNX model found. Only ONNX-exported policies are supported in browser.');
      }

      // Download config
      const config = await downloadPolicyConfig(policy.modelId, (progress) => {
        setDownloadProgress(progress * 0.2); // 0-20%
      });

      // Download ONNX model
      const modelBuffer = await downloadOnnxModel(policy.modelId, (progress) => {
        setDownloadProgress(20 + progress * 0.7); // 20-90%
      });

      if (!modelBuffer) {
        throw new Error('Failed to download ONNX model');
      }

      // Load into policy runner
      await policyRunner.loadModel(modelBuffer, config || undefined, details);
      setDownloadProgress(100);

      setLoadedPolicy(details);
      setLoadingState('idle');
    } catch (err) {
      console.error('[PolicyBrowser] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load policy');
      setLoadingState('error');
    }
  }, [policyRunner]);

  // Run policy inference
  const runPolicyStep = useCallback(async () => {
    if (!policyRunner.isReady() || !isRunning) return;

    try {
      const currentJoints = jointStateToArray(joints);
      const result = await policyRunner.infer(currentJoints);

      if (result.actions.length > 0) {
        const nextAction = clampJoints(result.actions[0]);
        const newJoints = arrayToJointState(nextAction);
        setJoints(newJoints);
      }
    } catch (err) {
      console.error('[PolicyBrowser] Inference error:', err);
    }
  }, [policyRunner, joints, setJoints, isRunning]);

  // Policy execution loop
  useEffect(() => {
    if (!isRunning) return;

    setIsAnimating(true);
    const interval = setInterval(runPolicyStep, 50); // 20Hz

    return () => {
      clearInterval(interval);
      setIsAnimating(false);
    };
  }, [isRunning, runPolicyStep, setIsAnimating]);

  // Start/stop policy execution
  const handleToggleRun = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      policyRunner.stop();
      setLoadingState('idle');
    } else {
      setIsRunning(true);
      policyRunner.start();
      setLoadingState('running');
    }
  }, [isRunning, policyRunner]);

  // Unload policy
  const handleUnload = useCallback(async () => {
    setIsRunning(false);
    await policyRunner.unload();
    setLoadedPolicy(null);
    setLoadingState('idle');
  }, [policyRunner]);

  // Only show for arm robot
  if (activeRobotType !== 'arm') return null;

  const getPolicyTypeColor = (type: LeRobotPolicyMeta['policyType']) => {
    switch (type) {
      case 'act':
        return 'text-blue-400 bg-blue-500/20';
      case 'diffusion':
        return 'text-purple-400 bg-purple-500/20';
      case 'tdmpc':
        return 'text-green-400 bg-green-500/20';
      case 'vqbet':
        return 'text-orange-400 bg-orange-500/20';
      default:
        return 'text-slate-400 bg-slate-500/20';
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          LeRobot Policies
          <span className="text-xs font-normal text-slate-500">(HuggingFace Hub)</span>
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Loaded policy status */}
          {loadedPolicy && (
            <div className="mb-3 p-3 bg-slate-900/50 rounded-lg border border-purple-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white font-medium">Policy Loaded</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={isRunning ? 'danger' : 'primary'}
                    size="sm"
                    onClick={handleToggleRun}
                  >
                    {isRunning ? (
                      <>
                        <Square className="w-3 h-3 mr-1" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Run
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleUnload}>
                    Unload
                  </Button>
                </div>
              </div>
              <div className="text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded ${getPolicyTypeColor(loadedPolicy.policyType)}`}>
                    {loadedPolicy.policyType.toUpperCase()}
                  </span>
                  <span>{loadedPolicy.modelId}</span>
                </div>
                {loadedPolicy.taskName && (
                  <div className="mt-1">Task: {loadedPolicy.taskName}</div>
                )}
              </div>
              {isRunning && (
                <div className="mt-2 flex items-center gap-2 text-xs text-purple-400">
                  <Cpu className="w-3 h-3 animate-pulse" />
                  Running inference at 20Hz...
                </div>
              )}
            </div>
          )}

          {/* Search bar */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search policies (e.g., so-101, act)"
                className="w-full pl-8 pr-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSearch}
              disabled={loadingState === 'searching'}
            >
              {loadingState === 'searching' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Loading progress */}
          {loadingState === 'loading' && (
            <div className="mb-3 p-2 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Downloading policy...
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-200"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          {/* Policy list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {policies.length === 0 && loadingState !== 'searching' && (
              <div className="text-center text-xs text-slate-500 py-4">
                No policies found. Try a different search.
              </div>
            )}
            {policies.map((policy) => (
              <div
                key={policy.modelId}
                className="p-2 rounded-lg border bg-slate-900/50 border-slate-700/50 hover:border-slate-600/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getPolicyTypeColor(policy.policyType)}`}>
                        {policy.policyType.toUpperCase()}
                      </span>
                      <a
                        href={`https://huggingface.co/${policy.modelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-sm font-medium text-white mt-1 truncate">
                      {policy.modelId.split('/')[1] || policy.modelId}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      by {policy.author}
                    </div>
                    {policy.taskName && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        Task: {policy.taskName}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{policy.downloads.toLocaleString()} downloads</span>
                      <span>{policy.hasOnnx ? '✓ ONNX' : '✗ No ONNX'}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLoadPolicy(policy)}
                    disabled={!policy.hasOnnx || loadingState === 'loading'}
                    className={policy.hasOnnx ? 'text-purple-400 hover:text-purple-300' : 'text-slate-600'}
                    title={policy.hasOnnx ? 'Load policy' : 'No ONNX model available'}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Info footer */}
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="text-xs text-slate-500">
              Policies run locally in your browser using ONNX Runtime.
              <br />
              Only policies with ONNX exports can be loaded.
            </div>
          </div>
        </>
      )}
    </div>
  );
};
