const OLLAMA_URL = (import.meta as any).env?.VITE_OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = (import.meta as any).env?.VITE_OLLAMA_MODEL ?? 'llama3.2';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function ollamaChat(messages: OllamaMessage[], jsonMode = false): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      ...(jsonMode && { format: 'json' }),
    }),
  });
  if (!response.ok) throw new Error(`Ollama error ${response.status}: ${response.statusText}`);
  const data = await response.json();
  const content = data.message?.content;
  if (!content) throw new Error('Empty response from Ollama');
  return content;
}

export async function enhanceTask(title: string, description: string) {
  const content = await ollamaChat([
    {
      role: 'system',
      content:
        'You are a high-performance task optimizer. Always respond with valid JSON only — no markdown fences, no prose outside the JSON object.',
    },
    {
      role: 'user',
      content: `Enhance this task for maximum clarity and actionability.

Task Title: ${title}
Task Description: ${description}

Return a single JSON object with exactly these keys:
{
  "enhancedTitle": "string",
  "enhancedDescription": "string",
  "subtasks": ["string"],
  "potentialRisks": ["string"],
  "suggestedPriority": "low" | "medium" | "high",
  "definitionOfDone": "string",
  "aiThinking": "string"
}`,
    },
  ], true);

  try {
    return JSON.parse(content);
  } catch {
    // Strip possible markdown fences if model ignores the instruction
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  }
}

export async function refineTaskToSMART(title: string, description: string) {
  const content = await ollamaChat([
    {
      role: 'system',
      content:
        'You are a project management consultant. Always respond with valid JSON only — no markdown fences, no prose outside the JSON object.',
    },
    {
      role: 'user',
      content: `Transform this task into a SMART unit (Specific, Measurable, Achievable, Relevant, Time-bound).

Task Title: ${title}
Task Description: ${description}

Return a single JSON object with exactly these keys:
{
  "smartTitle": "string",
  "smartDescription": "string",
  "logic": "string"
}`,
    },
  ], true);

  try {
    return JSON.parse(content);
  } catch {
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  }
}

export async function summarizeProjectProgress(projectData: unknown) {
  return ollamaChat([
    {
      role: 'system',
      content: 'You are a senior project analyst. Provide concise, impactful executive summaries in plain text.',
    },
    {
      role: 'user',
      content: `Summarize the progress and health of this project. Identify bottlenecks or areas for improvement.\n\nProject Data: ${JSON.stringify(projectData)}`,
    },
  ]);
}

export async function chatWithAI(userMessage: string, projectContext?: string): Promise<string> {
  return ollamaChat([
    {
      role: 'system',
      content: `You are Kanflow AI, a helpful assistant for project and task management. Keep answers concise and practical.${projectContext ? ` Context: ${projectContext}` : ''}`,
    },
    { role: 'user', content: userMessage },
  ]);
}
