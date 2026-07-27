'use client';

/**
 * MessagingHub
 * ────────────────────────────────────────────────────────────────────────────
 * Slide-over panel for admin internal messaging.
 *
 * Modes:
 *  - Global inbox   (entityContext === undefined): shows full conversation list
 *  - Scoped entity  (entityContext provided): opens / creates a conversation
 *    for a specific Customer / Crew / Lead / Applicant
 *
 * The hub is mounted once in DashboardLayout and kept in the DOM so open/close
 * is cheap — no re-fetch on every open when data is fresh.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Conversation,
  EntityContext,
  Message,
} from '@/types/messaging';
import {
  createConversation as createConversationRequest,
  fetchConversations as fetchConversationsRequest,
  fetchConversationThread,
  sendMessage as sendMessageRequest,
  updateConversationStatus,
} from '@/lib/messaging/client';
import { entityBadgeColor, entityLabel, MessageBubble, relativeTime } from './messaging/shared';

// ─── types ─────────────────────────────────────────────────────────────────────

type View = 'inbox' | 'thread';

// ─── sub-components ────────────────────────────────────────────────────────────

function InboxRow({
  conv,
  onSelect,
}: {
  conv: Conversation;
  onSelect: (c: Conversation) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(conv)}
      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${entityBadgeColor(conv.entity_type)}`}>
            {entityLabel(conv.entity_type)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {conv.entity_display_name ?? conv.subject ?? 'Conversation'}
            </p>
            <span className="text-[11px] text-slate-400 shrink-0">
              {relativeTime(conv.updated_at)}
            </span>
          </div>
          {conv.last_message && (
            <p className="text-xs text-slate-500 truncate mt-0.5">{conv.last_message}</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

export interface MessagingHubProps {
  open: boolean;
  onClose: () => void;
  /** When provided, opens in scoped mode for this entity */
  entityContext?: EntityContext;
}

