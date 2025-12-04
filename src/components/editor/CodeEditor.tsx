import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Code, Copy, Check, Play, Square, FileCode, ChevronDown } from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { runCode, stopProgram, validateCode } from '../../lib/codeRunner';
import { CODE_TEMPLATES, type CodeTemplate } from '../../config/codeTemplates';

export const CodeEditor: React.FC = () => {
  const {
    code,
    setCode,
    skillLevel,
    isCodeRunning,
    setCodeRunning,
    addConsoleMessage,
    clearConsole,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const isReadOnly = skillLevel === 'prompter' || skillLevel === 'reader';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && !isReadOnly) {
      setCode({ source: value, isGenerated: false });
    }
  };

  const handleRun = async () => {
    // Validate code first
    const validation = validateCode(code.source);
    if (!validation.valid) {
      addConsoleMessage('error', `Syntax Error: ${validation.error}`);
      return;
    }

    // Clear console and run
    clearConsole();
    setCodeRunning(true);

    await runCode(code.source, {
      onConsoleMessage: (msg) => {
        addConsoleMessage(msg.type, msg.message);
      },
      onStart: () => {
        addConsoleMessage('info', 'Program started...');
      },
      onComplete: () => {
        setCodeRunning(false);
      },
      onError: () => {
        setCodeRunning(false);
      },
      onStop: () => {
        setCodeRunning(false);
      },
    });
  };

  const handleStop = () => {
    stopProgram();
    setCodeRunning(false);
  };

  const handleSelectTemplate = (template: CodeTemplate) => {
    setCode({ source: template.code, isGenerated: false });
    setShowTemplates(false);
    addConsoleMessage('info', `Loaded template: ${template.name}`);
  };

  // Group templates by category
  const basicTemplates = CODE_TEMPLATES.filter(t => t.category === 'basic');
  const intermediateTemplates = CODE_TEMPLATES.filter(t => t.category === 'intermediate');
  const advancedTemplates = CODE_TEMPLATES.filter(t => t.category === 'advanced');

  return (
    <div className="flex flex-col h-full bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-300">
            JavaScript
          </span>
          {code.isGenerated && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              AI Generated
            </span>
          )}
          {isReadOnly && (
            <span className="text-xs bg-slate-600/50 text-slate-400 px-2 py-0.5 rounded-full">
              Read Only
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Template Dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              title="Load Template"
            >
              <FileCode className="w-4 h-4" />
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>

            {showTemplates && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowTemplates(false)}
                />
                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto">
                  {/* Basic */}
                  <div className="p-2 border-b border-slate-700">
                    <div className="text-xs font-semibold text-slate-400 mb-1">Basic</div>
                    {basicTemplates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-sm"
                      >
                        <div className="text-slate-200">{t.name}</div>
                        <div className="text-xs text-slate-500">{t.description}</div>
                      </button>
                    ))}
                  </div>
                  {/* Intermediate */}
                  <div className="p-2 border-b border-slate-700">
                    <div className="text-xs font-semibold text-slate-400 mb-1">Intermediate</div>
                    {intermediateTemplates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-sm"
                      >
                        <div className="text-slate-200">{t.name}</div>
                        <div className="text-xs text-slate-500">{t.description}</div>
                      </button>
                    ))}
                  </div>
                  {/* Advanced */}
                  <div className="p-2">
                    <div className="text-xs font-semibold text-slate-400 mb-1">Advanced</div>
                    {advancedTemplates.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 text-sm"
                      >
                        <div className="text-slate-200">{t.name}</div>
                        <div className="text-xs text-slate-500">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            title="Copy Code"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>

          {/* Run/Stop Button */}
          {isCodeRunning ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStop}
              title="Stop Program"
              className="bg-red-600 hover:bg-red-700"
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleRun}
              title="Run Program"
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="w-4 h-4 mr-1" />
              Run
            </Button>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language="javascript"
          value={code.source}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            readOnly: isReadOnly || isCodeRunning,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
          }}
        />
      </div>

      {/* Status Bar */}
      {isCodeRunning && (
        <div className="px-3 py-2 bg-green-900/30 border-t border-green-700/50">
          <div className="text-xs text-green-400 flex items-center gap-2">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Running...
          </div>
        </div>
      )}

      {code.compileError && (
        <div className="px-3 py-2 bg-red-900/30 border-t border-red-700/50">
          <div className="text-xs text-red-400 font-mono">{code.compileError}</div>
        </div>
      )}
    </div>
  );
};
