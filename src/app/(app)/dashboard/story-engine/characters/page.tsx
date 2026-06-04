'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  CHARACTER_PROFILE_FIELDS,
  type StoryCharacter,
  type CharacterEditableKey,
} from '@/types/story-engine';

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Canonical display order — slugs determine card order
const CHARACTER_ORDER = ['jackson-taylor', 'silvan', 'buds-at-work'];

export default function CharactersPage() {
  const [characters, setCharacters] = useState<StoryCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/story-characters');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      const sorted = (json.characters ?? []).sort(
        (a: StoryCharacter, b: StoryCharacter) =>
          CHARACTER_ORDER.indexOf(a.slug) - CHARACTER_ORDER.indexOf(b.slug),
      );
      setCharacters(sorted);
    } catch {
      setError('Could not load characters.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function updateCharacter(updated: StoryCharacter) {
    setCharacters((prev) => prev.map((c) => c.id === updated.id ? updated : c));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Story Engine"
        title="Characters"
        description="Three core characters anchor the Buds At Work story. Each character has a profile, a narrative role, and a set of boundaries. Manual editing only — no AI generation."
      />

      <NoAINote />

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-[24px] border border-black/5 bg-white/90 px-6 py-16 text-center">
          <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>Loading…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {characters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              onSaved={updateCharacter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Character card ───────────────────────────────────────────────────────────

type CharacterCardProps = {
  character: StoryCharacter;
  onSaved: (updated: StoryCharacter) => void;
};

type CharacterDraft = Record<CharacterEditableKey, string | null>;

function buildDraft(c: StoryCharacter): CharacterDraft {
  return {
    profile:              c.profile ?? '',
    role_in_story:        c.role_in_story ?? '',
    voice_perspective:    c.voice_perspective ?? '',
    content_posture:      c.content_posture ?? '',
    what_to_show:         c.what_to_show ?? '',
    what_to_protect:      c.what_to_protect ?? '',
    active_story_threads: c.active_story_threads ?? '',
    consent_status:       c.consent_status ?? '',
    consent_notes:        c.consent_notes ?? '',
  };
}

function CharacterCard({ character, onSaved }: CharacterCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CharacterDraft>(() => buildDraft(character));
  const [saving, setSaving] = useState(false);

  const isSilvan = character.slug === 'silvan';

  function update(key: CharacterEditableKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function cancel() {
    setDraft(buildDraft(character));
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    try {
      // Normalise empty strings to null for nullable fields
      const payload: Partial<CharacterDraft> = { ...draft };
      for (const k of Object.keys(payload) as CharacterEditableKey[]) {
        if (typeof payload[k] === 'string' && !(payload[k] as string).trim()) {
          payload[k] = null;
        }
      }

      const res = await fetch(`/api/story-characters/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Save failed');
      }
      const saved: StoryCharacter = await res.json();
      onSaved(saved);
      setEditing(false);
      toast.success(`${character.name} saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Fields to show: consent fields only for Silvan
  const visibleFields = CHARACTER_PROFILE_FIELDS.filter(
    (f) => !f.consentOnly || isSilvan,
  );

  return (
    <div className="rounded-[28px] border border-black/5 bg-white/90 shadow-[0_12px_30px_rgba(15,23,42,0.05)] overflow-hidden">
      {/* Character header */}
      <div
        className="px-6 py-5"
        style={{ background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.02em]" style={{ color: dashboardTheme.color.primary }}>
              {character.name}
            </h2>
            {character.role_in_story && !editing && (
              <p className="mt-1 text-sm" style={{ color: dashboardTheme.color.muted }}>
                {character.role_in_story}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isSilvan && (
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{ background: '#FEF2F2', color: '#B91C1C' }}
              >
                Consent gate
              </span>
            )}
            {!editing && (
              <button
                type="button"
                onClick={() => { setDraft(buildDraft(character)); setEditing(true); }}
                className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-white/80"
                style={{ background: 'rgba(255,255,255,0.6)', color: dashboardTheme.color.muted }}
              >
                Edit profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Silvan consent sensitivity banner */}
      {isSilvan && (
        <div
          className="mx-5 mt-4 rounded-xl border px-4 py-3"
          style={{ background: '#FEF2F2', borderColor: 'rgba(239,68,68,0.2)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: '#B91C1C' }}>
            Consent sensitivity — read before editing
          </p>
          <p className="mt-1 text-sm leading-6" style={{ color: '#991B1B' }}>
            Silvan's profile requires explicit consent before any content use. Record consent status accurately.
            Do not use Silvan's story in content without confirming consent applies to that specific context.
          </p>
        </div>
      )}

      {/* Fields */}
      <div className="flex flex-col gap-4 p-5">
        {visibleFields.map((field) => {
          const value = (draft[field.key] as string | null) ?? '';
          const savedValue = (character[field.key as keyof StoryCharacter] as string | null) ?? '';
          const isEmpty = !savedValue.trim();
          const isConsentField = field.consentOnly;

          return (
            <div
              key={field.key}
              className="rounded-[20px] border border-black/5 p-4"
              style={isConsentField ? { background: '#FFF7F7' } : { background: '#FAFAFA' }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: isConsentField ? '#B91C1C' : dashboardTheme.color.primary }}>
                    {field.label}
                    {isConsentField && (
                      <span className="ml-2 text-[10px] font-normal rounded-full px-2 py-0.5" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                        Silvan only
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: dashboardTheme.color.muted }}>
                    {field.description}
                  </p>
                </div>
              </div>

              {editing ? (
                <textarea
                  value={value}
                  onChange={(e) => update(field.key, e.target.value)}
                  rows={field.rows}
                  placeholder={field.placeholder}
                  className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
                  style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
                />
              ) : isEmpty ? (
                <p className="text-sm italic" style={{ color: dashboardTheme.color.muted, opacity: 0.6 }}>
                  Not filled in yet.
                </p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-7" style={{ color: dashboardTheme.color.text }}>
                  {savedValue}
                </p>
              )}
            </div>
          );
        })}

        {/* Character Timeline — placeholder */}
        <div
          className="rounded-[20px] border-2 border-dashed p-5 text-center"
          style={{ borderColor: 'rgba(15,61,46,0.12)' }}
        >
          <p className="text-sm font-semibold" style={{ color: dashboardTheme.color.muted }}>
            Character Timeline
          </p>
          <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted, opacity: 0.7 }}>
            Placeholder — chronological event record wired in a future phase.
          </p>
        </div>

        {/* Edit action bar */}
        {editing && (
          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-[20px] border border-black/5 bg-white/95 px-5 py-4 shadow-[0_8px_32px_rgba(15,23,42,0.10)] backdrop-blur">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
              style={{ background: dashboardTheme.color.primary }}
            >
              {saving ? 'Saving…' : `Save ${character.name}`}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-black/5 px-5 py-3">
        <p className="text-[11px] font-mono" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
          Last updated {formatTimestamp(character.updated_at)}
          {isSilvan && ' · Consent gate enforced at record level'}
        </p>
      </div>
    </div>
  );
}

// ─── Notes ────────────────────────────────────────────────────────────────────

function NoAINote() {
  return (
    <div
      className="rounded-[20px] border px-4 py-3"
      style={{ background: '#F0FDF4', borderColor: 'rgba(16,185,129,0.2)' }}
    >
      <p className="text-[11px] font-semibold" style={{ color: '#065F46' }}>
        Manual editing only — No AI may generate or modify character profiles.
      </p>
      <p className="mt-1 text-xs" style={{ color: '#047857' }}>
        Owner: Jackson Taylor. No public exposure. Silvan's profile requires consent confirmation before any content use.
      </p>
    </div>
  );
}
