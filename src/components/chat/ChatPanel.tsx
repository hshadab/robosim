import React, { useRef, useEffect } from 'react';
import { MessageCircle, Trash2, Sparkles } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickPrompts } from './QuickPrompts';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { useLLMChat } from '../../hooks/useLLMChat';

export const ChatPanel: React.FC = () => {
  const { messages, isLLMLoading, clearMessages, isAnimating } = useAppStore();
  const { sendMessage } = useLLMChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (message: string) => {
    sendMessage(message);
  };

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-300">
            AI Assistant
          </span>
          <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Claude
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearMessages}
          title="Clear Chat"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Loading indicator */}
        {isLLMLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
            </div>
            <div className="bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <QuickPrompts
        onSelect={handleQuickPrompt}
        disabled={isLLMLoading || isAnimating}
      />

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLLMLoading || isAnimating} />
    </div>
  );
};
