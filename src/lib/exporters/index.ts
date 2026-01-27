/**
 * Code Exporters Module
 *
 * Generates hardware code from RoboSim simulation code.
 * Re-exports all exporter functionality.
 */

import type { RobotProfile } from '../../types';
import {
  type HardwareKit,
  type RobotPinMapping,
  getHardwareKit,
  getPinMapping,
  DEFAULT_PIN_MAPPINGS,
} from '../../config/hardwareKits';

export { parseSimulationCode, type ParsedCommand } from './parser';
export { generateArduinoCode } from './arduino';
export { generateMicroPythonCode } from './micropython';
export { generateLeRobotCode } from './lerobot';

import { parseSimulationCode } from './parser';
import { generateArduinoCode } from './arduino';
import { generateMicroPythonCode } from './micropython';
import { generateLeRobotCode } from './lerobot';

export type ExportLanguage = 'arduino' | 'micropython' | 'circuitpython' | 'lerobot';

export interface ExportOptions {
  language: ExportLanguage;
  robotId: string;
  hardwareKitId: string;
  includeComments: boolean;
  includeSetupInstructions: boolean;
}

export interface ExportResult {
  success: boolean;
  code: string;
  filename: string;
  language: ExportLanguage;
  warnings: string[];
  errors: string[];
}

export function exportCode(
  simulationCode: string,
  robot: RobotProfile,
  options: ExportOptions
): ExportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const kit = getHardwareKit(options.hardwareKitId);
  if (!kit) {
    return {
      success: false,
      code: '',
      filename: '',
      language: options.language,
      warnings: [],
      errors: [`Hardware kit '${options.hardwareKitId}' not found`],
    };
  }

  const mapping = getPinMapping(options.robotId, options.hardwareKitId);
  if (!mapping) {
    return {
      success: false,
      code: '',
      filename: '',
      language: options.language,
      warnings: [],
      errors: [`No pin mapping found for ${robot.name} with ${kit.name}`],
    };
  }

  const commands = parseSimulationCode(simulationCode);

  if (commands.length === 0) {
    warnings.push('No recognized commands found in simulation code');
  }

  let code: string;
  let extension: string;

  switch (options.language) {
    case 'arduino':
      code = generateArduinoCode(commands, robot, kit, mapping, options);
      extension = 'ino';
      break;

    case 'micropython':
    case 'circuitpython':
      code = generateMicroPythonCode(commands, robot, kit, mapping, options);
      extension = 'py';
      break;

    case 'lerobot':
      code = generateLeRobotCode(commands, robot, options);
      extension = 'py';
      break;

    default:
      return {
        success: false,
        code: '',
        filename: '',
        language: options.language,
        warnings: [],
        errors: [`Unsupported language: ${options.language}`],
      };
  }

  const filename = `robosim_${robot.id}_${options.language}.${extension}`;

  return {
    success: true,
    code,
    filename,
    language: options.language,
    warnings,
    errors,
  };
}

/**
 * Download generated code as a file
 */
export function downloadCode(result: ExportResult): void {
  const blob = new Blob([result.code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy generated code to clipboard
 */
export async function copyCodeToClipboard(result: ExportResult): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(result.code);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of supported export targets for a robot
 */
export function getSupportedExports(robotId: string): {
  kitId: string;
  kitName: string;
  languages: ExportLanguage[];
}[] {
  const mappings = DEFAULT_PIN_MAPPINGS.filter(m => m.robotId === robotId);
  const results: { kitId: string; kitName: string; languages: ExportLanguage[] }[] = [];

  if (robotId === 'so-101') {
    results.push({
      kitId: 'lerobot',
      kitName: 'LeRobot (HuggingFace)',
      languages: ['lerobot'],
    });
  }

  for (const mapping of mappings) {
    const kit = getHardwareKit(mapping.hardwareKitId);
    if (kit) {
      results.push({
        kitId: kit.id,
        kitName: kit.name,
        languages: kit.programmingLanguages as ExportLanguage[],
      });
    }
  }

  return results;
}
