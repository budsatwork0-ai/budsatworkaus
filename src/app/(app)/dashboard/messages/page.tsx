'use client';

/**
 * /dashboard/messages
 * ────────────────────────────────────────────────────────────────────────────
 * Full desktop-first messaging page: a stable two-panel layout (conversation
 * list + selected thread) that always resolves to one of ready / empty /
 * error — never an indefinite loader.
 *
 * This route renders its own self-contained inbox and does NOT open the
 * global MessagingHub slide-over (see shouldRenderGlobalMessagingDrawer in
 * DashboardLayout) — that drawer is for quick access from other pages and
 * for entity-scoped conversations (Customers/Crew/Leads/Applicants), not for
 * this dedicated route. Rendering both at once produced the duplicate
 * "Messages" heading and the mixed drawer/page controls this page used to
 * have.
 *
 * Below `md` (mobile), only one pane is visible at a time based on selection
 * — CSS-only, via getMasterDetailVisibilityClasses, matching the rest of the
 * dashboard's responsive convention (no JS viewport hook).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { glass, glassSoft } from '@/app/ui/theme';
import type { Conversation, Message } from '@/types/messaging';
import {
  fetchConversations,
  fetchConversationThread,
  sendMessage as sendMessageRequest,
  updateConversationStatus,
} from '@/lib/messaging/client';
import {
  getMasterDetailVisibilityClasses,
  resolveMessagesPageView,
  type ConversationsListStatus,
} from '@/lib/messaging/pageState';
import { entityBadgeColor, entityLabel, MessageBubble, relativeTime } from '../_components/messaging/shared';

type ThreadStatus = 'idle' | 'loading' | 'loaded' | 'error';

function conversationTitle(conv: Conversation): string {
  return conv.entity_display_name ?? conv.subject ?? 'Conversation';
}

export default function MessagesPage() {
  const [listStatus, setListStatus] = useState<ConversationsListStatus>('idle');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>('idle');
  const [threadError, setThreadError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  // Guards against a slow thread request for a conversation the user has
  // since clicked away from overwriting the currently selected thread.
  const threadRequestId = useRef(0);

  // ── conversation list ──────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    setListStatus('loading');
    setListError(null);
    try {
      const result = await fetchConversations();
      setConversations(result);
      setListStatus('loaded');
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Unknown error');
      setListStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // ── selected thread ────────────────────────────────────────────────────

  const openConversation = useCallback(async (conv: Conversation) => {
    setSelectedId(conv.id);
    setSelectedConv(conv);
    setThreadStatus('loading');
    setThreadError(null);

    const requestId = ++threadRequestId.current;
    try {
      const { conversation, messages: threadMessages } = await fetchConversationThread(conv.id);
      if (threadRequestId.current !== requestId) return; // a newer selection has since superseded this request
      setSelectedConv(conversation);
      setMessages(threadMessages);
      setThreadStatus('loaded');
    } catch (err) {
      if (threadRequestId.current !== requestId) return;
      setThreadError(err instanceof Error ? err.message : 'Unknown error');
      setThreadStatus('error');
    }
  }, []);

  const retryThread = useCallback(() => {
    if (selectedConv) void openConversation(selectedConv);
  }, [selectedConv, openConversation]);

  const deselectConversation = useCallback(() => {
    threadRequestId.current += 1; // invalidate any in-flight thread request
    setSelectedId(null);
    setSelectedConv(null);
    setMessages([]);
    setThreadStatus('idle');
    setThreadError(null);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── actions ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending || !selectedId) return;

    setSending(true);
    setThreadError(null);
    try {
      const message = await sendMessageRequest(selectedId, trimmed);
      setMessages((prev) => [...prev, message]);
      setDraft('');
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  }, [draft, sending, selectedId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void sendMessage();
    }
  }, [sendMessage]);

  const closeConversation = useCallback(async () => {
    if (!selectedConv) return;
    try {
      const updated = await updateConversationStatus(selectedConv.id, 'closed');
      setSelectedConv(updated);
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [selectedConv]);

  // ── derived state ───────────────────────────────────────────────────────

  const view = resolveMessagesPageView(listStatus);
  const visibleConversations = search.trim()
    ? conversations.filter((c) => {
        const haystack = `${conversationTitle(c)} ${c.last_message ?? ''}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      })
    : conversations;
  const { list: listPaneClass, detail: detailPaneClass } = getMasterDetailVisibilityClasses(Boolean(selectedId));

  // ── render ──────────────────────────────────────────────────────────────

  if (view === 'opening') {
    return (
      <div className={`${glass} flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-3xl p-8`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1C7C54]/30 border-t-[#1C7C54]" />
        <p className="text-sm text-slate-500">Opening messages&hellip;</p>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className={`${glass} flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-3xl p-8 text-center`}>
        <p className="text-sm font-medium text-red-700">Couldn&rsquo;t load conversations</p>
        <p className="text-sm text-slate-500">{listError}</p>
        <button
          type="button"
          onClick={() => void loadConversations()}
          className="mt-2 rounded-full bg-[#1C7C54] px-4 py-2 text-sm font-medium text-white hover:bg-[#175e41]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`${glass} flex h-[calc(100vh-190px)] min-h-[520px] overflow-hidden rounded-3xl`}>
      {/* ── Conversation list ─────────────────────────────────────────── */}
      <div className={`${listPaneClass} w-full flex-col border-r border-black/5 md:w-[340px] md:shrink-0`}>
        <div className="border-b border-black/5 p-4">
          <label className="sr-only" htmlFor="messages-search">Search conversations</label>
          <input
            id="messages-search"
            type="text"
            placeholder="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#1C7C54] focus:outline-none focus:ring-2 focus:ring-[#1C7C54]/20"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {visibleConversations.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-sm text-slate-400">
                {conversations.length === 0 ? 'No conversations yet' : 'No conversations match your search'}
              </p>
            </div>
          ) : (
            visibleConversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => void openConversation(conv)}
                aria-current={conv.id === selectedId}
                className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50 ${
                  conv.id === selectedId ? 'bg-[#1C7C54]/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${entityBadgeColor(conv.entity_type)}`}>
                    {entityLabel(conv.entity_type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{conversationTitle(conv)}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(conv.updated_at)}</span>
                    </div>
                    {conv.last_message && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{conv.last_message}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Selected thread / empty state ─────────────────────────────── */}
      <div className={`${detailPaneClass} w-full min-w-0 flex-1 flex-col`}>
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <svg className="text-slate-300" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p className="text-sm text-slate-400">Select a conversation to view messages.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3.5">
              <button
                type="button"
                onClick={deselectConversation}
                className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 md:hidden"
                aria-label="Back to conversation list"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-slate-900">
                  {selectedConv ? conversationTitle(selectedConv) : 'Conversation'}
                </p>
                {selectedConv && (
                  <p className="text-[11px] capitalize text-slate-400">
                    {entityLabel(selectedConv.entity_type)}
                    {selectedConv.status !== 'open' && (
                      <span className="ml-1.5 font-medium capitalize text-amber-500">· {selectedConv.status}</span>
                    )}
                  </p>
                )}
              </div>
              {selectedConv?.status === 'open' && (
                <button
                  type="button"
                  onClick={() => void closeConversation()}
                  className="shrink-0 rounded-full px-3 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
                  title="Mark as closed"
                >
                  Close
                </button>
              )}
            </div>

            {threadStatus === 'error' ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-sm font-medium text-red-700">Couldn&rsquo;t load this conversation</p>
                <p className="text-sm text-slate-500">{threadError}</p>
                <button
                  type="button"
                  onClick={retryThread}
                  className="mt-1 rounded-full bg-[#1C7C54] px-4 py-2 text-sm font-medium text-white hover:bg-[#175e41]"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {threadStatus === 'loading' ? (
                  <div className="space-y-3">
                    {[1, 2].map((n) => (
                      <div key={n} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center gap-2">
                    <p className="text-sm text-slate-400">No messages yet. Send the first one.</p>
                  </div>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} msg={m} />)
                )}
                <div ref={bottomRef} />
              </div>
            )}

            {threadError && threadStatus !== 'error' && (
              <div className={`${glassSoft} mx-4 mb-3 rounded-xl px-4 py-2.5 text-sm text-red-700`}>
                {threadError}
                <button type="button" onClick={() => setThreadError(null)} className="ml-2 text-xs underline">
                  Dismiss
                </button>
              </div>
            )}

            <div className="border-t border-black/5 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1C7C54] focus:outline-none focus:ring-2 focus:ring-[#1C7C54]/20"
                  placeholder="Write a message… (⌘↵ to send)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending || selectedConv?.status === 'closed' || selectedConv?.status === 'archived'}
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!draft.trim() || sending || selectedConv?.status === 'closed' || selectedConv?.status === 'archived'}
                  className="shrink-0 rounded-xl bg-[#1C7C54] p-2.5 text-white shadow-sm transition hover:bg-[#175e41] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  {sending ? (
                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                Messages are saved as drafts. No external delivery unless wired separately.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
