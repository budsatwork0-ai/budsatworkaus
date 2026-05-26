'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type TerminalLine =
  | { type: 'intro'; text: string }
  | { type: 'user'; text: string }
  | { type: 'thinking' }
  | { type: 'tool'; name: string; display: string; output: string }
  | { type: 'text'; content: string }
  | { type: 'error'; message: string };

type HistoryMessage = { role: 'user' | 'assistant'; content: string };

// ── ANSI-lite colour strip (for grep output) ──────────────────────────────────

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'git status',
  'recent commits',
  'TypeScript errors',
  'list API routes',
  'show agents',
  'what files changed?',
];

// ── Components ────────────────────────────────────────────────────────────────

function Thinking() {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/60" style={{ animationDelay: '0ms' }} />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/60" style={{ animationDelay: '150ms' }} />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400/60" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function ToolBlock({ display, output }: { display: string; output: string }) {
  const [expanded, setExpanded] = useState(true);
  const lines = stripAnsi(output).split('\n');
  const preview = lines.slice(0, 6).join('\n');
  const hasMore = lines.length > 6;

  return (
    <div className="rounded-lg border border-sky-400/[0.12] bg-sky-500/[0.04] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-sky-500/[0.04] transition-colors"
      >
        <span className="text-sky-400/50 text-[11px] font-mono shrink-0">$</span>
        <span className="flex-1 font-mono text-[11px] text-sky-300 truncate">{display}</span>
        <span className="shrink-0 text-[9px] text-sky-400/40">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && output && (
        <div className="border-t border-sky-400/[0.08] px-3 py-2">
          <pre className="font-mono text-[11px] leading-relaxed text-white/50 whitespace-pre-wrap">
            {hasMore && !expanded ? preview + '\n…' : stripAnsi(output)}
          </pre>
          {hasMore && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-1 text-[10px] text-sky-400/40 hover:text-sky-400/70 transition-colors"
            >
              {expanded ? 'collapse' : `show ${lines.length} lines`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main terminal ─────────────────────────────────────────────────────────────

export function BudTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      type: 'intro',
      text: 'Bud Terminal  ·  claude-haiku-4-5  ·  budsatwork.com\nAsk anything about the codebase. Tools: read files, list directories, search, git, tsc.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const appendLine = useCallback((line: TerminalLine) => {
    setLines(prev => [...prev, line]);
  }, []);

  const removeThinking = useCallback(() => {
    setLines(prev => prev.filter(l => l.type !== 'thinking'));
  }, []);

  const submit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput('');
    setHistoryIdx(-1);
    setInputHistory(prev => [trimmed, ...prev].slice(0, 50));

    const newHistory: HistoryMessage[] = [...history, { role: 'user', content: trimmed }];
    setHistory(newHistory);

    setLines(prev => [...prev, { type: 'user', text: trimmed }, { type: 'thinking' }]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/bud/terminal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        removeThinking();
        appendLine({ type: 'error', message: `HTTP ${res.status}` });
        return;
      }

      removeThinking();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const raw = part.trim();
          if (!raw.startsWith('data:')) continue;
          const json = raw.slice(5).trim();
          if (!json) continue;

          try {
            const event = JSON.parse(json) as { type: string; [key: string]: unknown };

            if (event.type === 'tool') {
              appendLine({
                type: 'tool',
                name: event.name as string,
                display: event.display as string,
                output: event.output as string,
              });
            } else if (event.type === 'text') {
              const content = event.content as string;
              assistantText += (assistantText ? '\n' : '') + content;
              appendLine({ type: 'text', content });
            } else if (event.type === 'error') {
              appendLine({ type: 'error', message: event.message as string });
            }
            // 'done' is a no-op — stream closes naturally
          } catch { /* malformed event */ }
        }
      }

      // Update conversation history with assistant reply
      if (assistantText) {
        setHistory(prev => [...prev, { role: 'assistant', content: assistantText }]);
      }
    } catch (e) {
      removeThinking();
      if ((e as Error).name !== 'AbortError') {
        appendLine({ type: 'error', message: String(e) });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [loading, history, appendLine, removeThinking]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit(input);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIdx + 1, inputHistory.length - 1);
      setHistoryIdx(next);
      setInput(inputHistory[next] ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(historyIdx - 1, -1);
      setHistoryIdx(next);
      setInput(next === -1 ? '' : inputHistory[next] ?? '');
    }
  };

  const clear = () => {
    setLines([]);
    setHistory([]);
  };

  const cancel = () => {
    abortRef.current?.abort();
    setLoading(false);
    removeThinking();
  };

  return (
    <div
      className="rounded-2xl border border-emerald-400/20 bg-[#0a0f0a] flex flex-col overflow-hidden"
      style={{ height: 640 }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* ── Title bar ──────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-emerald-400/[0.10] bg-[#0d1a0d]/90 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/60" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
          <div className="h-3 w-3 rounded-full bg-emerald-500/60" />
        </div>
        <span className="flex-1 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400/40">
          bud terminal
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); clear(); }}
          className="font-mono text-[10px] text-emerald-400/30 transition-colors hover:text-emerald-400/60"
        >
          clear
        </button>
      </div>

      {/* ── Output area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {lines.map((line, i) => {
          if (line.type === 'intro') {
            return (
              <pre key={i} className="font-mono text-[11px] leading-relaxed text-emerald-400/50 whitespace-pre-wrap">
                {line.text}
              </pre>
            );
          }
          if (line.type === 'user') {
            return (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 font-mono text-sm text-emerald-400">❯</span>
                <span className="font-mono text-sm text-emerald-200 break-words">{line.text}</span>
              </div>
            );
          }
          if (line.type === 'thinking') {
            return <Thinking key={i} />;
          }
          if (line.type === 'tool') {
            return <ToolBlock key={i} display={line.display} output={line.output} />;
          }
          if (line.type === 'text') {
            return (
              <div key={i} className="font-mono text-[12px] leading-relaxed text-white/70 whitespace-pre-wrap">
                {line.content}
              </div>
            );
          }
          if (line.type === 'error') {
            return (
              <div key={i} className="font-mono text-[11px] text-red-400/80">
                ✗ {line.message}
              </div>
            );
          }
          return null;
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggestion chips ───────────────────────────────────────────────── */}
      {lines.length <= 1 && !loading && (
        <div className="shrink-0 flex flex-wrap gap-1.5 px-4 pb-3">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); void submit(s); }}
              className="rounded-full border border-emerald-400/[0.12] bg-emerald-500/[0.04] px-2.5 py-1 font-mono text-[10px] text-emerald-400/60 transition-colors hover:border-emerald-400/25 hover:text-emerald-400/90"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 border-t border-emerald-400/[0.10] bg-[#0d1a0d]/60 px-4 py-3">
        <span className="shrink-0 font-mono text-sm text-emerald-400">❯</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder={loading ? 'thinking…' : 'ask anything · ↑↓ history · enter to run'}
          className="flex-1 bg-transparent font-mono text-sm text-emerald-100 outline-none placeholder:text-emerald-400/20 disabled:opacity-40"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
        {loading ? (
          <button
            onClick={(e) => { e.stopPropagation(); cancel(); }}
            className="shrink-0 font-mono text-[10px] text-red-400/60 transition-colors hover:text-red-400/90"
          >
            ⌃C
          </button>
        ) : (
          input.trim() && (
            <button
              onClick={(e) => { e.stopPropagation(); void submit(input); }}
              className="shrink-0 font-mono text-[10px] text-emerald-400/40 transition-colors hover:text-emerald-400/70"
            >
              ↵
            </button>
          )
        )}
      </div>
    </div>
  );
}
