/**
 * Code Exporter - Re-export shim
 *
 * All functionality has been split into src/lib/exporters/.
 * This file re-exports everything for backward compatibility.
 */

export {
  parseSimulationCode,
  type ParsedCommand,
  generateArduinoCode,
  generateMicroPythonCode,
  generateLeRobotCode,
  exportCode,
  downloadCode,
  copyCodeToClipboard,
  getSupportedExports,
  type ExportLanguage,
  type ExportOptions,
  type ExportResult,
} from './exporters';

// Import for DEFAULT_PIN_MAPPINGS reference (was at bottom of original file)
import { DEFAULT_PIN_MAPPINGS } from '../config/hardwareKits';
export { DEFAULT_PIN_MAPPINGS };
