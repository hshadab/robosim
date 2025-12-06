/**
 * Serial Connection Library for SO-101 Robot Arm
 *
 * Provides Web Serial API integration for connecting to real hardware.
 * Supports common protocols for servo controllers (e.g., PWM, serial servo).
 */

import type { JointState } from '../types';

// Web Serial API types (not fully typed in standard lib)
declare global {
  interface Navigator {
    serial?: {
      requestPort(): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
    };
  }

  interface SerialPort {
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
  }

  interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
    bufferSize?: number;
    flowControl?: 'none' | 'hardware';
  }
}

// Connection configuration
export interface SerialConfig {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

// Default configuration for SO-101 (common for ESP32/Arduino)
export const DEFAULT_SERIAL_CONFIG: SerialConfig = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: 255,
  flowControl: 'none',
};

// Protocol types supported
export type ProtocolType = 'json' | 'binary' | 'custom';

// Message types for JSON protocol
export interface JointCommandMessage {
  type: 'joint_command';
  joints: JointState;
  duration?: number; // ms
}

export interface JointFeedbackMessage {
  type: 'joint_feedback';
  joints: JointState;
  timestamp: number;
}

export interface StatusMessage {
  type: 'status';
  connected: boolean;
  error?: string;
  batteryVoltage?: number;
  temperature?: number;
}

export type SerialMessage = JointCommandMessage | JointFeedbackMessage | StatusMessage;

// Connection state
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Event callbacks
export interface SerialCallbacks {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (message: SerialMessage) => void;
  onJointFeedback?: (joints: JointState) => void;
}

/**
 * Check if Web Serial API is supported
 */
export const isSerialSupported = (): boolean => {
  return 'serial' in navigator;
};

/**
 * Serial Connection Manager
 */
export class SerialConnection {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readLoop: boolean = false;
  private callbacks: SerialCallbacks = {};
  private protocol: ProtocolType = 'json';
  private lineBuffer: string = '';

  private _state: ConnectionState = 'disconnected';
  private _lastError: Error | null = null;

  /**
   * Get current connection state
   */
  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Get last error
   */
  get lastError(): Error | null {
    return this._lastError;
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: SerialCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set protocol type
   */
  setProtocol(protocol: ProtocolType): void {
    this.protocol = protocol;
  }

  /**
   * Request and connect to a serial port
   */
  async connect(config: SerialConfig = DEFAULT_SERIAL_CONFIG): Promise<boolean> {
    if (!isSerialSupported()) {
      this._lastError = new Error('Web Serial API is not supported in this browser');
      this._state = 'error';
      this.callbacks.onError?.(this._lastError);
      return false;
    }

    try {
      this._state = 'connecting';

      // Request port from user
      if (!navigator.serial) {
        throw new Error('Web Serial API not available');
      }
      this.port = await navigator.serial.requestPort();

      // Open the port
      await this.port.open({
        baudRate: config.baudRate,
        dataBits: config.dataBits,
        stopBits: config.stopBits,
        parity: config.parity,
        bufferSize: config.bufferSize,
        flowControl: config.flowControl,
      });

      // Set up reader and writer
      if (this.port.readable) {
        this.reader = this.port.readable.getReader();
        this.startReadLoop();
      }

      if (this.port.writable) {
        this.writer = this.port.writable.getWriter();
      }

      this._state = 'connected';
      this._lastError = null;
      this.callbacks.onConnect?.();

      return true;
    } catch (error) {
      this._lastError = error as Error;
      this._state = 'error';
      this.callbacks.onError?.(this._lastError);
      return false;
    }
  }

  /**
   * Disconnect from the serial port
   */
  async disconnect(): Promise<void> {
    this.readLoop = false;

    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }

      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (error) {
      console.warn('Error during disconnect:', error);
    }

    this._state = 'disconnected';
    this.callbacks.onDisconnect?.();
  }

  /**
   * Send joint positions to the robot
   */
  async sendJoints(joints: JointState, duration?: number): Promise<boolean> {
    if (this._state !== 'connected' || !this.writer) {
      return false;
    }

    try {
      const message: JointCommandMessage = {
        type: 'joint_command',
        joints,
        duration,
      };

      const data = this.encodeMessage(message);
      await this.writer.write(data);
      return true;
    } catch (error) {
      this._lastError = error as Error;
      this.callbacks.onError?.(this._lastError);
      return false;
    }
  }

