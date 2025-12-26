/**
 * Dataset Browser Panel
 *
 * Browse and preview LeRobot datasets from HuggingFace Hub.
 * Allows users to explore available training data and download for comparison.
 */

import React, { useState, useCallback } from 'react';
import {
  Database,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Loader2,
  Eye,
  BarChart3,
  Clock,
  Film,
  Bot,
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';

// HuggingFace Dataset API types
interface HFDataset {
  id: string;
  author: string;
  lastModified: string;
  downloads: number;
  likes: number;
  tags: string[];
  description?: string;
}

interface DatasetInfo {
  id: string;
  author: string;
  downloads: number;
  likes: number;
  lastModified: string;
  robotType: string;
  numEpisodes?: number;
  numFrames?: number;
  fps?: number;
  taskDescription?: string;
  hasVideo: boolean;
  size?: string;
}

type LoadingState = 'idle' | 'searching' | 'loading' | 'previewing';

const HF_API_BASE = 'https://huggingface.co/api';

// Featured LeRobot datasets
const FEATURED_DATASETS: DatasetInfo[] = [
  {
    id: 'lerobot/pusht',
    author: 'lerobot',
    downloads: 5000,
    likes: 50,
    lastModified: '2024-01-15',
    robotType: 'pusht',
    numEpisodes: 200,
    taskDescription: 'Push T-shaped block to target',
    hasVideo: true,
  },
  {
    id: 'lerobot/aloha_sim_insertion_human',
    author: 'lerobot',
    downloads: 3000,
    likes: 30,
    lastModified: '2024-01-10',
    robotType: 'aloha',
    numEpisodes: 50,
    taskDescription: 'Peg insertion task with ALOHA',
    hasVideo: true,
  },
  {
    id: 'lerobot/aloha_sim_transfer_cube_human',
    author: 'lerobot',
    downloads: 2500,
    likes: 25,
    lastModified: '2024-01-08',
    robotType: 'aloha',
    numEpisodes: 50,
    taskDescription: 'Transfer cube between grippers',
    hasVideo: true,
  },
];

/**
 * Search HuggingFace Hub for LeRobot datasets
 */
async function searchDatasets(query = 'lerobot'): Promise<DatasetInfo[]> {
  const searchQuery = encodeURIComponent(`lerobot ${query}`);
  const url = `${HF_API_BASE}/datasets?search=${searchQuery}&limit=30&sort=downloads&direction=-1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HuggingFace API error: ${response.status}`);
  }

  const datasets: HFDataset[] = await response.json();

  // Filter and transform to DatasetInfo
  return datasets
    .filter(d => d.id.includes('lerobot') || d.tags?.includes('lerobot'))
    .map(d => ({
      id: d.id,
      author: d.author || d.id.split('/')[0],
      downloads: d.downloads || 0,
      likes: d.likes || 0,
      lastModified: d.lastModified,
      robotType: detectRobotType(d.id, d.tags || []),
      taskDescription: d.description,
      hasVideo: true, // Assume LeRobot datasets have video
    }));
}

function detectRobotType(id: string, tags: string[]): string {
  const combined = (id + ' ' + tags.join(' ')).toLowerCase();

  if (combined.includes('so-101') || combined.includes('so101') || combined.includes('so_101')) {
    return 'so-101';
  }
  if (combined.includes('so-100') || combined.includes('so100')) {
    return 'so-100';
  }
  if (combined.includes('aloha')) {
    return 'aloha';
  }
  if (combined.includes('pusht') || combined.includes('push_t')) {
    return 'pusht';
  }
  if (combined.includes('xarm')) {
    return 'xarm';
  }
  if (combined.includes('koch')) {
    return 'koch';
  }

  return 'unknown';
}

