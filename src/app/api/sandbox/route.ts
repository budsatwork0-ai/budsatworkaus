import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScenarioKind =
  | 'new_lead'
  | 'customer_journey'
  | 'job'
  | 'complaint'
  | 'review'
  | 'agent_initiative';

const SERVICES = [
  {
    service: 'lawn-mowing',
    label: 'Lawn mowing',
    scope: 'Front and back lawn, edging, green waste tidy',
    suburb: 'Underwood',
    address: '18 Bellbird St, Underwood QLD 4119',
    total: 135,
  },
  {
    service: 'windows',
    label: 'Window cleaning',
    scope: 'Two-storey home, interior and exterior glass',
    suburb: 'Sunnybank Hills',
    address: '42 Gowan Rd, Sunnybank Hills QLD 4109',
    total: 285,
  },
  {
    service: 'end-of-lease',
    label: 'End-of-lease cleaning',
    scope: 'Three-bedroom bond clean with oven and bathrooms',
    suburb: 'Loganlea',
    address: '7 Campus St, Loganlea QLD 4131',
    total: 480,
  },
  {
    service: 'property-maintenance',
    label: 'Property maintenance',
    scope: 'Small repairs, dump run, pressure wash entry path',
    suburb: 'Springwood',
    address: '25 Cinderella Dr, Springwood QLD 4127',
    total: 360,
  },
  {
    service: 'car-detailing',
    label: 'Car detailing',
    scope: 'Full interior and exterior detail for SUV',
    suburb: 'Eight Mile Plains',
    address: '11 Brandl St, Eight Mile Plains QLD 4113',
    total: 210,
  },
  {
    service: 'cleaning',
    label: 'NDIS support',
    scope: 'Weekly NDIS domestic assistance, laundry, kitchen and bathroom support',
    suburb: 'Waterford West',
    address: '63 Loganlea Rd, Waterford West QLD 4133',
    total: 205,
  },
  {
    service: 'commercial-cleaning',
    label: 'Commercial cleaning',
    scope: 'Small office, six desks, kitchen, two bathrooms, after hours',
    suburb: 'Meadowbrook',
    address: '3 University Dr, Meadowbrook QLD 4131',
    total: 350,
  },
];

const FIRST_NAMES = ['Ava', 'Noah', 'Mia', 'Jack', 'Sophie', 'Lucas', 'Grace', 'Ethan', 'Ruby', 'Liam'];
const LAST_NAMES = ['Harris', 'Cooper', 'Singh', 'Nguyen', 'Patel', 'Wilson', 'Anderson', 'Taylor', 'Davies', 'Martin'];
const ACTIONS = new Set<ScenarioKind | 'reset'>([
  'new_lead',
  'customer_journey',
  'job',
  'complaint',
  'review',
  'agent_initiative',
  'reset',
]);

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sandboxIdentity() {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const token = crypto.randomUUID().slice(0, 8);
  return {
    name: `${first} ${last}`,
    email: `${first}.${last}.${token}@sandbox.budsatwork.dev`.toLowerCase(),
    phone: `0499 ${String(Math.floor(Math.random() * 900) + 100)} ${String(Math.floor(Math.random() * 900) + 100)}`,
  };
}

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) return null;
  return user;
}

