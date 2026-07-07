const OLLAMA_MODEL = (import.meta as any).env?.VITE_OLLAMA_MODEL ?? 'llama3.2';

/** Base URL without trailing slash. Dev defaults to same-origin `/ollama` (Vite + nginx proxy). */
function ollamaBase(): string {
  const raw = (import.meta as any).env?.VITE_OLLAMA_URL as string | undefined;
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).trim().replace(/\/$/, '');
  }
  if ((import.meta as any).env?.DEV) {
    return '/ollama';
  }
  return 'http://127.0.0.1:11434';
}

function ollamaChatUrl(): string {
  const base = ollamaBase();
  return `${base}/api/chat`;
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function ollamaChat(messages: OllamaMessage[], jsonMode = false): Promise<string> {
  const response = await fetch(ollamaChatUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      ...(jsonMode && { format: 'json' }),
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const j = JSON.parse(raw) as { error?: string };
      if (j?.error) detail = j.error;
    } catch {
      if (raw) detail = raw.slice(0, 200);
    }
    if (response.status === 404) {
      throw new Error(
        `Ollama model or route (${OLLAMA_MODEL}): ${detail}. If the model is missing, run \`ollama pull ${OLLAMA_MODEL}\` (or wait for the ollama-pull service in Docker Compose).`,
      );
    }
    throw new Error(`Ollama error ${response.status}: ${detail}`);
  }
  const data = JSON.parse(raw) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) throw new Error('Empty response from Ollama');
  return content;
}

export interface TaskEnhancementResult {
  enhancedTitle: string;
  enhancedDescription: string;
  subtasks: string[];
  potentialRisks: string[];
  suggestedPriority: 'low' | 'medium' | 'high';
  definitionOfDone: string;
  aiThinking: string;
}

function extractJsonObject(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Model did not return a JSON object. Raw (truncated): ${text.slice(0, 400)}`);
  }
  return t.slice(start, end + 1);
}

function firstStr(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function firstArr(raw: Record<string, unknown>, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  }
  return [];
}

function normalizeEnhancePayload(
  raw: Record<string, unknown>,
  fallback: { title: string; description: string },
): TaskEnhancementResult {
  const pri = firstStr(raw, 'suggestedPriority', 'suggested_priority', 'priority').toLowerCase();
  const suggestedPriority: 'low' | 'medium' | 'high' =
    pri === 'low' || pri === 'high' ? pri : 'medium';

  const enhancedTitle =
    firstStr(raw, 'enhancedTitle', 'enhanced_title', 'title', 'smartTitle', 'smart_title') ||
    fallback.title;
  const enhancedDescription =
    firstStr(
      raw,
      'enhancedDescription',
      'enhanced_description',
      'description',
      'smartDescription',
      'smart_description',
    ) || fallback.description;

  return {
    enhancedTitle,
    enhancedDescription,
    subtasks: firstArr(raw, 'subtasks', 'sub_tasks'),
    potentialRisks: firstArr(raw, 'potentialRisks', 'potential_risks', 'risks'),
    suggestedPriority,
    definitionOfDone:
      firstStr(raw, 'definitionOfDone', 'definition_of_done', 'dod') ||
      'Criteria to be agreed with the team.',
    aiThinking:
      firstStr(raw, 'aiThinking', 'ai_thinking', 'thinking', 'rationale', 'logic') ||
      'See enhanced title and description above.',
  };
}

function buildEnhanceUserPrompt(title: string, description: string, tags: string[]): string {
  const details = description.trim();
  const detailsBlock = details
    ? `Task details (primary context — base your refinement on this text; keep facts and constraints accurate, improve clarity, structure, and actionability; do not invent requirements that contradict it):\n---\n${details}\n---`
    : `Task details: (none yet — infer a reasonable scope, risks, and definition of done from the title only.)`;

  const tagLine =
    tags.length > 0
      ? `\nExisting tags (respect or refine wording; you may suggest better labels in aiThinking if useful): ${tags.join(', ')}`
      : '';

  return `Enhance this task for maximum clarity and actionability.

Title: ${title}

${detailsBlock}${tagLine}

Return exactly one JSON object with these keys (use strings and arrays of strings; suggestedPriority must be exactly "low", "medium", or "high"):
{
  "enhancedTitle": "string",
  "enhancedDescription": "string",
  "subtasks": ["string"],
  "potentialRisks": ["string"],
  "suggestedPriority": "low" | "medium" | "high",
  "definitionOfDone": "string",
  "aiThinking": "string"
}`;
}

export async function enhanceTask(
  title: string,
  description: string,
  tags: string[] = [],
): Promise<TaskEnhancementResult> {
  const content = await ollamaChat(
    [
      {
        role: 'system',
        content:
          'You are a high-performance task optimizer. When task details are provided, treat them as authoritative context for scope and facts. Reply with one JSON object only. No markdown code fences, no text before or after the JSON.',
      },
      {
        role: 'user',
        content: buildEnhanceUserPrompt(title, description, tags),
      },
    ],
    true,
  );

  let parsed: Record<string, unknown>;
  try {
    const jsonStr = extractJsonObject(content);
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  return normalizeEnhancePayload(parsed, { title, description });
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
