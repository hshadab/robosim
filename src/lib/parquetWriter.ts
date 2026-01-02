/**
 * Parquet File Writer for LeRobot Datasets
 *
 * Creates LeRobot v2.0/v3.0 compatible data files.
 *
 * NOTE: Browser limitations prevent creating true Apache Parquet binary files.
 * This module outputs a JSON-based format with the same schema that can be:
 * 1. Used directly by the included Python converter script
 * 2. Loaded by LeRobot after conversion to Parquet
 *
 * The exported ZIP includes a convert_to_parquet.py script for easy conversion.
 */

/**
 * LeRobot episode data structure
 * Includes observation.velocity for sim-to-real transfer
 */
export interface ParquetEpisodeData {
  'observation.state': number[][];
  'observation.velocity'?: number[][];  // Optional for backwards compatibility
  'action': number[][];
  'episode_index': number[];
  'frame_index': number[];
  'timestamp': number[];
  'next.done': boolean[];
  'task_index': number[];
}

/**
 * Arrow schema definition for LeRobot compatibility
 */
export interface ArrowSchema {
  fields: {
    name: string;
    type: string;
    listSize?: number;
  }[];
}

/**
 * Create Arrow schema for LeRobot data
 * Includes velocity field for sim-to-real transfer
 */
export function createArrowSchema(numJoints = 6, includeVelocity = true): ArrowSchema {
  const fields: ArrowSchema['fields'] = [
    { name: 'observation.state', type: 'FixedSizeList<Float32>', listSize: numJoints },
  ];

  if (includeVelocity) {
    fields.push({ name: 'observation.velocity', type: 'FixedSizeList<Float32>', listSize: numJoints });
  }

  fields.push({ name: 'action', type: 'FixedSizeList<Float32>', listSize: numJoints });
  fields.push({ name: 'episode_index', type: 'Int64' });
  fields.push({ name: 'frame_index', type: 'Int64' });
  fields.push({ name: 'timestamp', type: 'Float32' });
  fields.push({ name: 'next.done', type: 'Bool' });
  fields.push({ name: 'task_index', type: 'Int64' });

  return { fields };
}

/**
 * Write episode data to LeRobot-compatible JSON format
 * This JSON can be converted to Parquet using the included Python script
 */
export async function writeParquetFile(data: ParquetEpisodeData): Promise<Uint8Array> {
  return writeParquetFilePure(data);
}

/**
 * Write episode data as JSON with LeRobot-compatible schema
 * The output follows columnar format matching Parquet structure
 * Includes velocity data for sim-to-real transfer
 */
export async function writeParquetFilePure(data: ParquetEpisodeData): Promise<Uint8Array> {
  const numRows = data['episode_index'].length;

  if (numRows === 0) {
    throw new Error('No data to write');
  }

  const hasVelocity = data['observation.velocity'] && data['observation.velocity'].length > 0;

  // Create columnar data structure matching LeRobot schema
  const columns: Record<string, unknown> = {
    'observation.state': data['observation.state'],
    'action': data['action'],
    'episode_index': data['episode_index'],
    'frame_index': data['frame_index'],
    'timestamp': data['timestamp'],
    'next.done': data['next.done'],
    'task_index': data['task_index'],
  };

  // Include velocity if available
  if (hasVelocity) {
    columns['observation.velocity'] = data['observation.velocity'];
  }

  const output = {
    _meta: {
      format: 'robosim-lerobot-json',
      lerobot_version: '3.0',
      num_rows: numRows,
      schema: createArrowSchema(data['observation.state'][0]?.length || 6, hasVelocity),
      created_at: new Date().toISOString(),
      note: 'Convert to Parquet using: python convert_to_parquet.py',
    },
    columns,
  };

  const json = JSON.stringify(output);
  return new TextEncoder().encode(json);
}

/**
 * Generate Python conversion script to include in export
 * Handles observation.velocity for sim-to-real transfer
 */
export function generateConversionScript(): string {
  return `#!/usr/bin/env python3
"""
Convert RoboSim JSON episode files to Apache Parquet format for LeRobot.

Usage:
    python convert_to_parquet.py

This script converts all .parquet files (which are actually JSON) in the
data/chunk-000/ directory to true Apache Parquet format.

Supports observation.velocity for sim-to-real transfer.

Requirements:
    pip install pandas pyarrow
"""

import json
import os
from pathlib import Path

try:
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    print("Please install required packages: pip install pandas pyarrow")
    exit(1)

def convert_episode_file(json_path: Path) -> None:
    """Convert a single JSON episode file to Parquet."""
    with open(json_path, 'r') as f:
        data = json.load(f)

    columns = data['columns']

    # Create DataFrame with proper types
    df_data = {
        'observation.state': columns['observation.state'],
        'episode_index': pd.array(columns['episode_index'], dtype='int64'),
        'frame_index': pd.array(columns['frame_index'], dtype='int64'),
        'timestamp': pd.array(columns['timestamp'], dtype='float32'),
        'next.done': columns['next.done'],
        'task_index': pd.array(columns['task_index'], dtype='int64'),
    }

    # Include velocity if present (for sim-to-real transfer)
    if 'observation.velocity' in columns:
        df_data['observation.velocity'] = columns['observation.velocity']

    # Add action last to maintain column order
    df_data['action'] = columns['action']

    df = pd.DataFrame(df_data)

    # Write as Parquet
    output_path = json_path  # Overwrite with same name
    table = pa.Table.from_pandas(df)
    pq.write_table(table, output_path)
    print(f"Converted: {json_path}")

def main():
    data_dir = Path('data/chunk-000')
    if not data_dir.exists():
        print(f"Data directory not found: {data_dir}")
        return

    # Find all .parquet files (which are JSON)
    json_files = list(data_dir.glob('episode_*.parquet'))

    if not json_files:
        print("No episode files found to convert.")
        return

    print(f"Converting {len(json_files)} episode files...")
    for json_path in sorted(json_files):
        try:
            convert_episode_file(json_path)
        except Exception as e:
            print(f"Error converting {json_path}: {e}")

    print("\\nConversion complete! Dataset is now ready for LeRobot.")
    print("\\nUsage with LeRobot:")
    print("  from lerobot.common.datasets.lerobot_dataset import LeRobotDataset")
    print("  dataset = LeRobotDataset('path/to/this/directory')")

if __name__ == '__main__':
    main()
`;
}