export const DatasetBrowserPanel: React.FC = () => {
  const { activeRobotType } = useAppStore();
  const [expanded, setExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [datasets, setDatasets] = useState<DatasetInfo[]>(FEATURED_DATASETS);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<DatasetInfo | null>(null);
  const [filterRobot, setFilterRobot] = useState<string>('all');

  // Search for datasets
  const handleSearch = useCallback(async () => {
    setLoadingState('searching');
    setError(null);

    try {
      const results = await searchDatasets(searchQuery);
      setDatasets(results.length > 0 ? results : FEATURED_DATASETS);
      setLoadingState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setLoadingState('idle');
      setDatasets(FEATURED_DATASETS);
    }
  }, [searchQuery]);

  // Filter datasets by robot type
  const filteredDatasets = datasets.filter(d => {
    if (filterRobot === 'all') return true;
    if (filterRobot === 'compatible') {
      // SO-101 compatible: so-101, so-100, koch, unknown
      return ['so-101', 'so-100', 'koch', 'unknown'].includes(d.robotType);
    }
    return d.robotType === filterRobot;
  });

  // Get robot type badge color
  const getRobotColor = (robotType: string) => {
    switch (robotType) {
      case 'so-101':
      case 'so-100':
        return 'text-blue-400 bg-blue-500/20';
      case 'aloha':
        return 'text-purple-400 bg-purple-500/20';
      case 'pusht':
        return 'text-green-400 bg-green-500/20';
      case 'xarm':
        return 'text-orange-400 bg-orange-500/20';
      default:
        return 'text-slate-400 bg-slate-500/20';
    }
  };

  // Only show for arm robot
  if (activeRobotType !== 'arm') return null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          Dataset Browser
          <span className="text-xs font-normal text-slate-500">(HuggingFace)</span>
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse Dataset Browser panel' : 'Expand Dataset Browser panel'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Search bar */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search datasets (e.g., pick_place)"
                className="w-full pl-8 pr-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                aria-label="Search HuggingFace datasets"
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

          {/* Filter tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto">
            {['all', 'compatible', 'so-101', 'aloha', 'pusht'].map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterRobot(filter)}
                className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                  filterRobot === filter
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-transparent'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'compatible' ? 'Compatible' : filter.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          {/* Dataset list */}
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {filteredDatasets.length === 0 && loadingState !== 'searching' && (
              <div className="text-center text-xs text-slate-500 py-4">
                No datasets found. Try a different search.
              </div>
            )}
            {filteredDatasets.map((dataset) => (
              <button
                key={dataset.id}
                type="button"
                className={`w-full text-left p-3 rounded-lg border bg-slate-900/50 transition-colors cursor-pointer ${
                  selectedDataset?.id === dataset.id
                    ? 'border-cyan-500/50 bg-cyan-500/5'
                    : 'border-slate-700/50 hover:border-slate-600/50'
                }`}
                onClick={() => setSelectedDataset(selectedDataset?.id === dataset.id ? null : dataset)}
                aria-expanded={selectedDataset?.id === dataset.id}
                aria-label={`Dataset ${dataset.id.split('/')[1] || dataset.id} by ${dataset.author}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getRobotColor(dataset.robotType)}`}>
                        {dataset.robotType.toUpperCase()}
                      </span>
                      {dataset.hasVideo && (
                        <Film className="w-3 h-3 text-slate-500" />
                      )}
                    </div>
                    <div className="text-sm font-medium text-white truncate">
                      {dataset.id.split('/')[1] || dataset.id}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      by {dataset.author}
                    </div>
                    {dataset.taskDescription && (
                      <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {dataset.taskDescription}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {dataset.downloads.toLocaleString()}
                      </span>
                      {dataset.numEpisodes && (
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {dataset.numEpisodes} eps
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://huggingface.co/datasets/${dataset.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-slate-500 hover:text-slate-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Expanded details */}
                {selectedDataset?.id === dataset.id && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Bot className="w-3 h-3" />
                        Robot: {dataset.robotType}
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" />
                        Updated: {new Date(dataset.lastModified).toLocaleDateString()}
                      </div>
                      {dataset.numEpisodes && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <BarChart3 className="w-3 h-3" />
                          Episodes: {dataset.numEpisodes}
                        </div>
                      )}
                      {dataset.fps && (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Film className="w-3 h-3" />
                          FPS: {dataset.fps}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(`https://huggingface.co/datasets/${dataset.id}/viewer`, '_blank')}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(`https://huggingface.co/datasets/${dataset.id}/tree/main`, '_blank')}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Info footer */}
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="text-xs text-slate-500">
              Browse LeRobot datasets from HuggingFace Hub.
              <br />
              Use for training reference or policy evaluation.
            </div>
          </div>
        </>
      )}
    </div>
  );
};
