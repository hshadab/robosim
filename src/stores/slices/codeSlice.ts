/**
 * Code Editor State Slice
 *
 * Manages code editor state, console messages, and code execution status.
 * This slice has no dependencies on other slices.
 */

import type { StateCreator } from 'zustand';
import type { CodeState, ConsoleMessage, ConsoleMessageType } from '../../types';
import { DEFAULT_ROBOT_ID, getDefaultCode } from '../../config/robots';
import { generateSecureId } from '../../lib/crypto';
import { CONSOLE_CONFIG } from '../../lib/config';

export interface CodeSliceState {
  code: CodeState;
  consoleMessages: ConsoleMessage[];
  isCodeRunning: boolean;
}

export interface CodeSliceActions {
  setCode: (code: Partial<CodeState>) => void;
  addConsoleMessage: (type: ConsoleMessageType, message: string) => void;
  clearConsole: () => void;
  setCodeRunning: (running: boolean) => void;
}

export type CodeSlice = CodeSliceState & CodeSliceActions;

export const getDefaultCodeState = (): CodeSliceState => ({
  code: {
    source: getDefaultCode(DEFAULT_ROBOT_ID),
    language: 'javascript',
    isCompiling: false,
    isGenerated: false,
  },
  consoleMessages: [],
  isCodeRunning: false,
});

export const createCodeSlice: StateCreator<
  CodeSlice,
  [],
  [],
  CodeSlice
> = (set) => ({
  ...getDefaultCodeState(),

  setCode: (code: Partial<CodeState>) =>
    set((state) => ({
      code: { ...state.code, ...code },
    })),

  addConsoleMessage: (type: ConsoleMessageType, message: string) => {
    const newMessage: ConsoleMessage = {
      id: generateSecureId('console'),
      type,
      message,
      timestamp: new Date(),
    };
    set((state) => ({
      consoleMessages: [...state.consoleMessages, newMessage].slice(-CONSOLE_CONFIG.MAX_MESSAGES),
    }));
  },

  clearConsole: () => {
    set({ consoleMessages: [] });
  },

  setCodeRunning: (running: boolean) => {
    set({ isCodeRunning: running });
  },
});
