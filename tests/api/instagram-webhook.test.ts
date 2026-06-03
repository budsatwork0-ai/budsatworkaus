import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---------- supabase mock ----------------------------------------------------

type InsertCapture = { table: string; row: Record<string, unknown> };

let inserted: InsertCapture[] = [];
let existingLeadId: string | null = null;
let existingLeadSource: string | null = null;

function makeClient() {
  return {
    from(table: string) {
      const ctx: { table: string; filters: Record<string, unknown> } = {
        table,
        filters: {},
      };

      const chain = {
        select: (_: string) => chain,
        eq(col: string, val: unknown) {
          ctx.filters[col] = val;
          return chain;
        },
        is: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (
            ctx.table === 'leads' &&
            existingLeadId &&
            ctx.filters.source === existingLeadSource &&
            ctx.filters.external_ref
          ) {
            return { data: { id: existingLeadId }, error: null };
          }
          return { data: null, error: null };
        },
        single: async () => ({ data: null, error: new Error('single() not in mock') }),
        insert(row: Record<string, unknown>) {
          inserted.push({ table: ctx.table, row });
          return {
            select: () => ({
              single: async () => ({ data: { id: 'lead_mock_1' }, error: null }),
            }),
          };
        },
      };

      return chain;
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClientSafe: () => makeClient(),
  createServiceClient: () => makeClient(),
}));

// ---------- fetch mock (Graph API profile enrichment) ------------------------

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function mockGraphProfile(fields: Record<string, string>) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => fields,
  } as Response);
}

function noGraphProfile() {
  fetchMock.mockResolvedValueOnce({ ok: false } as Response);
}

// ---------- helpers ----------------------------------------------------------

function makeWebhookRequest(payload: unknown) {
  // HMAC verification bypasses in non-production when MESSENGER_APP_SECRET is unset.
  return new NextRequest('http://localhost/api/webhooks/messenger', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function messengerPayload(overrides: {
  mid?: string;
  psid?: string;
  text?: string;
  pageId?: string;
  ts?: number;
} = {}) {
  const psid = overrides.psid ?? 'PSID_messenger_1';
  return {
    object: 'page',
    entry: [{
      id: overrides.pageId ?? 'PAGE_1',
      messaging: [{
        sender: { id: psid },
        message: { mid: overrides.mid ?? 'm_msg1', text: overrides.text ?? 'Hello from Messenger' },
        timestamp: overrides.ts ?? 1_700_000_000,
      }],
    }],
  };
}

function instagramPayload(overrides: {
  mid?: string;
  igsid?: string;
  text?: string;
  pageId?: string;
  ts?: number;
} = {}) {
  const igsid = overrides.igsid ?? 'IGSID_1';
  return {
    object: 'instagram',
    entry: [{
      id: overrides.pageId ?? 'IG_PAGE_1',
      messaging: [{
        sender: { id: igsid },
        message: { mid: overrides.mid ?? 'ig_msg1', text: overrides.text ?? 'Hello from Instagram' },
        timestamp: overrides.ts ?? 1_700_000_001,
      }],
    }],
  };
}

// ---------- module import (after mocks) --------------------------------------

let route: typeof import('@/app/api/webhooks/messenger/route');

beforeEach(async () => {
  inserted = [];
  existingLeadId = null;
  existingLeadSource = null;
  fetchMock.mockReset();
  delete process.env.MESSENGER_APP_SECRET;
  delete process.env.MESSENGER_PAGE_ACCESS_TOKEN;
  route = await import('@/app/api/webhooks/messenger/route');
});

afterEach(() => {
  vi.resetModules();
});

// =============================================================================

describe('Instagram webhook — ingest', () => {
  it('processes object=instagram events (was previously skipped)', async () => {
    noGraphProfile();
    const res = await route.POST(makeWebhookRequest(instagramPayload()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(inserted.some((i) => i.table === 'leads')).toBe(true);
  });

  it('writes source=instagram on the lead', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload({ mid: 'ig_src_test' })));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.source).toBe('instagram');
  });

  it('writes external_ref from the message mid', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload({ mid: 'ig_mid_xyz' })));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.external_ref).toBe('ig_mid_xyz');
  });

  it('stores the IGSID in lead_conversations.metadata.sender_psid', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload({ igsid: 'IGSID_abc', mid: 'ig_meta' })));
    const conv = inserted.find((i) => i.table === 'lead_conversations');
    expect(conv?.row.metadata).toMatchObject({ sender_psid: 'IGSID_abc' });
  });

  it('sets channel=instagram on the conversation', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload()));
    const conv = inserted.find((i) => i.table === 'lead_conversations');
    expect(conv?.row.channel).toBe('instagram');
    expect(conv?.row.direction).toBe('inbound');
  });

  it('stores the message body on the conversation', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload({ text: 'Can you clean my windows?' })));
    const conv = inserted.find((i) => i.table === 'lead_conversations');
    expect(conv?.row.body).toBe('Can you clean my windows?');
  });

  it('enriches name via Graph API using the "name" field (not first_name/last_name)', async () => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = 'tok';
    mockGraphProfile({ name: 'Sofia Reyes' });
    await route.POST(makeWebhookRequest(instagramPayload({ igsid: 'IGSID_sofia' })));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.customer_name).toBe('Sofia Reyes');
    // Verify the Graph API was called with the Instagram-appropriate fields
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('fields=name'),
      expect.anything(),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('first_name'),
      expect.anything(),
    );
  });

  it('falls back to null name when Graph API returns no profile', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload()));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.customer_name).toBeNull();
  });

  it('is idempotent — appends conversation but does not create a second lead', async () => {
    existingLeadId = 'ig_lead_existing';
    existingLeadSource = 'instagram';
    noGraphProfile();
    const res = await route.POST(makeWebhookRequest(instagramPayload({ mid: 'ig_dup' })));
    expect(res.status).toBe(200);
    expect(inserted.filter((i) => i.table === 'leads')).toHaveLength(0);
    expect(inserted.filter((i) => i.table === 'lead_conversations')).toHaveLength(1);
    const conv = inserted.find((i) => i.table === 'lead_conversations');
    expect(conv?.row.lead_id).toBe('ig_lead_existing');
  });

  it('skips messaging events with no text (image, sticker, etc.)', async () => {
    const payload = {
      object: 'instagram',
      entry: [{
        id: 'IG_PAGE',
        messaging: [{
          sender: { id: 'IGSID_2' },
          message: { mid: 'ig_img', attachments: [{ type: 'image' }] },
          timestamp: 1_700_000_002,
        }],
      }],
    };
    const res = await route.POST(makeWebhookRequest(payload));
    expect(res.status).toBe(200);
    expect(inserted).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sets response_status=awaiting_response on new Instagram leads', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload()));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.response_status).toBe('awaiting_response');
  });

  it('sets reply_channel=instagram on the lead', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload()));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.reply_channel).toBe('instagram');
  });

  it('sets instagram_user_id from the IGSID', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload({ igsid: 'IGSID_uid_test' })));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.instagram_user_id).toBe('IGSID_uid_test');
    expect(lead?.row.messenger_psid).toBeUndefined();
  });

  it('sets external_sender_id on the conversation', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload({ igsid: 'IGSID_ext' })));
    const conv = inserted.find((i) => i.table === 'lead_conversations');
    expect(conv?.row.external_sender_id).toBe('IGSID_ext');
  });

  it('preserves sender_psid in metadata alongside external_sender_id', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(instagramPayload({ igsid: 'IGSID_both' })));
    const conv = inserted.find((i) => i.table === 'lead_conversations');
    expect((conv?.row.metadata as Record<string, unknown>)?.sender_psid).toBe('IGSID_both');
    expect(conv?.row.external_sender_id).toBe('IGSID_both');
  });
});