/**
 * Convert episodes to Parquet-compatible format
 */
export function episodesToParquetFormat(
  episodes: {
    frames: {
      timestamp: number;
      observation: { jointPositions: number[] };
      action: { jointTargets: number[] };
      done: boolean;
    }[];
    metadata: {
      duration: number;
      success: boolean;
      task?: string;
    };
  }[],
  _fps = 30
): ParquetEpisodeData {
  const data: ParquetEpisodeData = {
    'observation.state': [],
    'action': [],
    'episode_index': [],
    'frame_index': [],
    'timestamp': [],
    'next.done': [],
    'task_index': [],
  };

  let globalFrameIndex = 0;

  episodes.forEach((episode, episodeIdx) => {
    episode.frames.forEach((frame, frameIdx) => {
      data['observation.state'].push(frame.observation.jointPositions);
      data['action'].push(frame.action.jointTargets);
      data['episode_index'].push(episodeIdx);
      data['frame_index'].push(globalFrameIndex);
      data['timestamp'].push(frame.timestamp / 1000); // Convert ms to seconds
      data['next.done'].push(frameIdx === episode.frames.length - 1);
      data['task_index'].push(0); // Default task index
      globalFrameIndex++;
    });
  });

  return data;
}

/**
 * Validate Parquet data structure
 * Validates observation.velocity if present
 */
export function validateParquetData(data: ParquetEpisodeData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const numRows = data['episode_index'].length;

  // Check all arrays have same length
  const lengths: Record<string, number> = {
    'observation.state': data['observation.state'].length,
    'action': data['action'].length,
    'episode_index': data['episode_index'].length,
    'frame_index': data['frame_index'].length,
    'timestamp': data['timestamp'].length,
    'next.done': data['next.done'].length,
    'task_index': data['task_index'].length,
  };

  // Include velocity in validation if present
  if (data['observation.velocity']) {
    lengths['observation.velocity'] = data['observation.velocity'].length;
  }

  for (const [key, len] of Object.entries(lengths)) {
    if (len !== numRows) {
      errors.push(`Column ${key} has ${len} rows, expected ${numRows}`);
    }
  }

  // Check observation.state dimensions
  const firstObsLen = data['observation.state'][0]?.length;
  data['observation.state'].forEach((obs, i) => {
    if (obs.length !== firstObsLen) {
      errors.push(`observation.state[${i}] has ${obs.length} elements, expected ${firstObsLen}`);
    }
  });

  // Check observation.velocity dimensions if present
  if (data['observation.velocity']) {
    const firstVelLen = data['observation.velocity'][0]?.length;
    data['observation.velocity'].forEach((vel, i) => {
      if (vel.length !== firstVelLen) {
        errors.push(`observation.velocity[${i}] has ${vel.length} elements, expected ${firstVelLen}`);
      }
    });

    // Velocity should have same dimension as state
    if (firstVelLen !== firstObsLen) {
      errors.push(`observation.velocity dimension (${firstVelLen}) doesn't match observation.state (${firstObsLen})`);
    }
  }

  // Check action dimensions
  const firstActLen = data['action'][0]?.length;
  data['action'].forEach((act, i) => {
    if (act.length !== firstActLen) {
      errors.push(`action[${i}] has ${act.length} elements, expected ${firstActLen}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a simple binary Parquet file header
 * This creates a minimal valid Parquet file structure
 */
export function createParquetHeader(): Uint8Array {
  // PAR1 magic bytes (Parquet file signature)
  return new Uint8Array([0x50, 0x41, 0x52, 0x31]);
}

/**
 * Create Parquet file footer
 */
export function createParquetFooter(): Uint8Array {
  // PAR1 magic bytes at end
  return new Uint8Array([0x50, 0x41, 0x52, 0x31]);
}

/**
 * Get summary statistics for the data
 */
export function getDataSummary(data: ParquetEpisodeData): {
  numRows: number;
  numEpisodes: number;
  numJoints: number;
  avgFramesPerEpisode: number;
  totalDuration: number;
} {
  const numRows = data['episode_index'].length;
  const uniqueEpisodes = new Set(data['episode_index']);
  const numEpisodes = uniqueEpisodes.size;
  const numJoints = data['observation.state'][0]?.length || 0;
  const avgFramesPerEpisode = numRows / Math.max(numEpisodes, 1);
  const totalDuration = data['timestamp'].reduce((a, b) => Math.max(a, b), 0);

  return {
    numRows,
    numEpisodes,
    numJoints,
    avgFramesPerEpisode,
    totalDuration,
  };
}
