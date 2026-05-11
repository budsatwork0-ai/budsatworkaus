import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/variations/[id]/document
// Unauthenticated — DocuSign fetches this to render the variation order.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = createServiceClientSafe();
  if (!client) return new NextResponse('Database unavailable', { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: v, error } = await (client as any)
    .from('job_variations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !v) return new NextResponse('Variation not found', { status: 404 });

  const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

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
  .box { border: 1px solid #ccc; border-radius: 6px; padding: 12px 16px; margin: 12px 0; background: #fafafa; }
  .totals { border-top: 2px solid #333; margin-top: 12px; padding-top: 10px; }
  .sig-block { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-line { border-top: 1px solid #333; padding-top: 6px; margin-top: 60px; }
  .anchor { font-size: 6pt; color: white; }
  footer { margin-top: 48px; font-size: 9pt; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
</style>
</head>
<body>

<h1>Buds At Work</h1>
<div class="sub">Job Variation Order &mdash; ${today}</div>

<h2>1. Parties</h2>
<div class="row"><span class="label">Service Provider:</span><span>Buds At Work, Logan &amp; South Brisbane QLD</span></div>
<div class="row"><span class="label">Customer:</span><span>${v.customer_name}</span></div>
<div class="row"><span class="label">Customer Email:</span><span>${v.customer_email}</span></div>
<div class="row"><span class="label">Order Reference:</span><span>${v.order_id}</span></div>

<h2>2. Original Scope</h2>
<div class="row"><span class="label">Original Service:</span><span>${v.original_service}</span></div>
<div class="row"><span class="label">Original Price:</span><span>${fmt(v.original_price)}</span></div>

<h2>3. Requested Variation</h2>
<div class="box">
  <p style="margin:0;">${v.variation_description}</p>
</div>
${v.reason ? `<p style="font-size:10pt; color:#555;"><strong>Reason / context:</strong> ${v.reason}</p>` : ''}

<h2>4. Revised Pricing</h2>
<div class="row"><span class="label">Original price:</span><span>${fmt(v.original_price)}</span></div>
<div class="row"><span class="label">Additional cost for variation:</span><span>+ ${fmt(v.additional_cost)}</span></div>
<div class="totals">
  <div class="row"><span><strong>New total:</strong></span><span><strong>${fmt(v.new_total)}</strong></span></div>
</div>

<h2>5. Agreement</h2>
<p>By signing below, the customer confirms they have requested the variation described above and agree to pay the revised total of <strong>${fmt(v.new_total)}</strong> upon completion of the work. This variation forms part of the original service agreement with Buds At Work.</p>

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
      <div><strong>${v.customer_name}</strong> — Customer</div>
      <div>Date: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
    </div>
  </div>
</div>

<footer>Buds At Work &bull; admin@budsatwork.com &bull; Variation ID: ${id}</footer>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
