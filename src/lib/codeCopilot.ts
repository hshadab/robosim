/**
 * Code Copilot for RoboSim
 *
 * Provides AI-powered code completion and suggestions in the Monaco editor.
 * Features:
 * - Inline code completions
 * - Robot API autocomplete
 * - Code explanation
 * - Error fixing suggestions
 * - Code generation from comments
 */

import { getClaudeApiKey } from './claudeApi';
import { CODE_TEMPLATES } from '../config/codeTemplates';
import { createLogger } from './logger';

const logger = createLogger('CodeCopilot');

export interface CompletionRequest {
  code: string;
  cursorPosition: { lineNumber: number; column: number };
  language: string;
  prefix: string;  // Code before cursor
  suffix: string;  // Code after cursor
}

export interface CompletionResult {
  text: string;
  displayText: string;
  documentation?: string;
  kind: 'function' | 'variable' | 'snippet' | 'keyword';
  insertText: string;
}

export interface ExplanationResult {
  explanation: string;
  codeBlocks: Array<{ code: string; description: string }>;
}

export interface FixSuggestion {
  description: string;
  fixedCode: string;
  explanation: string;
}

// Robot API definitions for autocomplete
const ROBOT_API_COMPLETIONS: CompletionResult[] = [
  // Movement
  {
    text: 'moveJoint',
    displayText: 'moveJoint(joint, angle)',
    documentation: 'Move a specific joint to an angle. Joints: base, shoulder, elbow, wrist, wristRoll',
    kind: 'function',
    insertText: "moveJoint('${1:joint}', ${2:angle})",
  },
  {
    text: 'goHome',
    displayText: 'goHome()',
    documentation: 'Move the robot to its home/neutral position',
    kind: 'function',
    insertText: 'goHome()',
  },
  {
    text: 'forward',
    displayText: 'forward(speed)',
    documentation: 'Move wheeled robot forward at specified speed (0-255)',
    kind: 'function',
    insertText: 'forward(${1:150})',
  },
  {
    text: 'backward',
    displayText: 'backward(speed)',
    documentation: 'Move wheeled robot backward at specified speed (0-255)',
    kind: 'function',
    insertText: 'backward(${1:150})',
  },
  {
    text: 'turnLeft',
    displayText: 'turnLeft(speed)',
    documentation: 'Turn wheeled robot left at specified speed',
    kind: 'function',
    insertText: 'turnLeft(${1:100})',
  },
  {
    text: 'turnRight',
    displayText: 'turnRight(speed)',
    documentation: 'Turn wheeled robot right at specified speed',
    kind: 'function',
    insertText: 'turnRight(${1:100})',
  },
  {
    text: 'stop',
    displayText: 'stop()',
    documentation: 'Stop all motors',
    kind: 'function',
    insertText: 'stop()',
  },
  // Gripper
  {
    text: 'openGripper',
    displayText: 'openGripper()',
    documentation: 'Fully open the gripper',
    kind: 'function',
    insertText: 'openGripper()',
  },
  {
    text: 'closeGripper',
    displayText: 'closeGripper()',
    documentation: 'Fully close the gripper',
    kind: 'function',
    insertText: 'closeGripper()',
  },
  {
    text: 'setGripper',
    displayText: 'setGripper(percentage)',
    documentation: 'Set gripper to a specific opening (0-100%)',
    kind: 'function',
    insertText: 'setGripper(${1:50})',
  },
  // Utilities
  {
    text: 'wait',
    displayText: 'wait(ms)',
    documentation: 'Wait for specified milliseconds',
    kind: 'function',
    insertText: 'await wait(${1:1000})',
  },
  {
    text: 'print',
    displayText: 'print(message)',
    documentation: 'Print a message to the console',
    kind: 'function',
    insertText: "print('${1:message}')",
  },
  {
    text: 'getDistance',
    displayText: 'getDistance()',
    documentation: 'Get ultrasonic sensor distance reading in cm',
    kind: 'function',
    insertText: 'getDistance()',
  },
  {
    text: 'getIRLeft',
    displayText: 'getIRLeft()',
    documentation: 'Get left IR sensor reading',
    kind: 'function',
    insertText: 'getIRLeft()',
  },
  {
    text: 'getIRRight',
    displayText: 'getIRRight()',
    documentation: 'Get right IR sensor reading',
    kind: 'function',
    insertText: 'getIRRight()',
  },
  // Drone
  {
    text: 'arm',
    displayText: 'arm()',
    documentation: 'Arm the drone motors',
    kind: 'function',
    insertText: 'arm()',
  },
  {
    text: 'disarm',
    displayText: 'disarm()',
    documentation: 'Disarm the drone motors',
    kind: 'function',
    insertText: 'disarm()',
  },
  {
    text: 'takeoff',
    displayText: 'takeoff(height)',
    documentation: 'Take off to specified height in meters',
    kind: 'function',
    insertText: 'takeoff(${1:0.5})',
  },
  {
    text: 'land',
    displayText: 'land()',
    documentation: 'Land the drone',
    kind: 'function',
    insertText: 'land()',
  },
  // Variables
  {
    text: 'robot',
    displayText: 'robot',
    documentation: 'The robot object with all control methods',
    kind: 'variable',
    insertText: 'robot',
  },
];

