/**
 * Chat State Slice
 *
 * Manages chat messages and LLM loading state.
 * This slice has no dependencies on other slices.
 */

import type { StateCreator } from 'zustand';
import type { ChatMessage } from '../../types';

export interface ChatSliceState {
  messages: ChatMessage[];
  isLLMLoading: boolean;
}

export interface ChatSliceActions {
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setLLMLoading: (loading: boolean) => void;
}

export type ChatSlice = ChatSliceState & ChatSliceActions;

export const getDefaultChatState = (): ChatSliceState => ({
  messages: [
    {
      id: '1',
      role: 'assistant',
      content:
        "Hi! I'm your RoboSim AI assistant. Tell me what you want your robot to do in plain English, and I'll generate the code and run the simulation!",
      timestamp: new Date(),
    },
  ],
  isLLMLoading: false,
});

export const createChatSlice: StateCreator<
  ChatSlice,
  [],
  [],
  ChatSlice
> = (set) => ({
  ...getDefaultChatState(),

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: Date.now().toString(),
          timestamp: new Date(),
        },
      ],
    })),

  clearMessages: () =>
    set({
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: "Chat cleared. How can I help you with your robot?",
          timestamp: new Date(),
        },
      ],
    }),

  setLLMLoading: (loading: boolean) => set({ isLLMLoading: loading }),
});
