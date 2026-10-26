export type Provider = 'openai' | 'anthropic' | 'openrouter' | 'openai-compatible';

export interface CallParams {
  provider: Provider;
  apiKey: string;
  model: string;
  prompt: string;
  baseUrl?: string;
}

export interface SummarizeParams {
  provider: Provider;
  apiKey: string;
  model: string;
  threadText: string; // already stripped/truncated plain text
  baseUrl?: string;
}

export interface ComposeReplyParams {
  provider: Provider;
  apiKey: string;
  model: string;
  threadText: string; // already stripped/truncated plain text
  userInput: string; // the user's rough notes on what they want to say
  baseUrl?: string;
}

const SUMMARIZE_PROMPT_PREFIX = `Summarize the following email thread in 3-6 short bullet points.
Focus on: key points discussed, any decisions made, and any open
action items or unanswered questions. Be terse — this is for someone
who has already read the thread and wants a quick refresher.
Write the summary in the predominant language of the email thread.

THREAD:
`;

export async function summarizeThread(params: SummarizeParams): Promise<string> {
  const { provider, apiKey, model, threadText, baseUrl } = params;
  return callLLM({ provider, apiKey, model, prompt: SUMMARIZE_PROMPT_PREFIX + threadText, baseUrl });
}

export async function composeReply(params: ComposeReplyParams): Promise<string> {
  const { provider, apiKey, model, threadText, userInput, baseUrl } = params;
  const prompt = `You are drafting a reply to the email thread below, on behalf of the
person who received it. Use the thread for context (who's involved, what's
been discussed, any open questions) so the reply makes sense as a follow-up.

The person wants to say the following (their rough notes, possibly informal
or incomplete — rephrase and expand this into a polished, appropriately
toned reply body, but keep their intent and key points; don't invent new
facts, commitments, or details that weren't in their notes or the thread):

Write the reply in the same language as the user's notes. If the notes
are too short or language-neutral to determine that, use the predominant
language of the email thread.

USER'S NOTES:
${userInput}

THREAD:
${threadText}

Write ONLY the body text of the reply email. No subject line, no
"Here's a draft" preamble, no explanation — just the reply text itself,
ready to send.`;

  return callLLM({ provider, apiKey, model, prompt, baseUrl });
}

export async function callLLM(params: CallParams): Promise<string> {
  const { provider, apiKey, model, prompt, baseUrl } = params;
  if (!apiKey && provider !== 'openai-compatible') {
    throw new Error(`No API key configured for ${provider}. Set one in Preferences > AI Thread Sidebar.`);
  }

  if (provider === 'openai') {
    return callOpenAI(apiKey, model, prompt);
  }
  if (provider === 'anthropic') {
    return callAnthropic(apiKey, model, prompt);
  }
  if (provider === 'openrouter') {
    return callOpenRouter(apiKey, model, prompt);
  }
  if (provider === 'openai-compatible') {
    return callOpenAICompatible(apiKey, model, prompt, baseUrl || '');
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function callOpenAICompatible(
  apiKey: string,
  model: string,
  prompt: string,
  baseUrl: string,
): Promise<string> {
  if (!baseUrl.trim()) {
    throw new Error('No base URL configured for the OpenAI-compatible provider.');
  }

  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const endpoint = normalizedBaseUrl.endsWith('/chat/completions')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    throw new Error(`Network error contacting ${endpoint}: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const detail = await safeErrorDetail(response);
    throw new Error(`OpenAI-compatible request failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI-compatible response did not contain any text.');
  }
  return content.trim();
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    throw new Error(`Network error contacting OpenAI: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const detail = await safeErrorDetail(response);
    throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI response did not contain any text.');
  }
  return content.trim();
}

async function callAnthropic(apiKey: string, model: string, prompt: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    throw new Error(`Network error contacting Anthropic: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const detail = await safeErrorDetail(response);
    throw new Error(`Anthropic request failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const content = data?.content?.[0]?.text;
  if (!content || typeof content !== 'string') {
    throw new Error('Anthropic response did not contain any text.');
  }
  return content.trim();
}

async function callOpenRouter(apiKey: string, model: string, prompt: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (err) {
    throw new Error(`Network error contacting OpenRouter: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const detail = await safeErrorDetail(response);
    throw new Error(`OpenRouter request failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenRouter response did not contain any text.');
  }
  return content.trim();
}

async function safeErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message || JSON.stringify(body);
  } catch {
    try {
      return await response.text();
    } catch {
      return response.statusText || 'unknown error';
    }
  }
}
