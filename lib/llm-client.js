"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeThread = summarizeThread;
exports.composeReply = composeReply;
exports.callLLM = callLLM;
const SUMMARIZE_PROMPT_PREFIX = `Summarize the following email thread in 3-6 short bullet points.
Focus on: key points discussed, any decisions made, and any open
action items or unanswered questions. Be terse — this is for someone
who has already read the thread and wants a quick refresher.
Write the summary in the predominant language of the email thread.

THREAD:
`;
async function summarizeThread(params) {
    const { provider, apiKey, model, threadText, baseUrl } = params;
    return callLLM({ provider, apiKey, model, prompt: SUMMARIZE_PROMPT_PREFIX + threadText, baseUrl });
}
async function composeReply(params) {
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
async function callLLM(params) {
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
async function callOpenAICompatible(apiKey, model, prompt, baseUrl) {
    var _a, _b, _c;
    if (!baseUrl.trim()) {
        throw new Error('No base URL configured for the OpenAI-compatible provider.');
    }
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    const endpoint = normalizedBaseUrl.endsWith('/chat/completions')
        ? normalizedBaseUrl
        : `${normalizedBaseUrl}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
    }
    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
            }),
        });
    }
    catch (err) {
        throw new Error(`Network error contacting ${endpoint}: ${err.message}`);
    }
    if (!response.ok) {
        const detail = await safeErrorDetail(response);
        throw new Error(`OpenAI-compatible request failed (${response.status}): ${detail}`);
    }
    const data = await response.json();
    const content = (_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
    if (!content || typeof content !== 'string') {
        throw new Error('OpenAI-compatible response did not contain any text.');
    }
    return content.trim();
}
async function callOpenAI(apiKey, model, prompt) {
    var _a, _b, _c;
    let response;
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
    }
    catch (err) {
        throw new Error(`Network error contacting OpenAI: ${err.message}`);
    }
    if (!response.ok) {
        const detail = await safeErrorDetail(response);
        throw new Error(`OpenAI request failed (${response.status}): ${detail}`);
    }
    const data = await response.json();
    const content = (_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
    if (!content || typeof content !== 'string') {
        throw new Error('OpenAI response did not contain any text.');
    }
    return content.trim();
}
async function callAnthropic(apiKey, model, prompt) {
    var _a, _b;
    let response;
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
    }
    catch (err) {
        throw new Error(`Network error contacting Anthropic: ${err.message}`);
    }
    if (!response.ok) {
        const detail = await safeErrorDetail(response);
        throw new Error(`Anthropic request failed (${response.status}): ${detail}`);
    }
    const data = await response.json();
    const content = (_b = (_a = data === null || data === void 0 ? void 0 : data.content) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text;
    if (!content || typeof content !== 'string') {
        throw new Error('Anthropic response did not contain any text.');
    }
    return content.trim();
}
async function callOpenRouter(apiKey, model, prompt) {
    var _a, _b, _c;
    let response;
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
    }
    catch (err) {
        throw new Error(`Network error contacting OpenRouter: ${err.message}`);
    }
    if (!response.ok) {
        const detail = await safeErrorDetail(response);
        throw new Error(`OpenRouter request failed (${response.status}): ${detail}`);
    }
    const data = await response.json();
    const content = (_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
    if (!content || typeof content !== 'string') {
        throw new Error('OpenRouter response did not contain any text.');
    }
    return content.trim();
}
async function safeErrorDetail(response) {
    var _a;
    try {
        const body = await response.json();
        return ((_a = body === null || body === void 0 ? void 0 : body.error) === null || _a === void 0 ? void 0 : _a.message) || JSON.stringify(body);
    }
    catch (_b) {
        try {
            return await response.text();
        }
        catch (_c) {
            return response.statusText || 'unknown error';
        }
    }
}
