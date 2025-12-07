/**
 * Code Copilot Hook for Monaco Editor
 *
 * Provides AI-powered code completion and assistance.
 */

import { useCallback, useRef, useEffect } from 'react';
import type { editor, Position, languages } from 'monaco-editor';
import {
  getCompletions,
  generateCodeFromComment,
  explainCode,
  suggestFix,
  type CompletionResult,
} from '../lib/codeCopilot';
import { useAppStore } from '../stores/useAppStore';

interface UseCodeCopilotOptions {
  enabled?: boolean;
}

export function useCodeCopilot(options: UseCodeCopilotOptions = {}) {
  const { enabled = true } = options;
  const { addConsoleMessage } = useAppStore();
  const disposablesRef = useRef<Array<{ dispose: () => void }>>([]);

  /**
   * Register completion provider with Monaco
   */
  const registerCompletionProvider = useCallback(
    (monaco: typeof import('monaco-editor')) => {
      if (!enabled) return;

      const provider: languages.CompletionItemProvider = {
        triggerCharacters: ['.', '(', "'", '"'],

        provideCompletionItems: (
          model: editor.ITextModel,
          position: Position
        ): languages.ProviderResult<languages.CompletionList> => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const line = model.getLineContent(position.lineNumber);
          const prefix = line.substring(0, position.column - 1);

          const completions = getCompletions({
            code: textUntilPosition,
            cursorPosition: {
              lineNumber: position.lineNumber,
              column: position.column,
            },
            language: 'javascript',
            prefix,
            suffix: line.substring(position.column - 1),
          });

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions: languages.CompletionItem[] = completions.map(
            (c: CompletionResult, index: number) => ({
              label: c.displayText,
              kind: getCompletionKind(monaco, c.kind),
              insertText: c.insertText,
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: c.documentation,
              range,
              sortText: String(index).padStart(5, '0'),
            })
          );

          return { suggestions };
        },
      };

      const disposable = monaco.languages.registerCompletionItemProvider(
        'javascript',
        provider
      );
      disposablesRef.current.push(disposable);

      return disposable;
    },
    [enabled]
  );

  /**
   * Generate code from a comment
   */
  const generateFromComment = useCallback(
    async (
      editor: editor.IStandaloneCodeEditor,
      monaco: typeof import('monaco-editor')
    ) => {
      const position = editor.getPosition();
      if (!position) return;

      const model = editor.getModel();
      if (!model) return;

      const line = model.getLineContent(position.lineNumber);

      // Check if current line is a comment
      if (!line.trim().startsWith('//')) {
        addConsoleMessage('info', 'Place cursor on a comment line to generate code');
        return;
      }

      const comment = line.replace(/^[\s]*\/\/\s*/, '').trim();
      if (!comment) return;

      addConsoleMessage('info', `Generating code for: "${comment}"`);

      try {
        const generatedCode = await generateCodeFromComment(comment);

        // Insert generated code after the comment
        const range = new monaco.Range(
          position.lineNumber,
          1,
          position.lineNumber,
          line.length + 1
        );

        const newText = line + '\n' + generatedCode;

        editor.executeEdits('code-copilot', [
          {
            range,
            text: newText,
          },
        ]);

        addConsoleMessage('info', 'Code generated successfully');
      } catch (error) {
        addConsoleMessage(
          'error',
          `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [addConsoleMessage]
  );

  /**
   * Explain selected code
   */
  const explainSelected = useCallback(
    async (editor: editor.IStandaloneCodeEditor) => {
      const selection = editor.getSelection();
      if (!selection) return;

      const model = editor.getModel();
      if (!model) return;

      const selectedText = model.getValueInRange(selection);
      if (!selectedText.trim()) {
        addConsoleMessage('info', 'Select some code to explain');
        return;
      }

      addConsoleMessage('info', 'Analyzing code...');

      try {
        const explanation = await explainCode(selectedText);
        addConsoleMessage('info', explanation.explanation);
      } catch (error) {
        addConsoleMessage(
          'error',
          `Explanation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [addConsoleMessage]
  );

  /**
   * Suggest fix for an error
   */
  const suggestErrorFix = useCallback(
    async (
      editor: editor.IStandaloneCodeEditor,
      errorMessage: string,
      monaco: typeof import('monaco-editor')
    ) => {
      const model = editor.getModel();
      if (!model) return;

      const code = model.getValue();
      addConsoleMessage('info', 'Analyzing error...');

      try {
        const fix = await suggestFix(code, errorMessage);
        if (fix) {
          addConsoleMessage('info', `Suggestion: ${fix.description}`);
          addConsoleMessage('info', fix.explanation);

          // Offer to apply the fix
          if (fix.fixedCode !== code) {
            // Create a marker to show the fix is available
            const fullRange = model.getFullModelRange();
            editor.executeEdits('code-copilot-fix', [
              {
                range: fullRange,
                text: fix.fixedCode,
              },
            ]);
            addConsoleMessage('info', 'Fix applied');
          }
        } else {
          addConsoleMessage('warn', 'Could not suggest a fix for this error');
        }
      } catch (error) {
        addConsoleMessage(
          'error',
          `Fix suggestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [addConsoleMessage]
  );

  /**
   * Register keyboard shortcuts
   */
  const registerKeyboardShortcuts = useCallback(
    (
      editor: editor.IStandaloneCodeEditor,
      monaco: typeof import('monaco-editor')
    ) => {
      // Ctrl/Cmd + Shift + G: Generate code from comment
      editor.addAction({
        id: 'copilot-generate',
        label: 'Generate Code from Comment',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyG,
        ],
        run: (ed) => generateFromComment(ed, monaco),
      });

      // Ctrl/Cmd + Shift + E: Explain selected code
      editor.addAction({
        id: 'copilot-explain',
        label: 'Explain Selected Code',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
        ],
        run: explainSelected,
      });
    },
    [generateFromComment, explainSelected]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  return {
    registerCompletionProvider,
    registerKeyboardShortcuts,
    generateFromComment,
    explainSelected,
    suggestErrorFix,
  };
}

/**
 * Convert our completion kind to Monaco's
 */
function getCompletionKind(
  monaco: typeof import('monaco-editor'),
  kind: CompletionResult['kind']
): languages.CompletionItemKind {
  switch (kind) {
    case 'function':
      return monaco.languages.CompletionItemKind.Function;
    case 'variable':
      return monaco.languages.CompletionItemKind.Variable;
    case 'snippet':
      return monaco.languages.CompletionItemKind.Snippet;
    case 'keyword':
      return monaco.languages.CompletionItemKind.Keyword;
    default:
      return monaco.languages.CompletionItemKind.Text;
  }
}
