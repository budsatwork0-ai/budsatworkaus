-- 107_silvan_consent_granted.sql
-- Records Silvan's granted consent status.
-- Consent obtained and confirmed by Jackson Taylor on 2026-06-06.
--
-- Effect: AI may now suggest Silvan-related story updates and include
-- Silvan's character profile in draft generation context.
-- Public-facing drafts still require safety review before publishing.
-- what_to_show and what_to_protect boundaries remain enforced at all times.
-- Private journal entries are never directly quoted in any content output.

update public.story_characters
set
  consent_status = 'granted',
  consent_notes  = 'Consent obtained by Jackson Taylor. Confirmed 2026-06-06. AI may suggest Silvan-related story updates and include his character profile in draft context. All public-facing drafts must pass safety review. Private journal entries must never be directly quoted. Content must respect what_to_show and what_to_protect boundaries at all times.'
where slug = 'silvan'
  and (consent_status is null or consent_status != 'granted');
