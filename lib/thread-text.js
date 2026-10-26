"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildThreadText = buildThreadText;
const MAX_MESSAGES = 20;
const MAX_CHARS = 12000;
// Confirmed live against a real Message object (spec §10): fields include
// `body` (HTML), `plaintext`, and `snippet`. `body` is preferred since it's
// the full message content; `plaintext`/`snippet` are fallbacks for the rare
// case `body` is empty (e.g. a draft or a message still syncing).
function getMessageBodyHtml(message) {
    return (message === null || message === void 0 ? void 0 : message.body) || (message === null || message === void 0 ? void 0 : message.plaintext) || (message === null || message === void 0 ? void 0 : message.snippet) || '';
}
function stripHtml(html) {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
function buildThreadText(messages) {
    var _a, _b, _c, _d;
    const recent = messages.slice(-MAX_MESSAGES);
    const messageTruncated = recent.length < messages.length;
    const parts = [];
    let totalChars = 0;
    let charTruncated = false;
    // Walk from most recent backwards so the char budget favors recent messages.
    for (let i = recent.length - 1; i >= 0; i--) {
        const message = recent[i];
        const from = ((_b = (_a = message === null || message === void 0 ? void 0 : message.from) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.email) || ((_d = (_c = message === null || message === void 0 ? void 0 : message.from) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.name) || 'unknown sender';
        const date = (message === null || message === void 0 ? void 0 : message.date) ? new Date(message.date).toISOString() : '';
        const bodyText = stripHtml(getMessageBodyHtml(message));
        const header = `From: ${from}${date ? `  Date: ${date}` : ''}\n`;
        const block = header + bodyText;
        if (totalChars + block.length > MAX_CHARS) {
            charTruncated = true;
            const remaining = MAX_CHARS - totalChars;
            const marker = '\n\n[message truncated]';
            // Always retain part of an oversized newest message. Previously the
            // loop broke before adding anything, causing long single-message
            // threads to be reported as unreadable.
            if (remaining > header.length + marker.length) {
                const bodyBudget = remaining - header.length - marker.length;
                parts.unshift(header + bodyText.slice(0, bodyBudget).trimEnd() + marker);
            }
            break;
        }
        parts.unshift(block);
        totalChars += block.length;
    }
    return {
        text: parts.join('\n\n---\n\n'),
        truncated: messageTruncated || charTruncated,
    };
}
