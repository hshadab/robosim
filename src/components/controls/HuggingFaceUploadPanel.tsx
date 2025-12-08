/**
 * HuggingFace Upload Panel
 *
 * Provides UI for uploading datasets directly to HuggingFace Hub:
 * - Token authentication
 * - Repository configuration
 * - Upload progress tracking
 * - Direct link to uploaded dataset
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Upload,
  Key,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Lock,
  Globe,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../common';
import {
  uploadToHuggingFace,
  validateHFToken,
  validateRepoName,
  generateRepoName,
  type HFUploadConfig,
  type HFUploadProgress,
  type HFUploadResult,
} from '../../lib/huggingfaceUpload';
import type { Episode } from '../../lib/datasetExporter';

interface HuggingFaceUploadPanelProps {
  episodes: Episode[];
  robotId?: string;
  task?: string;
}

export const HuggingFaceUploadPanel: React.FC<HuggingFaceUploadPanelProps> = ({
  episodes,
  robotId = 'so-101-sim',
  task,
}) => {
  const [expanded, setExpanded] = useState(true);
  
  // Auth state
  const [token, setToken] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  
  // Config state
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<HFUploadProgress | null>(null);
  const [result, setResult] = useState<HFUploadResult | null>(null);
  
  // Generate default repo name - use lazy initialization instead of effect
  const [repoNameInitialized] = useState(() => {
    if (!repoName) {
      return generateRepoName(task, robotId);
    }
    return repoName;
  });

  // Sync repoName with initialized value on first render only
  useEffect(() => {
    if (!repoName && repoNameInitialized) {
      setRepoName(repoNameInitialized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Validate repo name
  const repoNameValidation = useMemo(
    () => validateRepoName(repoName),
    [repoName]
  );
  
  // Validate token when changed
  const handleValidateToken = useCallback(async () => {
    if (!token) {
      setTokenValid(null);
      setUsername('');
      return;
    }
    
    setIsValidating(true);
    const result = await validateHFToken(token);
    setTokenValid(result.valid);
    setUsername(result.username || '');
    setIsValidating(false);
  }, [token]);
  
  // Debounced token validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (token.length > 10) {
        handleValidateToken();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [token, handleValidateToken]);
  
  // Can upload check
  const canUpload = useMemo(() => {
    return (
      episodes.length > 0 &&
      tokenValid === true &&
      username &&
      repoNameValidation.valid &&
      !isUploading
    );
  }, [episodes.length, tokenValid, username, repoNameValidation.valid, isUploading]);
  
  // Handle upload
  const handleUpload = useCallback(async () => {
    if (!canUpload) return;
    
    setIsUploading(true);
    setResult(null);
    
    const config: HFUploadConfig = {
      username,
      repoName,
      token,
      description: description || undefined,
      isPrivate,
      robotType: 'arm',
      robotId,
      fps: 30,
      task,
      tags: ['robosim', 'synthetic'],
    };
    
    const uploadResult = await uploadToHuggingFace(
      episodes,
      config,
      setProgress
    );
    
    setResult(uploadResult);
    setIsUploading(false);
  }, [canUpload, username, repoName, token, description, isPrivate, robotId, task, episodes]);
  
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Upload className="w-4 h-4 text-yellow-400" />
          HuggingFace Hub
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
          {/* Description */}
          <p className="text-xs text-slate-400 mb-4">
            Upload your dataset directly to HuggingFace Hub for sharing and training.
          </p>
          
          {/* Token input */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-300 mb-1 block">
              HuggingFace Token
            </label>
            <div className="relative">
              <Key className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="hf_..."
                className="w-full pl-8 pr-8 py-2 text-sm bg-slate-900/50 border border-slate-700/50
                         rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {isValidating && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                {!isValidating && tokenValid === true && <CheckCircle className="w-4 h-4 text-green-400" />}
                {!isValidating && tokenValid === false && <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>
            </div>
            {tokenValid === true && username && (
              <p className="text-xs text-green-400 mt-1">Authenticated as {username}</p>
            )}
            {tokenValid === false && (
              <p className="text-xs text-red-400 mt-1">Invalid token</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Get your token at{' '}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                huggingface.co/settings/tokens
              </a>
            </p>
          </div>
          
          {/* Repo name */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-300 mb-1 block">
              Repository Name
            </label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="my-robot-dataset"
              className={`w-full px-3 py-2 text-sm bg-slate-900/50 border rounded-lg text-white
                       placeholder-slate-500 focus:outline-none ${
                         repoNameValidation.valid
                           ? 'border-slate-700/50 focus:border-blue-500'
                           : 'border-red-500/50'
                       }`}
            />
            {!repoNameValidation.valid && repoName && (
              <p className="text-xs text-red-400 mt-1">{repoNameValidation.error}</p>
            )}
          </div>
          
          {/* Description */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-300 mb-1 block">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your dataset..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-700/50
                       rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          {/* Privacy toggle */}
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              {isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
              {isPrivate ? 'Private repository' : 'Public repository'}
            </span>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-10 h-5 rounded-full transition-colors ${
                isPrivate ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                  isPrivate ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          
          {/* Stats */}
          <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
            <div className="text-xs text-slate-400">Dataset to upload:</div>
            <div className="text-sm text-white">
              {episodes.length} episodes, {episodes.reduce((s, e) => s + e.frames.length, 0).toLocaleString()} frames
            </div>
          </div>
          
          {/* Progress */}
          {isUploading && progress && (
            <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">{progress.message}</span>
                <span className="text-xs text-blue-400">{progress.progress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Result */}
          {result && !isUploading && (
            <div className={`mb-4 p-3 rounded-lg border ${
              result.success
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              {result.success ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    Upload complete!
                  </div>
                  <a
                    href={result.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
                  >
                    Open in HuggingFace <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  {result.error}
                </div>
              )}
            </div>
          )}
          
          {/* Upload button */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleUpload}
            disabled={!canUpload}
            className="w-full bg-yellow-600 hover:bg-yellow-500"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-3 h-3 mr-2" />
                Upload to HuggingFace
              </>
            )}
          </Button>
          
          {episodes.length === 0 && (
            <p className="text-xs text-slate-500 mt-2 text-center">
              Record some episodes first to upload
            </p>
          )}
        </>
      )}
    </div>
  );
};
