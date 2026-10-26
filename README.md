# Mailspring AI Copilot

**Free, open-source AI for your Mailspring inbox — summarize any email thread and draft replies in seconds, using your own OpenAI, Anthropic, or OpenRouter API key.**

Mailspring AI Copilot is a lightweight, privacy-first AI plugin for [Mailspring](https://getmailspring.com/), the open-source Gmail/IMAP desktop email client for macOS, Windows, and Linux. No subscription, no third-party mail server, no vendor lock-in — just your own API key and two AI-powered tools built directly into the message sidebar:

- 📋 **Summarize thread** — instantly turn a long, messy email thread into a clean 3–6 bullet summary (key points, decisions, open action items).
- ✍️ **Draft AI reply** — jot a few rough notes on what you want to say, and get a fully written, context-aware reply drafted for you as a real Mailspring draft, ready to review and send.

Think of it as a self-hosted, bring-your-own-key alternative to AI email tools like Superhuman AI or Shortwave AI — except it's free, open source, and your email content never touches a third-party mail server.

---

## Table of contents

- [Features](#features)
- [Why Mailspring AI Copilot?](#why-mailspring-ai-copilot)
- [Supported AI providers & models](#supported-ai-providers--models)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Privacy & security](#privacy--security)
- [FAQ](#faq)
- [Development](#development)
- [Roadmap / known limitations](#roadmap--known-limitations)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **AI email thread summarizer** — get the gist of a long thread without reading every message.
- **AI email reply generator** — turn rough notes into a polished, properly toned reply draft.
- **Bring your own API key (BYOK)** — works with OpenAI (GPT-4o / GPT-4o-mini), Anthropic (Claude), and OpenRouter (DeepSeek, Llama, Gemini, and 100+ other models through one key).
- **Zero data retention by design** — nothing is cached to disk, nothing is sent anywhere except the LLM provider you choose.
- **Fully manual, fully in your control** — no background AI calls, no auto-summarization, no auto-send. Every action starts with a click.
- **No native dependencies** — pure TypeScript + `fetch`, nothing to compile.
- **100% open source** — inspect exactly what it sends and where, always.

## Why Mailspring AI Copilot?

Most "AI for email" tools today are hosted SaaS products that route your inbox through their own servers, require a subscription, and lock you into their model choice. Mailspring AI Copilot takes a different approach:

| | Mailspring AI Copilot | Typical SaaS AI email tools |
|---|---|---|
| **Cost** | Free plugin — you only pay your LLM provider for what you use | Monthly subscription |
| **Your email content** | Sent only to the LLM provider *you* configure | Routed through the vendor's own servers |
| **Model choice** | OpenAI, Anthropic, or any OpenRouter model (GPT-4o, Claude, DeepSeek, Llama, and more) | Locked to whatever the vendor picked |
| **Source code** | Fully open source, auditable | Closed source |
| **Data retention** | None — nothing cached to disk | Varies, often unclear |

If you already use Mailspring for its open-source, local-first philosophy, this plugin extends that same philosophy to AI.

## Supported AI providers & models

Configure any one of the following in Preferences:

- **OpenAI** — e.g. `gpt-4o-mini`, `gpt-4o`
- **Anthropic** — e.g. `claude-3-5-haiku-20241022`, or the current Claude model of your choice
- **OpenRouter** — a single API key gives you access to a huge range of models via `provider/model` slugs, e.g. `openai/gpt-4o-mini`, `anthropic/claude-3.5-haiku`, `deepseek/deepseek-v4-pro-0813`. Check [openrouter.ai/models](https://openrouter.ai/models) or `GET https://openrouter.ai/api/v1/models` for the current list — model names change over time.
- **Any OpenAI-compatible endpoint** — configure a base URL, model, and optional API key for local servers such as llama.cpp, Ollama, or LM Studio.

## Installation

**Requirements:** Mailspring (tested against v1.24.x), Node.js + npm, and an API key from OpenAI, Anthropic, or OpenRouter.

```bash
git clone https://github.com/<your-username>/mailspring-ai-copilot.git
cd mailspring-ai-copilot
npm install
npm run build
```

Symlink (or copy) the plugin into Mailspring's packages folder:

```bash
# macOS
ln -s "$(pwd)" "$HOME/Library/Application Support/Mailspring/packages/mailspring-ai-copilot"

# Windows: copy/symlink into %APPDATA%\Mailspring\packages\
# Linux:   copy/symlink into ~/.config/Mailspring/packages/
```

Fully quit and relaunch Mailspring — plugins don't hot-reload.

## Configuration

1. Open Mailspring's Preferences.
2. Open the **Mailspring AI Copilot** tab.
3. Pick a provider, paste in your API key, and set a model (sensible defaults are pre-filled).

For an OpenAI-compatible provider, set the base URL through `/v1` (for example `http://localhost:8080/v1` for llama.cpp). The API key is optional for local servers that do not require authentication.

Your key never leaves your machine except in direct API calls to the provider you picked.

## Usage

Open any email thread. If the sidebar isn't visible, click the small toggle icon in the top-right of the message toolbar to reveal it.

- **Summarize thread** → get an instant bullet-point recap. Long threads (20+ messages or ~12,000+ characters) are automatically truncated to the most recent, relevant content, with a notice shown when that happens.
- **Draft AI reply** → type a few rough notes on what you want to say, click "Draft AI reply," and a fully drafted reply opens in the composer — using the thread as context so it actually makes sense as a follow-up. Nothing is ever sent automatically; you always review and hit send yourself.

## Privacy & security

- Email content and your API key are sent **only** to the LLM provider you configure (`api.openai.com`, `api.anthropic.com`, or `openrouter.ai`) — never to any Mailspring server or any other third party.
- Nothing is cached to disk by this plugin. Summaries live in memory only while a thread is focused and are cleared the moment you switch threads or restart Mailspring.
- Your API key is stored locally via Mailspring's own `AppEnv.config` store (plain local JSON — the same mechanism Mailspring uses for its own settings). It is **not** encrypted at rest, so don't use this on a shared or untrusted machine.
- No AI call happens automatically — every network request is the direct result of you clicking "Summarize thread" or "Draft AI reply." Replies are never sent automatically.
- No native/compiled dependencies — pure TypeScript and `fetch`.

**Contributing?** Never commit a real API key, `.env` file, or your local Mailspring `config.json`. `.gitignore` already excludes the common cases — double-check `git status`/`git diff` before pushing.

## FAQ

**Is this free?**
The plugin is free and open source. You only pay your chosen LLM provider (OpenAI, Anthropic, or OpenRouter) for the API calls you make — typically fractions of a cent per summary or draft with a small model like `gpt-4o-mini` or `claude-3-5-haiku`.

**Does my email data get sent to Mailspring or to this project's maintainers?**
No. This plugin runs entirely on your machine and talks directly to the LLM provider you configure. See [Privacy & security](#privacy--security).

**Which AI models can I use?**
Any OpenAI or Anthropic chat model, or — via OpenRouter — virtually any hosted model including DeepSeek, Llama, Gemini, and more, all through a single API key.

**Can it send emails automatically?**
No. AI-drafted replies always open in the Mailspring composer for you to review and send yourself. There is no auto-send.

**Is my API key secure?**
It's stored locally using Mailspring's own settings storage, in plain (unencrypted) local JSON — the same approach Mailspring uses for its own configuration. Don't use this on a shared or untrusted machine.

**How is this different from Superhuman AI or Shortwave?**
Those are hosted SaaS products with monthly subscriptions that route your email through their own infrastructure. Mailspring AI Copilot is a free, open-source plugin that talks directly from your machine to the AI provider you choose — no middleman, no subscription, full transparency into the code.

## Development

```
src/
├── main.ts               # activate/deactivate — registers the sidebar component and preferences tab
├── ai-sidebar-panel.tsx  # the sidebar UI: summary + reply-draft sections
├── llm-client.ts         # provider-abstracted calls to OpenAI / Anthropic / OpenRouter
├── thread-text.ts        # message extraction, HTML stripping, truncation
├── reply-draft.ts        # creates a real Mailspring draft from AI-generated reply text
└── preferences.tsx       # provider / API key / model settings UI
```

```bash
npm run build   # one-off tsc build into lib/
npm run watch   # tsc --watch
```

`lib/` (the compiled JS) is committed to the repo, following Mailspring's own plugin convention — anyone sideloading the plugin gets working code without needing to run a build step.

See [`../mailspring-ai-sidebar-spec.md`](../mailspring-ai-sidebar-spec.md) for the full functional/technical spec, including Mailspring API details confirmed against live source — useful reading before extending this plugin, since several early assumptions about Mailspring's internal APIs turned out wrong and are documented there.

## Roadmap / known limitations

- No caching or persistence of summaries/drafts across thread switches or app restarts (by design — see [Privacy & security](#privacy--security)).
- No OS-keychain integration for the API key yet.
- No bundled backend — this is a direct client-to-LLM-provider integration only.
- No multi-thread or inbox-wide batch summarization yet.

Pull requests and issues welcome — see [Contributing](#contributing).

## Contributing

Issues and pull requests are welcome. Before opening a PR:

- Run `npm run build` and confirm it compiles cleanly.
- Never commit a real API key, `.env` file, or local Mailspring config.
- Keep changes scoped — see the spec doc for the plugin's intended scope and out-of-scope items.

## License

[MIT](./LICENSE)

---

**Keywords:** Mailspring plugin, Mailspring AI, Mailspring extension, AI email summarizer, AI email assistant, email reply generator, ChatGPT for email, GPT-4o email, Claude email assistant, DeepSeek email, OpenRouter plugin, open source email AI, BYOK AI tool, self-hosted email AI, privacy-first email client, Superhuman AI alternative, Shortwave alternative.