  /**
   * Send raw data
   */
  async sendRaw(data: Uint8Array | string): Promise<boolean> {
    if (this._state !== 'connected' || !this.writer) {
      return false;
    }

    try {
      const encoded = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data;
      await this.writer.write(encoded);
      return true;
    } catch (error) {
      this._lastError = error as Error;
      this.callbacks.onError?.(this._lastError);
      return false;
    }
  }

  /**
   * Start the read loop
   */
  private async startReadLoop(): Promise<void> {
    if (!this.reader) return;

    this.readLoop = true;
    const decoder = new TextDecoder();

    try {
      while (this.readLoop && this.reader) {
        const { value, done } = await this.reader.read();

        if (done) {
          break;
        }

        if (value) {
          this.processIncomingData(decoder.decode(value));
        }
      }
    } catch (error) {
      if (this.readLoop) {
        // Only report error if we didn't intentionally stop
        this._lastError = error as Error;
        this._state = 'error';
        this.callbacks.onError?.(this._lastError);
      }
    }
  }

  /**
   * Process incoming data
   */
  private processIncomingData(data: string): void {
    // Add to line buffer
    this.lineBuffer += data;

    // Process complete lines
    const lines = this.lineBuffer.split('\n');
    this.lineBuffer = lines.pop() || ''; // Keep incomplete line

    for (const line of lines) {
      if (line.trim()) {
        this.processLine(line.trim());
      }
    }
  }

  /**
   * Process a complete line
   */
  private processLine(line: string): void {
    if (this.protocol === 'json') {
      try {
        const message = JSON.parse(line) as SerialMessage;
        this.callbacks.onMessage?.(message);

        // Handle specific message types
        if (message.type === 'joint_feedback') {
          this.callbacks.onJointFeedback?.(message.joints);
        }
      } catch {
        // Not valid JSON, might be debug output
        console.debug('Serial:', line);
      }
    } else {
      // For other protocols, pass raw line
      console.debug('Serial:', line);
    }
  }

  /**
   * Encode a message for sending
   */
  private encodeMessage(message: SerialMessage): Uint8Array {
    if (this.protocol === 'json') {
      const json = JSON.stringify(message) + '\n';
      return new TextEncoder().encode(json);
    }

    // Binary protocol (placeholder for future implementation)
    // Format: [START][TYPE][LENGTH][DATA][CHECKSUM][END]
    return new Uint8Array();
  }
}

/**
 * Convert joint state to servo microseconds (typical range 500-2500)
 */
export const jointsToServoPWM = (
  joints: JointState,
  config?: {
    minPWM?: number;
    maxPWM?: number;
    rangeMap?: Record<keyof JointState, { min: number; max: number }>;
  }
): Record<keyof JointState, number> => {
  const minPWM = config?.minPWM ?? 500;
  const maxPWM = config?.maxPWM ?? 2500;
  const range = maxPWM - minPWM;

  // Default ranges for each joint (degrees)
  const defaultRanges: Record<keyof JointState, { min: number; max: number }> = {
    base: { min: -110, max: 110 },
    shoulder: { min: -100, max: 100 },
    elbow: { min: -97, max: 97 },
    wrist: { min: -95, max: 95 },
    wristRoll: { min: -157, max: 163 },
    gripper: { min: 0, max: 100 },
  };

  const ranges = config?.rangeMap ?? defaultRanges;

  const result: Record<keyof JointState, number> = {} as Record<keyof JointState, number>;

  for (const [joint, value] of Object.entries(joints) as [keyof JointState, number][]) {
    const { min, max } = ranges[joint];
    const normalized = (value - min) / (max - min); // 0 to 1
    result[joint] = Math.round(minPWM + normalized * range);
  }

  return result;
};

/**
 * Generate Arduino/ESP32 compatible serial command string
 */
export const generateServoCommand = (joints: JointState): string => {
  const pwm = jointsToServoPWM(joints);
  // Format: J0:1500,J1:1500,J2:1500,J3:1500,J4:1500,J5:1500\n
  const parts = [
    `J0:${pwm.base}`,
    `J1:${pwm.shoulder}`,
    `J2:${pwm.elbow}`,
    `J3:${pwm.wrist}`,
    `J4:${pwm.wristRoll}`,
    `J5:${pwm.gripper}`,
  ];
  return parts.join(',') + '\n';
};

// Default instance
export const serialConnection = new SerialConnection();