export function MessagingHub({ open, onClose, entityContext }: MessagingHubProps) {
  const isScoped = Boolean(entityContext);

  const [view, setView]                   = useState<View>(isScoped ? 'thread' : 'inbox');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv]       = useState<Conversation | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [draft, setDraft]                 = useState('');
  const [loadingList, setLoadingList]     = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  /** For scoped mode: true when no conversation exists yet for the entity */
  const [isNewConv, setIsNewConv]         = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── data fetching ──────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const conversations = await fetchConversationsRequest();
      setConversations(conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const fetchThread = useCallback(async (convId: string) => {
    setLoadingThread(true);
    setError(null);
    try {
      const { conversation, messages } = await fetchConversationThread(convId);
      setActiveConv(conversation);
      setMessages(messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingThread(false);
    }
  }, []);

  /** Scoped mode: query for an existing open conversation for this entity */
  const findOrPrepareEntityConv = useCallback(async (ctx: EntityContext) => {
    setLoadingThread(true);
    setError(null);
    try {
      const found = await fetchConversationsRequest({
        entity_type: ctx.entity_type,
        entity_id:   ctx.entity_id,
        status:      'open',
      });

      if (found.length > 0) {
        // Found existing conversation — open it
        const conv = found[0];
        setActiveConv(conv);
        setIsNewConv(false);
        await fetchThread(conv.id);
      } else {
        // No existing conversation — show blank new-conv form
        setActiveConv(null);
        setIsNewConv(true);
        setMessages([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingThread(false);
    }
  }, [fetchThread]);

  // ── mount / open effects ──────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    if (isScoped && entityContext) {
      setView('thread');
      void findOrPrepareEntityConv(entityContext);
    } else {
      setView('inbox');
      void fetchConversations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityContext?.entity_id]);

  // Auto-scroll to bottom when messages load or new one arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── actions ────────────────────────────────────────────────────────────────

  const openThread = useCallback((conv: Conversation) => {
    setView('thread');
    setIsNewConv(false);
    void fetchThread(conv.id);
  }, [fetchThread]);

  const goBackToInbox = useCallback(() => {
    setView('inbox');
    setActiveConv(null);
    setMessages([]);
    setIsNewConv(false);
    setError(null);
    void fetchConversations();
  }, [fetchConversations]);

  const sendMessage = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    try {
      // If this is a brand-new conversation, create it first
      let convId = activeConv?.id;
      if (!convId && isNewConv && entityContext) {
        const newConv = await createConversationRequest({
          entity_type: entityContext.entity_type,
          entity_id:   entityContext.entity_id,
          subject:     `Conversation with ${entityContext.display_name}`,
        });
        setActiveConv(newConv);
        setIsNewConv(false);
        convId = newConv.id;
      }

      if (!convId) throw new Error('No conversation ID');

      const message = await sendMessageRequest(convId, trimmed);
      setMessages((prev) => [...prev, message]);
      setDraft('');
      textareaRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  }, [draft, sending, activeConv, isNewConv, entityContext]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void sendMessage();
    }
  }, [sendMessage]);

  const closeConversation = useCallback(async () => {
    if (!activeConv) return;
    try {
      const updated = await updateConversationStatus(activeConv.id, 'closed');
      setActiveConv(updated);
      if (!isScoped) void goBackToInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [activeConv, isScoped, goBackToInbox]);

  // ── header label ──────────────────────────────────────────────────────────

  const headerTitle = (() => {
    if (view === 'inbox') return 'Messages';
    if (isNewConv && entityContext) return `New — ${entityContext.display_name}`;
    if (activeConv?.entity_display_name) return activeConv.entity_display_name;
    if (activeConv?.subject) return activeConv.subject;
    return 'Conversation';
  })();

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Slide-over panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 38 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
              {view === 'thread' && !isScoped && (
                <button
                  type="button"
                  onClick={goBackToInbox}
                  className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                  aria-label="Back to inbox"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 5l-7 7 7 7" />
                  </svg>
                </button>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-slate-900 truncate">{headerTitle}</p>
                {view === 'thread' && activeConv && (
                  <p className="text-[11px] text-slate-400 capitalize">
                    {entityLabel(activeConv.entity_type)}
                    {activeConv.status !== 'open' && (
                      <span className="ml-1.5 font-medium text-amber-500 capitalize">· {activeConv.status}</span>
                    )}
                  </p>
                )}
                {view === 'thread' && isNewConv && entityContext && (
                  <p className="text-[11px] text-slate-400 capitalize">
                    {entityLabel(entityContext.entity_type)} · new conversation
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Close conversation (only in thread view when open) */}
                {view === 'thread' && activeConv?.status === 'open' && (
                  <button
                    type="button"
                    onClick={() => void closeConversation()}
                    className="rounded-full px-3 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
                    title="Mark as closed"
                  >
                    Close
                  </button>
                )}

                {/* New conversation (inbox mode) */}
                {view === 'inbox' && (
                  <button
                    type="button"
                    onClick={() => {
                      setView('thread');
                      setIsNewConv(false);
                      setActiveConv(null);
                      setMessages([]);
                    }}
                    className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                    aria-label="New conversation"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                  aria-label="Close messaging"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {error}
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="ml-2 underline text-xs"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ── INBOX VIEW ──────────────────────────────────────────────── */}
            {view === 'inbox' && (
              <div className="flex-1 overflow-y-auto">
                {loadingList ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <svg
                      className="text-slate-300"
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <p className="text-sm text-slate-400">No conversations yet</p>
                  </div>
                ) : (
                  conversations.map((c) => (
                    <InboxRow key={c.id} conv={c} onSelect={openThread} />
                  ))
                )}
              </div>
            )}

            {/* ── THREAD VIEW ──────────────────────────────────────────────── */}
            {view === 'thread' && (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {loadingThread ? (
                    <div className="space-y-3">
                      {[1, 2].map((n) => (
                        <div key={n} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2">
                      <p className="text-sm text-slate-400">
                        {isNewConv
                          ? 'Start a conversation by sending a message below.'
                          : 'No messages yet. Send the first one.'}
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => <MessageBubble key={m.id} msg={m} />)
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Compose bar */}
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={textareaRef}
                      rows={2}
                      className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1C7C54] focus:outline-none focus:ring-2 focus:ring-[#1C7C54]/20"
                      placeholder="Write a message… (⌘↵ to send)"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sending || activeConv?.status === 'closed' || activeConv?.status === 'archived'}
                    />
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={!draft.trim() || sending || activeConv?.status === 'closed' || activeConv?.status === 'archived'}
                      className="shrink-0 rounded-xl bg-[#1C7C54] p-2.5 text-white shadow-sm transition hover:bg-[#175e41] disabled:opacity-40 disabled:cursor-not-allowed"
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
