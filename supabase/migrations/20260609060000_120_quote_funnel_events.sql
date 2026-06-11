-- Quote funnel analytics: every meaningful step a visitor takes from
-- service selection through quote submission, with timing and change-count
-- data attached so drop-off rates and configuration friction can be measured.

create table if not exists quote_funnel_events (
  id                  bigserial    primary key,
  session_id          text         not null,
  event_name          text         not null,  -- service_selected | card_expanded | config_started | add_to_quote | quote_submitted
  service             text,
  scope               text,
  context             text,                   -- home | commercial | ndis
  time_spent_seconds  integer,               -- seconds from card_expanded to add_to_quote
  config_changes      integer,               -- number of wizard-param mutations while card was open
  quote_submitted     boolean,
  created_at          timestamptz  not null default now()
);

create index quote_funnel_events_session_idx    on quote_funnel_events (session_id);
create index quote_funnel_events_event_idx      on quote_funnel_events (event_name);
create index quote_funnel_events_service_idx    on quote_funnel_events (service);
create index quote_funnel_events_created_idx    on quote_funnel_events (created_at desc);