// Common code patterns for smart completion
const CODE_PATTERNS = [
  {
    trigger: 'for loop',
    template: 'for (let i = 0; i < ${1:count}; i++) {\n  ${2:// code}\n}',
  },
  {
    trigger: 'async function',
    template: 'async function ${1:name}() {\n  ${2:// code}\n}',
  },
  {
    trigger: 'pick and place',
    template: `// Pick and place sequence
await openGripper();
await moveJoint('shoulder', -20);
await wait(500);
await closeGripper();
await wait(300);
await moveJoint('shoulder', 30);
await openGripper();`,
  },
  {
    trigger: 'wave animation',
    template: `// Wave animation
await moveJoint('shoulder', 50);
await moveJoint('elbow', -60);
for (let i = 0; i < 3; i++) {
  await moveJoint('wrist', 30);
  await wait(200);
  await moveJoint('wrist', -30);
  await wait(200);
}
await goHome();`,
  },
  {
    trigger: 'line following',
    template: `// Line following
while (true) {
  const left = getIRLeft();
  const right = getIRRight();

  if (left && right) {
    forward(150);
  } else if (left) {
    turnRight(100);
  } else if (right) {
    turnLeft(100);
  } else {
    stop();
    break;
  }
  await wait(50);
}`,
  },
];

/**
 * Get code completions at cursor position
 */
export function getCompletions(request: CompletionRequest): CompletionResult[] {
  const { prefix } = request;
  const lastWord = getLastWord(prefix);

  if (!lastWord || lastWord.length < 1) {
    return [];
  }

  // Filter API completions by prefix
  const apiMatches = ROBOT_API_COMPLETIONS.filter(c =>
    c.text.toLowerCase().startsWith(lastWord.toLowerCase())
  );

  // Check for pattern matches
  const patternMatches = CODE_PATTERNS
    .filter(p => p.trigger.toLowerCase().includes(lastWord.toLowerCase()))
    .map(p => ({
      text: p.trigger,
      displayText: p.trigger,
      documentation: 'Code template',
      kind: 'snippet' as const,
      insertText: p.template,
    }));

  return [...apiMatches, ...patternMatches];
}

/**
 * Get the last word being typed
 */
function getLastWord(text: string): string {
  const match = text.match(/[\w.]+$/);
  return match ? match[0] : '';
}

/**
 * Generate code from a natural language comment
 */
