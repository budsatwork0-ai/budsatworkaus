-- Phase 4C: Distribution Playbooks
-- Manual distribution instructions and checklists.
-- No social channels, platform integrations, auto-posting, AI captions/generation,
-- agents, automations, analytics dashboards, or Research Lab functionality.

create table if not exists public.marketing_distribution_playbooks (
  id                    uuid        primary key default gen_random_uuid(),
  title                 text        not null,
  description           text        not null default '',
  content_type          text        not null default '',
  primary_platform      text        not null default '',
  secondary_platforms   text[]      not null default '{}',
  steps                 text[]      not null default '{}',
  checklist             text[]      not null default '{}',
  linked_campaign_id    uuid        references public.marketing_campaigns(id) on delete set null,
  status                text        not null default 'draft'
                                      check (status in ('active', 'draft', 'archived')),
  notes                 text        not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (title)
);

create index if not exists idx_marketing_distribution_playbooks_status   on public.marketing_distribution_playbooks(status);
create index if not exists idx_marketing_distribution_playbooks_campaign on public.marketing_distribution_playbooks(linked_campaign_id);
create index if not exists idx_marketing_distribution_playbooks_platform on public.marketing_distribution_playbooks(primary_platform);

-- updated_at trigger
create or replace function public.handle_marketing_distribution_playbooks_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_marketing_distribution_playbooks_updated_at on public.marketing_distribution_playbooks;
create trigger set_marketing_distribution_playbooks_updated_at
  before update on public.marketing_distribution_playbooks
  for each row execute function public.handle_marketing_distribution_playbooks_updated_at();

-- RLS: admin/owner only
alter table public.marketing_distribution_playbooks enable row level security;

drop policy if exists "Admins manage marketing distribution playbooks" on public.marketing_distribution_playbooks;
create policy "Admins manage marketing distribution playbooks"
  on public.marketing_distribution_playbooks for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'owner')
  ));

insert into public.marketing_distribution_playbooks (
  title,
  description,
  content_type,
  primary_platform,
  secondary_platforms,
  steps,
  checklist,
  status,
  notes
) values
  (
    'Day-in-the-life post',
    'Manual checklist for turning a real workday into a grounded story post.',
    'day_in_the_life',
    'instagram',
    array['tiktok', 'facebook'],
    array[
      'Pick one real moment from the day.',
      'Connect the moment to the current story arc or acquisition purpose.',
      'Choose the strongest visual proof from the Publishing Queue item.',
      'Write a plain caption placeholder manually.',
      'Record manual publishing notes after posting.'
    ],
    array[
      'Consent checked',
      'Queue item linked',
      'Caption reviewed by human',
      'No customer details exposed without approval',
      'Manual publish recorded'
    ],
    'active',
    'Manual instruction set only.'
  ),
  (
    'Customer success story',
    'Manual checklist for telling a customer outcome with consent and specificity.',
    'customer_success',
    'facebook',
    array['instagram', 'website'],
    array[
      'Confirm the customer outcome and permission boundaries.',
      'Summarise the before state manually.',
      'Describe the service moment without exaggeration.',
      'Include the after state and practical result.',
      'Log what was published manually.'
    ],
    array[
      'Customer consent verified',
      'Before and after facts checked',
      'No private information included',
      'Queue item linked',
      'Manual publish recorded'
    ],
    'active',
    'Do not generate testimonials or outcomes.'
  ),
  (
    'Milestone announcement',
    'Manual checklist for sharing business milestones without turning them into ads.',
    'milestone',
    'linkedin',
    array['facebook', 'website'],
    array[
      'Name the milestone plainly.',
      'Explain why it matters to the Buds At Work story.',
      'Credit the people or customers involved where appropriate.',
      'Tie the milestone to the next practical step.',
      'Record the manual publish result.'
    ],
    array[
      'Milestone fact checked',
      'Story arc link considered',
      'Tone reviewed',
      'Queue item linked if relevant',
      'Manual publish recorded'
    ],
    'active',
    'Keep milestone posts grounded and specific.'
  ),
  (
    'Employment journey update',
    'Manual checklist for updates about hiring, onboarding, and crew growth.',
    'employment_journey',
    'linkedin',
    array['facebook', 'instagram'],
    array[
      'Identify the real employment journey moment.',
      'Check privacy and consent before naming anyone.',
      'Connect the update to mission, standards, or crew growth.',
      'Keep the caption practical and human-written.',
      'Record manual publish notes.'
    ],
    array[
      'Crew/applicant privacy checked',
      'Consent verified where needed',
      'No sensitive employment details included',
      'Queue item linked',
      'Manual publish recorded'
    ],
    'active',
    'No automated hiring or applicant messaging.'
  ),
  (
    'Before/after service post',
    'Manual checklist for service transformation content with clear consent.',
    'before_after_service',
    'instagram',
    array['facebook', 'tiktok'],
    array[
      'Select a clear before and after pair.',
      'Verify customer/property consent before use.',
      'Describe the service scope without overclaiming.',
      'Add a manual caption placeholder and CTA.',
      'Record the manual publish event.'
    ],
    array[
      'Before image approved',
      'After image approved',
      'Consent verified',
      'Queue item linked',
      'Manual publish recorded'
    ],
    'active',
    'No automated image selection or caption generation.'
  )
on conflict do nothing;
