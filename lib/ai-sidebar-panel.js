"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { FocusedContentStore, MessageStore } = require('mailspring-exports');
const llm_client_1 = require("./llm-client");
const thread_text_1 = require("./thread-text");
const reply_draft_1 = require("./reply-draft");
const DEFAULT_MODELS = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-20241022',
    openrouter: 'openai/gpt-4o-mini',
    'openai-compatible': 'local-model',
};
// Approximate size of the right-click menu, used to keep it inside the window.
const MENU_WIDTH = 150;
const MENU_HEIGHT = 64;
// Mirrors Mailspring's own `isTextInput` (app/src/window-event-handler.ts): the
// app routes mod+A to the focused text field and to "select all threads"
// otherwise, so we must leave fields that caret-navigate alone.
const INPUT_TYPES = ['text', 'email', 'url', '', 'search', 'password', 'number'];
const isTextInput = (node) => {
    if (!(node instanceof HTMLElement))
        return false;
    if (node.tagName === 'TEXTAREA')
        return true;
    if (node.tagName === 'INPUT')
        return INPUT_TYPES.includes(node.type);
    return !!node.closest('[contenteditable]');
};
function getConfiguredLLM() {
    const provider = AppEnv.config.get('ai-thread-sidebar.provider') || 'openai';
    const apiKey = AppEnv.config.get('ai-thread-sidebar.apiKey') || '';
    const model = AppEnv.config.get('ai-thread-sidebar.model') || DEFAULT_MODELS[provider];
    const baseUrl = AppEnv.config.get('ai-thread-sidebar.baseUrl') || '';
    return { provider, apiKey, model, baseUrl };
}
class AISidebarPanel extends react_1.default.Component {
    constructor(props) {
        super(props);
        this._unsubscribes = [];
        this._menuListenersAttached = false;
        this._panelEl = null;
        this._onFocusChange = () => {
            const threadId = this._currentThreadId();
            if (threadId !== this.state.threadId) {
                // FR7: switching threads clears any prior summary and resets to idle.
                this.setState({
                    status: 'idle',
                    summary: '',
                    error: '',
                    truncated: false,
                    threadId,
                    replyInput: '',
                    replyStatus: 'idle',
                    replyError: '',
                    contextMenu: null,
                });
                this._detachMenuListeners();
            }
        };
        this._onSummarizeClick = async () => {
            this.setState({ status: 'loading', error: '', summary: '' });
            try {
                const { provider, apiKey, model, baseUrl } = getConfiguredLLM();
                const messages = MessageStore.items() || [];
                if (messages.length === 0) {
                    throw new Error('No messages found in the focused thread.');
                }
                const { text, truncated } = (0, thread_text_1.buildThreadText)(messages);
                if (!text) {
                    throw new Error('Could not read any message content from this thread.');
                }
                const summary = await (0, llm_client_1.summarizeThread)({ provider, apiKey, model, threadText: text, baseUrl });
                if (this._currentThreadId() !== this.state.threadId) {
                    // Thread changed while the request was in flight; discard the result.
                    return;
                }
                this.setState({ status: 'success', summary, truncated });
            }
            catch (err) {
                this.setState({ status: 'error', error: err.message || String(err) });
            }
        };
        this._onReplyInputChange = (event) => {
            this.setState({ replyInput: event.target.value });
        };
        this._onComposeReplyClick = async () => {
            const startedThreadId = this.state.threadId;
            this.setState({ replyStatus: 'loading', replyError: '' });
            try {
                const { provider, apiKey, model, baseUrl } = getConfiguredLLM();
                const thread = FocusedContentStore.focused('thread');
                const messages = MessageStore.items() || [];
                if (!thread || messages.length === 0) {
                    throw new Error('No messages found in the focused thread.');
                }
                const lastMessage = messages[messages.length - 1];
                const { text: threadText } = (0, thread_text_1.buildThreadText)(messages);
                if (!threadText) {
                    throw new Error('Could not read any message content from this thread.');
                }
                const replyText = await (0, llm_client_1.composeReply)({
                    provider,
                    apiKey,
                    model,
                    baseUrl,
                    threadText,
                    userInput: this.state.replyInput,
                });
                if (this._currentThreadId() !== startedThreadId) {
                    // Thread changed while the request was in flight; discard the result.
                    return;
                }
                await (0, reply_draft_1.createReplyDraftWithAIBody)({
                    thread,
                    message: lastMessage,
                    bodyHtml: (0, reply_draft_1.textToHtml)(replyText),
                });
                this.setState({ replyStatus: 'success', replyInput: '' });
            }
            catch (err) {
                this.setState({ replyStatus: 'error', replyError: err.message || String(err) });
            }
        };
        // Mailspring binds mod+A to `core:select-all`, which selects every thread in
        // the list unless the event target is a text input. Claim it while focus is
        // inside the panel so mod+A behaves like "select the summary text".
        this._onPanelKeyDownCapture = (event) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey)
                return;
            if (String(event.key).toLowerCase() !== 'a')
                return;
            if (isTextInput(event.target))
                return; // the reply textarea keeps its own mod+A
            event.preventDefault();
            event.stopPropagation();
            this._selectSummary();
        };
        this._summarySelectionText = (panel) => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0)
                return '';
            const { anchorNode, focusNode } = selection;
            if (!anchorNode || !focusNode)
                return '';
            if (!panel.contains(anchorNode) || !panel.contains(focusNode))
                return '';
            return selection.toString();
        };
        this._onPanelContextMenu = (event) => {
            const target = event.target;
            // Editable fields keep Mailspring's own native menu, and right-clicking the
            // menu itself must not re-open it.
            if (isTextInput(target) || target.closest('.ai-thread-sidebar-context-menu'))
                return;
            event.preventDefault();
            const panel = event.currentTarget;
            this.setState({
                contextMenu: {
                    x: Math.min(event.clientX, window.innerWidth - MENU_WIDTH),
                    y: Math.min(event.clientY, window.innerHeight - MENU_HEIGHT),
                    text: this._summarySelectionText(panel),
                    canSelectAll: !!(this._panelEl && this._panelEl.querySelector('.ai-thread-sidebar-summary')),
                },
            });
            this._attachMenuListeners();
        };
        this._onContextMenuSelectAll = () => {
            this._selectSummary();
            this._closeContextMenu();
        };
        this._closeContextMenu = () => {
            if (!this.state.contextMenu)
                return;
            this.setState({ contextMenu: null });
            this._detachMenuListeners();
        };
        this._onDocumentMouseDown = (event) => {
            const target = event.target;
            if (target && target.closest && target.closest('.ai-thread-sidebar-context-menu'))
                return;
            this._closeContextMenu();
        };
        this._onMenuKeyDown = (event) => {
            if (event.key !== 'Escape' || !this.state.contextMenu)
                return;
            event.preventDefault();
            event.stopPropagation();
            this._closeContextMenu();
        };
        this._onContextMenuCopy = () => {
            // Mailspring's own `core:copy` uses execCommand on the main document and
            // falls back to the window's editing command (app/src/window-event-handler.ts).
            if (!document.execCommand('copy')) {
                try {
                    AppEnv.getCurrentWindow().webContents.copy();
                }
                catch (err) {
                    // Neither path worked; nothing else to fall back to.
                }
            }
            this._closeContextMenu();
        };
        this.state = {
            status: 'idle',
            summary: '',
            error: '',
            truncated: false,
            threadId: this._currentThreadId(),
            replyInput: '',
            replyStatus: 'idle',
            replyError: '',
            contextMenu: null,
        };
    }
    componentDidMount() {
        this._unsubscribes.push(FocusedContentStore.listen(this._onFocusChange));
    }
    componentWillUnmount() {
        this._unsubscribes.forEach(unsub => unsub());
        this._detachMenuListeners();
    }
    _currentThreadId() {
        const thread = FocusedContentStore.focused('thread');
        return thread ? thread.id : null;
    }
    _selectSummary() {
        const summary = this._panelEl && this._panelEl.querySelector('.ai-thread-sidebar-summary');
        const selection = window.getSelection();
        if (!summary || !selection)
            return;
        const range = document.createRange();
        range.selectNodeContents(summary);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    _attachMenuListeners() {
        if (this._menuListenersAttached)
            return;
        this._menuListenersAttached = true;
        document.addEventListener('mousedown', this._onDocumentMouseDown, true);
        document.addEventListener('keydown', this._onMenuKeyDown, true);
        window.addEventListener('scroll', this._closeContextMenu, true);
        window.addEventListener('blur', this._closeContextMenu);
    }
    _detachMenuListeners() {
        if (!this._menuListenersAttached)
            return;
        this._menuListenersAttached = false;
        document.removeEventListener('mousedown', this._onDocumentMouseDown, true);
        document.removeEventListener('keydown', this._onMenuKeyDown, true);
        window.removeEventListener('scroll', this._closeContextMenu, true);
        window.removeEventListener('blur', this._closeContextMenu);
    }
    _renderContextMenu() {
        const menu = this.state.contextMenu;
        if (!menu)
            return null;
        return (react_1.default.createElement("div", { className: "ai-thread-sidebar-context-menu", style: { left: menu.x, top: menu.y }, role: "menu" },
            react_1.default.createElement("button", { type: "button", className: "ai-thread-sidebar-context-menu-item", role: "menuitem", disabled: menu.text.length === 0, onClick: this._onContextMenuCopy }, "Copy"),
            react_1.default.createElement("div", { className: "ai-thread-sidebar-context-menu-divider" }),
            react_1.default.createElement("button", { type: "button", className: "ai-thread-sidebar-context-menu-item", role: "menuitem", disabled: !menu.canSelectAll, onClick: this._onContextMenuSelectAll }, "Select all")));
    }
    _renderBullets(summary) {
        const lines = summary
            .split('\n')
            .map(line => line.replace(/^[-*•]\s*/, '').trim())
            .filter(Boolean);
        return (react_1.default.createElement("ul", { className: "ai-thread-sidebar-summary", tabIndex: 0 }, lines.map((line, i) => (react_1.default.createElement("li", { key: i }, line)))));
    }
    render() {
        const { status, summary, error, truncated, replyInput, replyStatus, replyError } = this.state;
        const thread = FocusedContentStore.focused('thread');
        if (!thread) {
            return null;
        }
        return (react_1.default.createElement("div", { className: "ai-thread-sidebar-panel", ref: el => {
                this._panelEl = el;
            }, onKeyDownCapture: this._onPanelKeyDownCapture, onContextMenu: this._onPanelContextMenu },
            react_1.default.createElement("div", { className: "ai-thread-sidebar-header" }, "AI Summary"),
            react_1.default.createElement("button", { className: "btn ai-thread-sidebar-button", onClick: this._onSummarizeClick, disabled: status === 'loading' }, status === 'loading' ? 'Summarizing…' : 'Summarize thread'),
            status === 'loading' && (react_1.default.createElement("div", { className: "ai-thread-sidebar-loading" }, "Contacting AI provider\u2026")),
            status === 'error' && react_1.default.createElement("div", { className: "ai-thread-sidebar-error" }, error),
            status === 'success' && (react_1.default.createElement("div", null,
                this._renderBullets(summary),
                truncated && (react_1.default.createElement("div", { className: "ai-thread-sidebar-notice" }, "(showing most recent messages only)")))),
            react_1.default.createElement("div", { className: "ai-thread-sidebar-divider" }),
            react_1.default.createElement("div", { className: "ai-thread-sidebar-header" }, "AI Reply"),
            react_1.default.createElement("textarea", { className: "ai-thread-sidebar-reply-input", placeholder: "What do you want to say? (rough notes are fine \u2014 AI will phrase it as a reply)", value: replyInput, onChange: this._onReplyInputChange, disabled: replyStatus === 'loading', rows: 4 }),
            react_1.default.createElement("button", { className: "btn ai-thread-sidebar-button", onClick: this._onComposeReplyClick, disabled: replyStatus === 'loading' || !replyInput.trim() }, replyStatus === 'loading' ? 'Drafting reply…' : 'Draft AI reply'),
            replyStatus === 'loading' && (react_1.default.createElement("div", { className: "ai-thread-sidebar-loading" }, "Composing and creating draft\u2026")),
            replyStatus === 'error' && react_1.default.createElement("div", { className: "ai-thread-sidebar-error" }, replyError),
            replyStatus === 'success' && (react_1.default.createElement("div", { className: "ai-thread-sidebar-notice" }, "Draft created \u2014 opening in composer.")),
            this._renderContextMenu()));
    }
}
AISidebarPanel.displayName = 'AISidebarPanel';
exports.default = AISidebarPanel;
