import React from 'react';
import { Bot, User } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-600' : 'bg-slate-700'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-blue-400" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : isError
              ? 'bg-red-900/50 text-red-200 border border-red-700/50 rounded-bl-sm'
              : 'bg-slate-700 text-slate-200 rounded-bl-sm'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>

        {/* Code block if generated */}
        {message.codeGenerated && (
          <div className="mt-2 p-2 bg-slate-900/50 rounded-lg">
            <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
              {message.codeGenerated.slice(0, 200)}
              {message.codeGenerated.length > 200 && '...'}
            </pre>
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-[10px] mt-1 ${
            isUser ? 'text-blue-200' : 'text-slate-500'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
};
