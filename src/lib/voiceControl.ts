/**
 * Voice Control for RoboSim
 *
 * Provides hands-free robot control using the Web Speech API.
 * Supports:
 * - Continuous speech recognition
 * - Wake word detection ("Hey Robot", "Okay Robot")
 * - Direct command mode
 * - Voice feedback via speech synthesis
 */

import { createLogger } from './logger';

const logger = createLogger('VoiceControl');

export interface VoiceControlConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  wakeWord: string;
  wakeWordEnabled: boolean;
  speakResponses: boolean;
  voiceRate: number;
  voicePitch: number;
}

export interface VoiceCommand {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

export type VoiceCommandHandler = (command: VoiceCommand) => void;
export type VoiceStateHandler = (state: VoiceControlState) => void;

export type VoiceControlState = 'inactive' | 'listening' | 'processing' | 'speaking' | 'error';

const DEFAULT_CONFIG: VoiceControlConfig = {
  language: 'en-US',
  continuous: true,
  interimResults: true,
  wakeWord: 'hey robot',
  wakeWordEnabled: false,
  speakResponses: true,
  voiceRate: 1.0,
  voicePitch: 1.0,
};

// Check if Web Speech API is available
const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

const SpeechSynthesis = typeof window !== 'undefined' ? window.speechSynthesis : null;

/**
 * Check if voice control is supported in the current browser
 */
export function isVoiceControlSupported(): boolean {
  return SpeechRecognition !== null && SpeechSynthesis !== null;
}

/**
 * Get available voices for speech synthesis
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!SpeechSynthesis) return [];
  return SpeechSynthesis.getVoices();
}

/**
 * Voice Control Manager
 */
export class VoiceControlManager {
  private recognition: SpeechRecognition | null = null;
  private config: VoiceControlConfig;
  private state: VoiceControlState = 'inactive';
  private commandHandlers: VoiceCommandHandler[] = [];
  private stateHandlers: VoiceStateHandler[] = [];
  private isAwake: boolean = false;
  private wakeTimeout: ReturnType<typeof setTimeout> | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor(config: Partial<VoiceControlConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!isVoiceControlSupported()) {
      logger.warn('Web Speech API not supported in this browser');
      return;
    }

    this.initRecognition();
    this.initVoice();
  }

  private initRecognition(): void {
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;

    this.recognition.onstart = () => {
      logger.info('Voice recognition started');
      this.setState('listening');
    };

    this.recognition.onend = () => {
      logger.debug('Voice recognition ended');
      // Auto-restart if continuous mode is enabled
      if (this.state === 'listening' && this.config.continuous) {
        try {
          this.recognition?.start();
        } catch {
          // Already running
        }
      } else {
        this.setState('inactive');
      }
    };

    this.recognition.onerror = (event) => {
      logger.error('Voice recognition error', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.setState('error');
      }
    };

    this.recognition.onresult = (event) => {
      this.handleRecognitionResult(event);
    };
  }

  private initVoice(): void {
    if (!SpeechSynthesis) return;

    // Load voices (they may not be available immediately)
    const loadVoices = () => {
      const voices = SpeechSynthesis.getVoices();
      // Prefer a female English voice
      this.selectedVoice = voices.find(v =>
        v.lang.startsWith('en') && v.name.toLowerCase().includes('female')
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

      logger.debug('Voice selected', this.selectedVoice?.name);
    };

    loadVoices();
    SpeechSynthesis.onvoiceschanged = loadVoices;
  }

  private handleRecognitionResult(event: SpeechRecognitionEvent): void {
    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript.trim().toLowerCase();
    const confidence = result[0].confidence;
    const isFinal = result.isFinal;

    logger.debug(`Transcript: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%, final: ${isFinal})`);

    // Handle wake word if enabled
    if (this.config.wakeWordEnabled && !this.isAwake) {
      if (transcript.includes(this.config.wakeWord)) {
        this.wake();
        // Remove wake word from transcript
        const command = transcript.replace(this.config.wakeWord, '').trim();
        if (command && isFinal) {
          this.emitCommand({ transcript: command, confidence, isFinal, timestamp: Date.now() });
        }
      }
      return;
    }

    // Direct command mode (no wake word) or already awake
    if (isFinal) {
      // Filter out the wake word if it's at the start
      let command = transcript;
      if (this.config.wakeWordEnabled && transcript.startsWith(this.config.wakeWord)) {
        command = transcript.replace(this.config.wakeWord, '').trim();
      }

      if (command) {
        this.emitCommand({ transcript: command, confidence, isFinal, timestamp: Date.now() });
      }
    }
  }

  private wake(): void {
    this.isAwake = true;
    logger.info('Wake word detected - now listening for commands');

    // Clear any existing timeout
    if (this.wakeTimeout) {
      clearTimeout(this.wakeTimeout);
    }

    // Auto-sleep after 10 seconds of no commands
    this.wakeTimeout = setTimeout(() => {
      this.isAwake = false;
      logger.debug('Auto-sleep after inactivity');
    }, 10000);

    // Play a subtle acknowledgment sound or speak
    if (this.config.speakResponses) {
      this.speak('Yes?');
    }
  }

  private emitCommand(command: VoiceCommand): void {
    this.setState('processing');

    for (const handler of this.commandHandlers) {
      try {
        handler(command);
      } catch (error) {
        logger.error('Error in command handler', error);
      }
    }

    // Reset to listening after processing
    setTimeout(() => {
      if (this.state === 'processing') {
        this.setState('listening');
      }
    }, 100);
  }

  private setState(state: VoiceControlState): void {
    if (this.state === state) return;
    this.state = state;

    for (const handler of this.stateHandlers) {
      try {
        handler(state);
      } catch (error) {
        logger.error('Error in state handler', error);
      }
    }
  }

  /**
   * Start voice recognition
   */
  start(): boolean {
    if (!this.recognition) {
      logger.error('Voice recognition not available');
      return false;
    }

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      logger.error('Failed to start voice recognition', error);
      return false;
    }
  }

