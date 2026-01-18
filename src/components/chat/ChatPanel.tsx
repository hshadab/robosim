import React, { useRef, useEffect, useState } from 'react';
import { MessageCircle, Trash2, Sparkles, Key, Check, Radio, ListChecks, AlertCircle, Lightbulb } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickPrompts } from './QuickPrompts';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { useLLMChat } from '../../hooks/useLLMChat';
import { getClaudeApiKey, setClaudeApiKey } from '../../lib/claudeApi';
import { useRobotContext } from '../../hooks/useRobotContext';
import { eventToMessage } from '../../lib/semanticState';
import { getActivePlan, getPlanProgress, getCurrentStep } from '../../lib/taskPlanner';
import { getRecentFailures, FAILURE_CATEGORIES } from '../../lib/failureAnalysis';
import { getFeedbackSummary } from '../../lib/gripperFeedback';

export const ChatPanel: React.FC = () => {
  const { messages, isLLMLoading, clearMessages, isAnimating, addMessage } = useAppStore();
  const { sendMessage } = useLLMChat();
  const { subscribeToAllEvents, isMoving, getBriefStatus } = useRobotContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasApiKey, setHasApiKey] = useState(!!getClaudeApiKey());
  const [showApiInput, setShowApiInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [robotStatus, setRobotStatus] = useState<string>('');
  const [activePlan, setActivePlan] = useState(getActivePlan());
  const [lastFailure, setLastFailure] = useState<ReturnType<typeof getRecentFailures>[0] | null>(null);

  // Update active plan periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setActivePlan(getActivePlan());
      const failures = getRecentFailures(1);
      if (failures.length > 0) {
        setLastFailure(failures[0]);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to robot events and show important ones in chat
  useEffect(() => {
    const unsubscribe = subscribeToAllEvents((event) => {
      // Filter to important events that should show in chat
      const chatEvents = [
        'task_completed',
        'task_failed',
        'collision_detected',
        'error',
        'object_grasped',
        'object_released',
      ];

      if (chatEvents.includes(event.type)) {
        const content = eventToMessage(event);
        addMessage({
          role: 'system',
          content,
        });
      }
    });

    return unsubscribe;
  }, [subscribeToAllEvents, addMessage]);

  // Update robot status periodically
  useEffect(() => {
    const updateStatus = () => {
      setRobotStatus(getBriefStatus());
    };
    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, [getBriefStatus]);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setClaudeApiKey(apiKeyInput.trim());
      setHasApiKey(true);
      setShowApiInput(false);
      setApiKeyInput('');
    }
  };

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
          <button
            onClick={() => setShowApiInput(!showApiInput)}
            className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 transition ${
              hasApiKey
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
            }`}
            title={hasApiKey ? 'Claude API connected' : 'Click to add API key'}
          >
            {hasApiKey ? <Check className="w-3 h-3" /> : <Key className="w-3 h-3" />}
            {hasApiKey ? 'Claude' : 'Demo'}
          </button>
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

      {/* Robot Status Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700/30 bg-slate-900/50 text-xs">
        <Radio className={`w-3 h-3 ${isMoving ? 'text-green-400 animate-pulse' : 'text-slate-500'}`} />
        <span className={`${isMoving ? 'text-green-400' : 'text-slate-500'}`}>
          {robotStatus || 'Connecting...'}
        </span>
      </div>

      {/* Task Progress Bar */}
      {activePlan && activePlan.status !== 'completed' && activePlan.status !== 'failed' && (
        <div className="px-3 py-2 border-b border-slate-700/30 bg-purple-900/20">
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-purple-300 flex-1 truncate">
              {activePlan.description}
            </span>
            <span className="text-xs text-purple-400">
              {getPlanProgress(activePlan).percentage}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${getPlanProgress(activePlan).percentage}%` }}
            />
          </div>
          {getCurrentStep(activePlan) && (
            <div className="text-[10px] text-slate-400 mt-1">
              Step {activePlan.currentStepIndex + 1}/{activePlan.steps.length}: {getCurrentStep(activePlan)?.description}
            </div>
          )}
        </div>
      )}

      {/* Recent Failure Explanation */}
      {lastFailure && Date.now() - lastFailure.timestamp < 30000 && (
        <div className="px-3 py-2 border-b border-slate-700/30 bg-red-900/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-red-300">
                {lastFailure.category.replace(/_/g, ' ')}
              </div>
              {FAILURE_CATEGORIES[lastFailure.category] && (
                <div className="flex items-start gap-1 mt-1">
                  <Lightbulb className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[10px] text-amber-300">
                    {FAILURE_CATEGORIES[lastFailure.category].suggestedFix}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setLastFailure(null)}
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* API Key Input */}
      {showApiInput && (
        <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-900/50">
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter Claude API key (sk-ant-...)"
              className="flex-1 px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
            />
            <Button variant="primary" size="sm" onClick={handleSaveApiKey}>
              Save
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {hasApiKey ? 'API key configured. Enter new key to update.' : 'Add your API key for real Claude responses.'}
          </p>
        </div>
      )}

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
