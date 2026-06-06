-- 106_unified_messaging.sql
-- Unified Messaging System — admin-only internal hub.
-- Covers: Customer / Crew / Lead / Applicant conversations + message thread.
-- No public portal exposure. Delivery status stays 'draft' until explicitly sent.

-- ──────────────────────────────────────────────────────────────────────────────
-- conversations
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('customer', 'crew', 'lead', 'applicant')),
  entity_id     uuid not null,
  subject       text,
  status        text not null default 'open' check (status in ('open', 'closed', 'archived')),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.conversations is
  'One conversation thread per entity (customer/crew/lead/applicant). Admin-only.';

-- ──────────────────────────────────────────────────────────────────────────────
-- messages
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  sender_type       text not null default 'admin' check (sender_type in ('admin', 'entity')),
  sender_id         uuid references auth.users(id) on delete set null,
  body              text not null,
  channel           text not null default 'internal' check (channel in ('internal', 'sms', 'email')),
  delivery_status   text not null default 'draft' check (
                      delivery_status in ('draft', 'queued', 'sent', 'delivered', 'failed')
                    ),
  created_at        timestamptz not null default now()
);

comment on table public.messages is
  'Individual messages in a conversation. delivery_status=draft until explicitly sent.';

-- ──────────────────────────────────────────────────────────────────────────────
-- Auto-update conversations.updated_at when a new message is inserted
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_conversation_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
  set updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists trg_messages_touch_conversation on public.messages;
create trigger trg_messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────────────────────────
create index if not exists idx_conversations_entity
  on public.conversations(entity_type, entity_id);

create index if not exists idx_conversations_status
  on public.conversations(status);

create index if not exists idx_messages_conversation
  on public.messages(conversation_id, created_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS — admin-only (matches the existing admin patterns in the codebase).
-- Service role bypasses RLS for API routes.
-- ──────────────────────────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- conversations
create policy "conversations_admin_all" on public.conversations
  for all to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.role = 'admin'
    )
  );

-- messages
create policy "messages_admin_all" on public.messages
  for all to authenticated
  using (
    exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.employees e
      where e.user_id = auth.uid() and e.role = 'admin'
    )
  );