// =============================================================================

describe('Messenger webhook — existing behaviour preserved', () => {
  it('still processes object=page events', async () => {
    noGraphProfile();
    const res = await route.POST(makeWebhookRequest(messengerPayload()));
    expect(res.status).toBe(200);
    expect(inserted.some((i) => i.table === 'leads')).toBe(true);
  });

  it('still writes source=messenger', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(messengerPayload()));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.source).toBe('messenger');
  });

  it('still uses first_name+last_name for Graph API enrichment', async () => {
    process.env.MESSENGER_PAGE_ACCESS_TOKEN = 'tok';
    mockGraphProfile({ first_name: 'John', last_name: 'Smith' });
    await route.POST(makeWebhookRequest(messengerPayload({ psid: 'PSID_john' })));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.customer_name).toBe('John Smith');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('first_name,last_name'),
      expect.anything(),
    );
  });

  it('still sets channel=messenger on the conversation', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(messengerPayload()));
    const conv = inserted.find((i) => i.table === 'lead_conversations');
    expect(conv?.row.channel).toBe('messenger');
  });

  it('sets reply_channel=messenger on the lead', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(messengerPayload({ psid: 'PSID_rc_m' })));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.reply_channel).toBe('messenger');
  });

  it('sets messenger_psid on the lead', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(messengerPayload({ psid: 'PSID_m_stored' })));
    const lead = inserted.find((i) => i.table === 'leads');
    expect(lead?.row.messenger_psid).toBe('PSID_m_stored');
    expect(lead?.row.instagram_user_id).toBeUndefined();
  });

  it('sets external_sender_id on the Messenger conversation', async () => {
    noGraphProfile();
    await route.POST(makeWebhookRequest(messengerPayload({ psid: 'PSID_m_ext' })));
    const conv = inserted.find((i) => i.table === 'lead_conversations');
    expect(conv?.row.external_sender_id).toBe('PSID_m_ext');
  });
});

// =============================================================================

describe('Webhook object filter', () => {
  it('skips unknown object types', async () => {
    const res = await route.POST(makeWebhookRequest({ object: 'whatsapp', entry: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, skipped: true });
    expect(inserted).toHaveLength(0);
  });

  it('skips missing object field', async () => {
    const res = await route.POST(makeWebhookRequest({ entry: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });

  it('rejects bad HMAC in production', async () => {
    process.env.MESSENGER_APP_SECRET = 'prod_secret';
    const res = await route.POST(makeWebhookRequest({ object: 'instagram', entry: [] }));
    expect(res.status).toBe(401);
  });
});
