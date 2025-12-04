import React, { useRef, useEffect } from 'react';
import { Terminal, Trash2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import type { ConsoleMessageType } from '../../types';

const getMessageIcon = (type: ConsoleMessageType) => {
  switch (type) {
    case 'error':
      return <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />;
    case 'warn':
      return <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />;
    case 'info':
      return <Info className="w-3 h-3 text-blue-400 flex-shrink-0" />;
    default:
      return null;
  }
};

const getMessageClass = (type: ConsoleMessageType) => {
  switch (type) {
    case 'error':
      return 'text-red-400 bg-red-900/20';
    case 'warn':
      return 'text-yellow-400 bg-yellow-900/20';
    case 'info':
      return 'text-blue-400 bg-blue-900/20';
    default:
      return 'text-slate-300';
  }
};

export const ConsolePanel: React.FC = () => {
  const { consoleMessages, clearConsole } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleMessages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/80 rounded-lg border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-slate-300">Console</span>
          {consoleMessages.length > 0 && (
            <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
              {consoleMessages.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearConsole}
          title="Clear Console"
          disabled={consoleMessages.length === 0}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-1"
      >
        {consoleMessages.length === 0 ? (
          <div className="text-slate-500 text-center py-4">
            Console output will appear here...
          </div>
        ) : (
          consoleMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2 px-2 py-1 rounded ${getMessageClass(msg.type)}`}
            >
              {getMessageIcon(msg.type)}
              <span className="text-slate-500 flex-shrink-0">
                [{formatTime(msg.timestamp)}]
              </span>
              <span className="whitespace-pre-wrap break-all">{msg.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
