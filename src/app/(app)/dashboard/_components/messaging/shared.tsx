'use client';

// Shared presentational helpers used by both the MessagingHub drawer and the
// full-page /dashboard/messages route, so message/entity styling can't drift
// between the two surfaces.

import type { Message } from '@/types/messaging';

export function relativeTime(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function entityLabel(type: string): string {
  const map: Record<string, string> = {
    customer: 'Customer',
    crew:     'Crew',
    lead:     'Lead',
    applicant: 'Applicant',
  };
  return map[type] ?? type;
}

export function entityBadgeColor(type: string): string {
  const map: Record<string, string> = {
    customer:  'bg-blue-50 text-blue-700',
    crew:      'bg-green-50 text-green-700',
    lead:      'bg-amber-50 text-amber-700',
    applicant: 'bg-purple-50 text-purple-700',
  };
  return map[type] ?? 'bg-slate-50 text-slate-600';
}

export function MessageBubble({ msg }: { msg: Message }) {
  const isAdmin = msg.sender_type === 'admin';
  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isAdmin
            ? 'bg-[#1C7C54] text-white rounded-br-md'
            : 'bg-slate-100 text-slate-900 rounded-bl-md'
        }`}
      >
        <p>{msg.body}</p>
        <p className={`text-[10px] mt-1 ${isAdmin ? 'text-white/60' : 'text-slate-400'}`}>
          {relativeTime(msg.created_at)}
          {msg.delivery_status === 'draft' && isAdmin && (
            <span className="ml-1 opacity-70">· draft</span>
          )}
        </p>
      </div>
    </div>
  );
}
