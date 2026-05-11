import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home / Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Rubbish & Dump Run',
  auto: 'Car Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

const CONTEXT_LABELS: Record<string, string> = {
  home: 'Residential',
  commercial: 'Commercial',
  ndis: 'NDIS / Disability Support',
};

// GET /api/agreements/[id]/document
// Unauthenticated — DocuSign fetches this to render the service agreement.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = createServiceClientSafe();
  if (!client) return new NextResponse('Database unavailable', { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: a, error } = await (client as any)
    .from('client_agreements')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !a) return new NextResponse('Agreement not found', { status: 404 });

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const serviceLabel = SERVICE_LABELS[a.service_type] ?? a.service_type;
  const contextLabel = CONTEXT_LABELS[a.service_context] ?? a.service_context;
  const scheduledDate = a.scheduled_date
    ? new Date(a.scheduled_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'To be confirmed';
  const price = a.agreed_price != null ? `$${Number(a.agreed_price).toFixed(2)}` : 'As quoted';

  const ndisClause = a.is_ndis ? `
<h2>9. NDIS-Specific Consent</h2>
<p>This service is funded under the National Disability Insurance Scheme (NDIS). The participant or their authorised representative acknowledges that:</p>
<ul>
  <li>This service is delivered in accordance with the NDIS Practice Standards and Code of Conduct;</li>
  <li>The participant has the right to choose and control their supports and may end this arrangement at any time;</li>
  <li>Any filming during service delivery for quality/training purposes requires the participant's express consent, which is captured below. Footage involving NDIS participants will never be used for marketing or shared outside of Buds At Work's quality management processes without separate written authorisation;</li>
  <li>Participant information will be handled in accordance with the Privacy Act 1988 and NDIS privacy rules.</li>
</ul>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.75; color: #1a1a1a; max-width: 680px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 4px; }
  .sub { text-align: center; font-size: 10pt; color: #555; margin-bottom: 32px; }
  h2 { font-size: 11pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 28px; }
  .row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 10.5pt; }
  .label { color: #555; }
  ul { margin: 8px 0 8px 20px; }
  li { margin-bottom: 4px; }
  .consent-box { border: 1px solid #aaa; border-radius: 6px; padding: 12px 16px; margin: 10px 0; }
  .checked { font-weight: bold; }
  .sig-block { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-line { border-top: 1px solid #333; padding-top: 6px; margin-top: 60px; }
  .anchor { font-size: 6pt; color: white; }
  footer { margin-top: 48px; font-size: 9pt; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
</style>
</head>
<body>

<h1>Buds At Work</h1>
<div class="sub">Service Agreement &mdash; Executed ${today}</div>

<h2>1. Parties</h2>
<div class="row"><span class="label">Service Provider:</span><span>Buds At Work, Logan &amp; South Brisbane QLD</span></div>
<div class="row"><span class="label">Contact:</span><span>admin@budsatwork.com</span></div>
<div class="row"><span class="label">Customer:</span><span>${a.customer_name}</span></div>
${a.customer_email ? `<div class="row"><span class="label">Customer Email:</span><span>${a.customer_email}</span></div>` : ''}
${a.customer_phone ? `<div class="row"><span class="label">Customer Phone:</span><span>${a.customer_phone}</span></div>` : ''}

<h2>2. Service Details</h2>
<div class="row"><span class="label">Service:</span><span>${serviceLabel}</span></div>
<div class="row"><span class="label">Context:</span><span>${contextLabel}</span></div>
${a.service_address ? `<div class="row"><span class="label">Service Address:</span><span>${a.service_address}</span></div>` : ''}
<div class="row"><span class="label">Scheduled Date:</span><span>${scheduledDate}</span></div>
<div class="row"><span class="label">Agreed Price:</span><span>${price}</span></div>

<h2>3. Payment Terms</h2>
<ul>
  <li>Payment is due as quoted and confirmed via Buds At Work's online booking platform.</li>
  <li>Where payment has not been collected in advance, payment is due upon completion of the service.</li>
  <li>Invoices not paid within 7 days may attract a late payment fee of 5% per week.</li>
</ul>

<h2>4. Cancellation Policy</h2>
<ul>
  <li>Cancellations made more than 48 hours before the scheduled service: full refund.</li>
  <li>Cancellations made 24–48 hours before the scheduled service: 50% cancellation fee applies.</li>
  <li>Cancellations made within 24 hours of the scheduled service, or same-day no-shows: full service fee applies.</li>
  <li>Buds At Work reserves the right to reschedule due to unsafe conditions (severe weather, health and safety risks) with no penalty.</li>
</ul>

<h2>5. Scope of Service &amp; Variations</h2>
<ul>
  <li>The service will be performed as described in the booking confirmation. Any additional work requested on the day must be agreed in writing (a Variation Order) before it is carried out and will be billed in addition to the original quote.</li>
  <li>Buds At Work will exercise reasonable professional care. We are not responsible for pre-existing damage, structural defects, or items not disclosed at the time of booking.</li>
</ul>

<h2>6. Liability</h2>
<ul>
  <li>Buds At Work carries public liability insurance. Any claims must be reported within 24 hours of the service.</li>
  <li>Our liability is limited to the cost of the service provided. We are not liable for indirect, consequential, or economic losses.</li>
  <li>The customer is responsible for securing or removing fragile, irreplaceable, or valuable items prior to the service.</li>
</ul>

<h2>7. Privacy</h2>
<p>Personal information collected as part of this booking is handled in accordance with the Privacy Act 1988. We will not share your personal information with third parties except as required to deliver the service or comply with law.</p>

<h2>8. Filming &amp; Photography Consent</h2>
<p>Buds At Work crew members may film or photograph during service delivery. Please indicate your consent below:</p>

<div class="consent-box">
  <p class="checked">${a.filming_consent_ops ? '[✓]' : '[  ]'} &nbsp;<strong>Quality control &amp; training use:</strong> I consent to filming/photography of the work being performed, used internally by Buds At Work for quality assurance, staff training, and record-keeping. Footage will not be shared publicly.</p>
</div>
<div class="consent-box">
  <p class="checked">${a.filming_consent_marketing ? '[✓]' : '[  ]'} &nbsp;<strong>Marketing &amp; promotional use:</strong> I consent to before/after photos or video clips of the completed work (not identifying me personally) being used by Buds At Work on its website, social media, or marketing materials.</p>
</div>

${ndisClause}

<h2>10. Governing Law</h2>
<p>This agreement is governed by the laws of Queensland, Australia. Any disputes will be resolved in Queensland courts.</p>

<h2>11. Signatures</h2>
<p>By signing below, both parties confirm they have read, understood, and agreed to these terms.</p>

<div class="sig-block">
  <div>
    <div class="sig-line">
      <div><strong>Jackson Taylor</strong> — Buds At Work</div>
      <div>Date: ${today}</div>
    </div>
  </div>
  <div>
    <div class="sig-line">
      <span class="anchor">[[SIGN_HERE]]</span>
      <div><strong>${a.customer_name}</strong> — Customer</div>
      <div>Date: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
    </div>
  </div>
</div>

<footer>Buds At Work &bull; admin@budsatwork.com &bull; Agreement ID: ${id}</footer>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