function sandboxFilter(tableHasIsTest = true) {
  return tableHasIsTest ? 'environment.eq.sandbox,is_test.eq.true' : 'environment.eq.sandbox';
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const [
      customers,
      leads,
      quotes,
      jobs,
      reviews,
      initiatives,
      agentActions,
      pendingAgentActions,
      pendingBudApprovals,
      completedJobs,
    ] = await Promise.all([
      countRows(supabase, 'customers'),
      countRows(supabase, 'leads'),
      countRows(supabase, 'quotes'),
      countRows(supabase, 'orders'),
      countRows(supabase, 'ratings'),
      countRows(supabase, 'bud_root_cause_initiatives', false),
      countRows(supabase, 'agent_actions', false),
      countRows(supabase, 'agent_actions', false, { status: 'pending' }),
      countRows(supabase, 'bud_approval_queue', false, { status: 'pending' }),
      countRows(supabase, 'orders', true, { status: 'completed' }),
    ]);

    return NextResponse.json({
      mode: 'sandbox',
      status: {
        activeCustomers: customers,
        activeLeads: leads,
        activeJobs: jobs,
        activeInitiatives: initiatives,
        activeApprovals: pendingAgentActions + pendingBudApprovals,
      },
      metrics: {
        leadsGenerated: leads,
        quotesGenerated: quotes,
        jobsCompleted: completedJobs,
        reviewsGenerated: reviews,
        initiativesCreated: initiatives,
        agentActionsCreated: agentActions,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load sandbox status' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { action?: ScenarioKind | 'reset' };
  const action = body.action || 'customer_journey';
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ error: 'invalid sandbox action' }, { status: 400 });
  }

  try {
    if (action === 'reset') {
      await resetSandbox(supabase);
      await generateScenario(supabase, 'customer_journey', user.id);
      await generateScenario(supabase, 'complaint', user.id);
      await generateScenario(supabase, 'agent_initiative', user.id);
      return NextResponse.json({ ok: true, action, message: 'Sandbox reset and baseline scenarios recreated.' });
    }

    const result = await generateScenario(supabase, action, user.id);
    return NextResponse.json({ ok: true, action, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sandbox action failed' },
      { status: 500 },
    );
  }
}

async function countRows(
  supabase: ReturnType<typeof createServiceClientSafe>,
  table: string,
  tableHasIsTest = true,
  equals: Record<string, string> = {},
) {
  if (!supabase) return 0;
  let query = (supabase as any)
    .from(table)
    .select('id', { count: 'exact', head: true })
    .or(sandboxFilter(tableHasIsTest));

  for (const [column, value] of Object.entries(equals)) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function resetSandbox(supabase: NonNullable<ReturnType<typeof createServiceClientSafe>>) {
  const deleteSpecs: Array<[string, boolean]> = [
    ['messages', true],
    ['conversations', true],
    ['lead_conversations', true],
    ['ratings', true],
    ['agent_actions', false],
    ['agent_runs', false],
    ['bud_approval_queue', false],
    ['bud_improvement_signals', false],
    ['bud_root_cause_initiatives', false],
    ['visitor_events', false],
    ['orders', true],
    ['quotes', true],
    ['leads', true],
    ['customers', true],
  ];

  for (const [table, hasIsTest] of deleteSpecs) {
    const { error } = await (supabase as any).from(table).delete().or(sandboxFilter(hasIsTest));
    if (error && !String(error.message || '').includes('does not exist')) throw error;
  }
}

async function generateScenario(
  supabase: NonNullable<ReturnType<typeof createServiceClientSafe>>,
  kind: ScenarioKind,
  userId: string,
) {
  if (kind === 'agent_initiative') return createAgentInitiative(supabase, userId);

  const identity = sandboxIdentity();
  const service = pick(SERVICES);
  const now = new Date().toISOString();
  const customerId = crypto.randomUUID();
  const leadId = crypto.randomUUID();
  const quoteId = crypto.randomUUID();
  const orderId = crypto.randomUUID();

  await (supabase as any).from('customers').insert({
    id: customerId,
    full_name: identity.name,
    email: identity.email,
    phone: identity.phone,
    region: 'South Brisbane / Logan',
    default_address: service.address,
    is_test: true,
    environment: 'sandbox',
    created_at: now,
  });

  const leadStatus =
    kind === 'new_lead' ? 'awaiting_response'
    : kind === 'complaint' ? 'completed'
    : kind === 'review' ? 'completed'
    : kind === 'customer_journey' ? 'completed'
    : kind === 'job' ? 'booked'
    : 'quoted';

  await (supabase as any).from('leads').insert({
    id: leadId,
    customer_name: identity.name,
    customer_email: identity.email,
    customer_phone: identity.phone,
    service_type: service.service,
    suburb: service.suburb,
    service_address: service.address,
    source: pick(['website', 'messenger', 'instagram']),
    response_status: leadStatus,
    temperature: kind === 'new_lead' ? 'WARM' : 'HOT',
    quote_id: kind === 'new_lead' ? null : quoteId,
    first_response_at: kind === 'new_lead' ? null : now,
    booked_at: ['job', 'review', 'complaint', 'customer_journey'].includes(kind) ? now : null,
    completed_at: ['review', 'complaint', 'customer_journey'].includes(kind) ? now : null,
    is_test: true,
    environment: 'sandbox',
    created_at: now,
    updated_at: now,
  });

  await (supabase as any).from('lead_conversations').insert([
    {
      id: crypto.randomUUID(),
      lead_id: leadId,
      direction: 'inbound',
      channel: 'website',
      body: `Hi, can I get help with ${service.label.toLowerCase()} in ${service.suburb}? ${service.scope}.`,
      author_label: identity.name,
      is_test: true,
      environment: 'sandbox',
      created_at: now,
    },
    {
      id: crypto.randomUUID(),
      lead_id: leadId,
      direction: 'outbound',
      channel: 'email',
      body: `Thanks ${identity.name.split(' ')[0]}, we can help. Sandbox quote prepared for $${service.total}.`,
      author_label: 'Sandbox Agent',
      is_test: true,
      environment: 'sandbox',
      created_at: now,
    },
  ]);

  if (kind === 'new_lead') {
    await createSandboxAgentAction(supabase, userId, leadId, 'lead_follow_up', `Follow up sandbox lead for ${identity.name}`);
    return { customerId, leadId };
  }

  await (supabase as any).from('quotes').insert({
    id: quoteId,
    customer_name: identity.name,
    customer_email: identity.email,
    customer_phone: identity.phone,
    service_type: service.service,
    context: service.service === 'commercial-cleaning' ? 'commercial' : 'home',
    frequency: service.service === 'commercial-cleaning' ? 'weekly' : 'none',
    scope: service.scope,
    total: service.total,
    submitted_total: service.total,
    reviewed_total: ['customer_journey', 'job', 'review', 'complaint'].includes(kind) ? service.total : null,
    status: kind === 'customer_journey' ? 'finalized' : 'submitted',
    payment_status: ['review', 'complaint'].includes(kind) ? 'paid' : 'not_requested',
    service_address: service.address,
    is_test: true,
    environment: 'sandbox',
    created_at: now,
    finalized_at: kind === 'customer_journey' ? now : null,
  });

  if (['job', 'review', 'complaint', 'customer_journey'].includes(kind)) {
    await (supabase as any).from('orders').insert({
      id: orderId,
      quote_id: quoteId,
      customer_id: customerId,
      customer_name: identity.name,
      customer_email: identity.email,
      customer_phone: identity.phone,
      service_type: service.service,
      context: service.service === 'commercial-cleaning' ? 'commercial' : 'home',
      segment: service.service === 'commercial-cleaning' ? 'commercial' : 'home',
      scope: service.scope,
      frequency: service.service === 'commercial-cleaning' ? 'weekly' : 'none',
      base_price: service.total,
      final_price: service.total,
      scheduled_date: kind === 'job' ? daysFromNow(2) : daysFromNow(-1),
      scheduled_time: '9:00 AM',
      status: ['review', 'complaint', 'customer_journey'].includes(kind) ? 'completed' : 'scheduled',
      completed_at: ['review', 'complaint', 'customer_journey'].includes(kind) ? now : null,
      is_test: true,
      environment: 'sandbox',
      created_at: now,
    });

    await (supabase as any).from('quotes').update({ converted_order_id: orderId }).eq('id', quoteId);
  }

  if (kind === 'review') {
    await (supabase as any).from('ratings').insert({
      id: crypto.randomUUID(),
      order_id: orderId,
      customer_id: customerId,
      rating: 5,
      comment: `Sandbox review: ${service.label} was completed on time and the crew communicated clearly.`,
      is_test: true,
      environment: 'sandbox',
      created_at: now,
    });
  }

  if (kind === 'complaint') {
    const conversationId = crypto.randomUUID();
    await (supabase as any).from('conversations').insert({
      id: conversationId,
      entity_type: 'customer',
      entity_id: customerId,
      subject: `SANDBOX complaint - ${service.label}`,
      status: 'open',
      is_test: true,
      environment: 'sandbox',
      created_at: now,
    });
    await (supabase as any).from('messages').insert([
      {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        sender_type: 'entity',
        body: 'Sandbox complaint: the crew arrived late and the final price was higher than expected.',
        channel: 'email',
        delivery_status: 'sent',
        is_test: true,
        environment: 'sandbox',
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        sender_type: 'admin',
        body: 'Sandbox draft: acknowledge delay, review price difference, offer a make-good.',
        channel: 'email',
        delivery_status: 'draft',
        is_test: true,
        environment: 'sandbox',
        created_at: now,
      },
    ]);
    await createSandboxSignal(supabase, `Complaint handling improvement for ${service.label}`, 'support', userId);
  }

  await createSandboxAgentAction(supabase, userId, quoteId, 'sandbox_workflow_review', `Review sandbox ${service.label} workflow for ${identity.name}`);

  return { customerId, leadId, quoteId, orderId: ['job', 'review', 'complaint', 'customer_journey'].includes(kind) ? orderId : null };
}

async function createAgentInitiative(
  supabase: NonNullable<ReturnType<typeof createServiceClientSafe>>,
  userId: string,
) {
  const rootCauseKey = `sandbox:${crypto.randomUUID()}`;
  const title = pick([
    'Reduce quote follow-up delay in sandbox',
    'Improve complaint triage in sandbox',
    'Compress approval queue noise in sandbox',
    'Test late-job recovery workflow in sandbox',
  ]);
  const { data: initiative, error } = await (supabase as any)
    .from('bud_root_cause_initiatives')
    .insert({
      root_cause_id: crypto.randomUUID(),
      root_cause_key: rootCauseKey,
      title: `SANDBOX: ${title}`,
      status: 'open',
      signal_count: 1,
      approval_count: 1,
      metadata: { sandbox: true, environment: 'sandbox', requested_by: userId },
      environment: 'sandbox',
    })
    .select('id')
    .single();

  if (error) throw error;
  await createSandboxSignal(supabase, title, 'ops', userId, initiative?.id, rootCauseKey);
  return { initiativeId: initiative?.id };
}

async function createSandboxSignal(
  supabase: NonNullable<ReturnType<typeof createServiceClientSafe>>,
  title: string,
  area: string,
  userId: string,
  initiativeId?: string,
  rootCauseKey?: string,
) {
  await (supabase as any).from('bud_improvement_signals').insert({
    source: 'sandbox',
    signal_type: 'opportunity',
    severity: 'medium',
    title: `SANDBOX: ${title}`,
    description: 'Sandbox-only training signal. Must not influence production prioritisation.',
    affected_area: area,
    proposed_approach: 'Run inside Sandbox, inspect approvals, and validate workflow behaviour before production rollout.',
    metadata: { sandbox: true, environment: 'sandbox', requested_by: userId },
    status: 'new',
    initiative_id: initiativeId || null,
    root_cause_key: rootCauseKey || null,
    environment: 'sandbox',
  });

  await (supabase as any).from('bud_approval_queue').insert({
    action_type: 'sandbox_improvement_review',
    payload: { title, sandbox: true, environment: 'sandbox' },
    status: 'pending',
    requested_by: 'sandbox-agent',
    notes: 'Sandbox-only approval generated for training.',
    initiative_id: initiativeId || null,
    root_cause_key: rootCauseKey || null,
    environment: 'sandbox',
  });
}

async function createSandboxAgentAction(
  supabase: NonNullable<ReturnType<typeof createServiceClientSafe>>,
  userId: string,
  targetId: string,
  actionType: string,
  preview: string,
) {
  const { data: run, error: runError } = await (supabase as any)
    .from('agent_runs')
    .insert({
      agent_id: 'quote-triage',
      trigger: 'manual',
      triggered_by: userId,
      status: 'needs_approval',
      input: { sandbox: true, targetId },
      output: { recommendation: preview },
      summary: `SANDBOX: ${preview}`,
      environment: 'sandbox',
      finished_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (runError) throw runError;

  await (supabase as any).from('agent_actions').insert({
    run_id: run.id,
    agent_id: 'quote-triage',
    action_type: actionType,
    target_table: 'sandbox',
    target_id: targetId,
    payload: { sandbox: true, environment: 'sandbox', risk_level: 'low' },
    preview: `SANDBOX: ${preview}`,
    requires_approval: true,
    status: 'pending',
    action_identity: `sandbox:${actionType}:${targetId}`,
    environment: 'sandbox',
  });
}
