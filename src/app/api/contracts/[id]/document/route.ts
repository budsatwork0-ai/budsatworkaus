import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/contracts/[id]/document
// Returns an HTML employment contract document for DocuSign to fetch and render.
// This endpoint is unauthenticated so DocuSign can reach it.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const client = createServiceClientSafe();
  if (!client) {
    return new NextResponse('Database unavailable', { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const { data: contract, error } = await db
    .from('employment_contracts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !contract) {
    return new NextResponse('Contract not found', { status: 404 });
  }

  const effectiveDate = contract.effective_date
    ? new Date(contract.effective_date).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'As agreed';

  const today = new Date().toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const contractTitle: Record<string, string> = {
    pay_amendment: 'Pay Rate Amendment',
    employment_type_change: 'Change of Employment Type',
    role_change: 'Change of Role',
    general_amendment: 'Employment Amendment',
  };

  const title = contractTitle[contract.contract_type] ?? 'Employment Amendment';

  const changeLines: string[] = [];
  if (contract.contract_type === 'pay_amendment' && contract.new_rate) {
    changeLines.push(
      `<li>Hourly rate changes from <strong>$${contract.prev_rate ?? '—'}/hr</strong> to <strong>$${contract.new_rate}/hr</strong>.</li>`
    );
  }
  if (contract.contract_type === 'employment_type_change' && contract.new_employment_type) {
    const fmt = (v: string) =>
      v.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase());
    changeLines.push(
      `<li>Employment type changes from <strong>${fmt(contract.prev_employment_type ?? '—')}</strong> to <strong>${fmt(contract.new_employment_type)}</strong>.</li>`
    );
  }
  if (contract.contract_type === 'role_change' && contract.new_role) {
    changeLines.push(
      `<li>Role changes from <strong>${contract.prev_role ?? '—'}</strong> to <strong>${contract.new_role}</strong>.</li>`
    );
  }
  if (contract.notes) {
    changeLines.push(`<li>${contract.notes}</li>`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.7; color: #1a1a1a; max-width: 680px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 16pt; text-align: center; margin-bottom: 4px; }
  .sub { text-align: center; font-size: 10pt; color: #555; margin-bottom: 32px; }
  h2 { font-size: 11pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 28px; }
  .field { margin: 6px 0; }
  .label { font-weight: bold; }
  ul { margin: 8px 0 8px 20px; }
  .sig-block { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-line { border-top: 1px solid #333; padding-top: 6px; margin-top: 60px; }
  .anchor { font-size: 6pt; color: white; }
  footer { margin-top: 48px; font-size: 9pt; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
</style>
</head>
<body>

<h1>Buds At Work</h1>
<div class="sub">${title} &mdash; Executed ${today}</div>

<h2>1. Parties</h2>
<div class="field"><span class="label">Employer:</span> Buds At Work (ABN on file), Logan &amp; South Brisbane, QLD</div>
<div class="field"><span class="label">Worker:</span> ${contract.employee_name}</div>
<div class="field"><span class="label">Worker Email:</span> ${contract.employee_email}</div>

<h2>2. Amendment Details</h2>
<p>The following changes to the worker's terms of engagement take effect from <strong>${effectiveDate}</strong>:</p>
<ul>
  ${changeLines.length > 0 ? changeLines.join('\n  ') : '<li>See attached terms as discussed.</li>'}
</ul>
<p>All other terms and conditions of the existing engagement remain unchanged unless otherwise specified above.</p>

<h2>3. Acknowledgement</h2>
<p>Both parties agree to the above amendment. By signing below, each party confirms they have read, understood, and accepted these terms.</p>

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
      <div><strong>${contract.employee_name}</strong> — Worker</div>
      <div>Date: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
    </div>
  </div>
</div>

<footer>Buds At Work &bull; admin@budsatwork.com &bull; Document ID: ${id}</footer>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