export async function generateCodeFromComment(comment: string): Promise<string> {
  const apiKey = getClaudeApiKey();

  // First, try to match against templates
  const commentLower = comment.toLowerCase();
  for (const template of CODE_TEMPLATES) {
    if (template.description.toLowerCase().includes(commentLower) ||
        commentLower.includes(template.name.toLowerCase())) {
      return template.code;
    }
  }

  // Check code patterns
  for (const pattern of CODE_PATTERNS) {
    if (commentLower.includes(pattern.trigger.toLowerCase())) {
      return pattern.template;
    }
  }

  // If no API key, return a simple template
  if (!apiKey) {
    return generateLocalCode(comment);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: `You are a code assistant for a robotics simulation. Generate JavaScript code using these APIs:

Robot Arm:
- moveJoint(joint, angle) - joints: 'base', 'shoulder', 'elbow', 'wrist', 'wristRoll'
- openGripper(), closeGripper(), setGripper(percent)
- goHome()

Wheeled Robot:
- forward(speed), backward(speed), turnLeft(speed), turnRight(speed)
- stop()
- getDistance(), getIRLeft(), getIRRight()

Utilities:
- await wait(ms) - wait milliseconds
- print(message) - print to console

Generate ONLY the code, no explanations. Use async/await.`,
        messages: [
          {
            role: 'user',
            content: `Generate code for: ${comment}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    const generatedCode = data.content[0]?.text || '';

    // Clean up the response (remove markdown code blocks if present)
    return generatedCode
      .replace(/```javascript\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  } catch (error) {
    logger.error('Code generation failed', error);
    return generateLocalCode(comment);
  }
}

/**
 * Generate code locally without API
 */
function generateLocalCode(comment: string): string {
  const lower = comment.toLowerCase();

  if (lower.includes('wave') || lower.includes('hello')) {
    return CODE_PATTERNS.find(p => p.trigger === 'wave animation')?.template || '';
  }
  if (lower.includes('pick') || lower.includes('place') || lower.includes('grab')) {
    return CODE_PATTERNS.find(p => p.trigger === 'pick and place')?.template || '';
  }
  if (lower.includes('line') && lower.includes('follow')) {
    return CODE_PATTERNS.find(p => p.trigger === 'line following')?.template || '';
  }
  if (lower.includes('forward') || lower.includes('move')) {
    return 'forward(150);\nawait wait(2000);\nstop();';
  }
  if (lower.includes('rotate') || lower.includes('turn')) {
    return "moveJoint('base', 45);\nawait wait(500);";
  }
  if (lower.includes('open')) {
    return 'openGripper();';
  }
  if (lower.includes('close')) {
    return 'closeGripper();';
  }
  if (lower.includes('home') || lower.includes('reset')) {
    return 'goHome();';
  }

  return '// Unable to generate code for this request\n// Try: "pick up object", "wave hello", "line following"';
}

/**
 * Explain what a piece of code does
 */
export async function explainCode(code: string): Promise<ExplanationResult> {
  const apiKey = getClaudeApiKey();

  if (!apiKey) {
    return explainCodeLocally(code);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Explain this robotics code briefly. Focus on what the robot will do physically:

\`\`\`javascript
${code}
\`\`\`

Keep the explanation concise and beginner-friendly.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    const explanation = data.content[0]?.text || '';

    return {
      explanation,
      codeBlocks: [],
    };
  } catch (error) {
    logger.error('Code explanation failed', error);
    return explainCodeLocally(code);
  }
}

/**
 * Explain code without API
 */
function explainCodeLocally(code: string): ExplanationResult {
  const lines = code.split('\n').filter(l => l.trim());
  const explanations: string[] = [];

  for (const line of lines) {
    if (line.includes('moveJoint')) {
      const match = line.match(/moveJoint\(['"](\w+)['"],\s*(-?\d+)/);
      if (match) {
        explanations.push(`Move the ${match[1]} joint to ${match[2]} degrees`);
      }
    } else if (line.includes('openGripper')) {
      explanations.push('Open the gripper fully');
    } else if (line.includes('closeGripper')) {
      explanations.push('Close the gripper to grip an object');
    } else if (line.includes('goHome')) {
      explanations.push('Return to the home/neutral position');
    } else if (line.includes('forward')) {
      explanations.push('Move the robot forward');
    } else if (line.includes('backward')) {
      explanations.push('Move the robot backward');
    } else if (line.includes('wait')) {
      const match = line.match(/wait\((\d+)/);
      if (match) {
        explanations.push(`Wait ${parseInt(match[1]) / 1000} seconds`);
      }
    } else if (line.includes('for') || line.includes('while')) {
      explanations.push('Repeat the following actions');
    }
  }

  return {
    explanation: explanations.length > 0
      ? 'This code will:\n' + explanations.map((e, i) => `${i + 1}. ${e}`).join('\n')
      : 'This code controls the robot. Add more specific API calls to see detailed explanations.',
    codeBlocks: [],
  };
}

/**
 * Suggest a fix for a code error
 */
export async function suggestFix(
  code: string,
  error: string
): Promise<FixSuggestion | null> {
  const apiKey = getClaudeApiKey();

  // Common fixes without API
  if (error.includes('await')) {
    return {
      description: 'Add async keyword to function',
      fixedCode: code.replace(/function\s+(\w+)\s*\(/g, 'async function $1('),
      explanation: 'Robot control functions like wait() require async/await.',
    };
  }

  if (error.includes('is not defined')) {
    const match = error.match(/(\w+) is not defined/);
    if (match) {
      const varName = match[1];
      if (['moveJoint', 'openGripper', 'closeGripper', 'goHome', 'wait', 'forward', 'backward'].includes(varName)) {
        return {
          description: `${varName} is a robot API function`,
          fixedCode: code,
          explanation: `The function ${varName} is provided by the robot API. Make sure you're running the code in the simulator.`,
        };
      }
    }
  }

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Fix this robotics code error:

Code:
\`\`\`javascript
${code}
\`\`\`

Error: ${error}

Respond with:
1. Brief description of the fix
2. The corrected code
3. One-sentence explanation`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    // Parse the response (simple extraction)
    const codeMatch = content.match(/```(?:javascript)?\n?([\s\S]*?)```/);
    const fixedCode = codeMatch ? codeMatch[1].trim() : code;

    return {
      description: content.split('\n')[0] || 'Code fixed',
      fixedCode,
      explanation: content.split('\n').pop() || '',
    };
  } catch (error) {
    logger.error('Fix suggestion failed', error);
    return null;
  }
}

/**
 * Get inline completion suggestion
 */
export async function getInlineCompletion(
  code: string,
  cursorLine: string
): Promise<string | null> {
  // Check if typing a comment that describes code
  if (cursorLine.trim().startsWith('//')) {
    const comment = cursorLine.replace(/^\/\/\s*/, '').trim();
    if (comment.length > 3) {
      // Could generate code based on comment
      return null; // Let user explicitly request generation
    }
  }

  // Check for partial function calls
  const lastWord = getLastWord(cursorLine);
  const matches = ROBOT_API_COMPLETIONS.filter(c =>
    c.text.toLowerCase().startsWith(lastWord.toLowerCase()) && c.text !== lastWord
  );

  if (matches.length === 1) {
    // Single match - could show inline ghost text
    const completion = matches[0];
    return completion.text.slice(lastWord.length);
  }

  return null;
}
