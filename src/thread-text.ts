const MAX_MESSAGES = 20;
const MAX_CHARS = 12000;

export interface TruncatedThread {
  text: string;
  truncated: boolean;
}

// Confirmed live against a real Message object (spec §10): fields include
// `body` (HTML), `plaintext`, and `snippet`. `body` is preferred since it's
// the full message content; `plaintext`/`snippet` are fallbacks for the rare
// case `body` is empty (e.g. a draft or a message still syncing).
function getMessageBodyHtml(message: any): string {
  return message?.body || message?.plaintext || message?.snippet || '';
}

function stripHtml(html: string): string {
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

export function buildThreadText(messages: any[]): TruncatedThread {
  const recent = messages.slice(-MAX_MESSAGES);
  const messageTruncated = recent.length < messages.length;

  const parts: string[] = [];
  let totalChars = 0;
  let charTruncated = false;

  // Walk from most recent backwards so the char budget favors recent messages.
  for (let i = recent.length - 1; i >= 0; i--) {
    const message = recent[i];
    const from = message?.from?.[0]?.email || message?.from?.[0]?.name || 'unknown sender';
    const date = message?.date ? new Date(message.date).toISOString() : '';
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