  /**
   * Stop voice recognition
   */
  stop(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
    if (this.wakeTimeout) {
      clearTimeout(this.wakeTimeout);
    }
    this.isAwake = false;
    this.setState('inactive');
  }

  /**
   * Speak text using speech synthesis
   */
  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!SpeechSynthesis) {
        reject(new Error('Speech synthesis not available'));
        return;
      }

      // Cancel any ongoing speech
      SpeechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.config.voiceRate;
      utterance.pitch = this.config.voicePitch;

      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }

      utterance.onstart = () => {
        this.setState('speaking');
      };

      utterance.onend = () => {
        this.setState(this.recognition?.abort ? 'listening' : 'inactive');
        resolve();
      };

      utterance.onerror = (event) => {
        logger.error('Speech synthesis error', event);
        reject(event);
      };

      SpeechSynthesis.speak(utterance);
    });
  }

  /**
   * Register a command handler
   */
  onCommand(handler: VoiceCommandHandler): () => void {
    this.commandHandlers.push(handler);
    return () => {
      const index = this.commandHandlers.indexOf(handler);
      if (index > -1) this.commandHandlers.splice(index, 1);
    };
  }

  /**
   * Register a state change handler
   */
  onStateChange(handler: VoiceStateHandler): () => void {
    this.stateHandlers.push(handler);
    return () => {
      const index = this.stateHandlers.indexOf(handler);
      if (index > -1) this.stateHandlers.splice(index, 1);
    };
  }

  /**
   * Get current state
   */
  getState(): VoiceControlState {
    return this.state;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<VoiceControlConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.recognition) {
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.lang = this.config.language;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): VoiceControlConfig {
    return { ...this.config };
  }
}

// Singleton instance
let voiceControlInstance: VoiceControlManager | null = null;

/**
 * Get the global voice control instance
 */
export function getVoiceControl(): VoiceControlManager {
  if (!voiceControlInstance) {
    voiceControlInstance = new VoiceControlManager();
  }
  return voiceControlInstance;
}

/**
 * Common robot voice commands with their interpretations
 */
export const VOICE_COMMAND_PATTERNS = {
  movement: {
    patterns: ['move', 'go', 'turn', 'rotate', 'left', 'right', 'up', 'down', 'forward', 'backward'],
    category: 'movement',
  },
  gripper: {
    patterns: ['open', 'close', 'grab', 'release', 'grip', 'pick', 'drop'],
    category: 'gripper',
  },
  preset: {
    patterns: ['home', 'reset', 'wave', 'dance', 'point', 'nod'],
    category: 'preset',
  },
  control: {
    patterns: ['stop', 'pause', 'continue', 'faster', 'slower', 'cancel'],
    category: 'control',
  },
  query: {
    patterns: ['where', 'what', 'status', 'position', 'how'],
    category: 'query',
  },
};

/**
 * Categorize a voice command
 */
export function categorizeVoiceCommand(transcript: string): string {
  const lower = transcript.toLowerCase();

  for (const [category, { patterns }] of Object.entries(VOICE_COMMAND_PATTERNS)) {
    if (patterns.some(pattern => lower.includes(pattern))) {
      return category;
    }
  }

  return 'unknown';
}

// Add TypeScript types for Web Speech API (not fully typed in lib.dom.d.ts)
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
