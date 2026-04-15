const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f8faf8;
  margin: 0;
  padding: 0;
`;

const CARD_STYLE = `
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  max-width: 520px;
  margin: 32px auto;
  border: 1px solid #e5e7eb;
`;

const PRIMARY = '#0f3d2e';
const MUTED = '#6b7280';

function layout(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="${BASE_STYLE}">
        <div style="${CARD_STYLE}">
          <div style="margin-bottom:24px;">
            <span style="font-size:18px;font-weight:700;color:${PRIMARY};">Buds At Work</span>
          </div>
          ${content}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="font-size:12px;color:${MUTED};margin:0;">
            Buds At Work · Logan & South Brisbane ·
            <a href="https://budsatwork.com" style="color:${PRIMARY};">budsatwork.com</a>
          </p>
        </div>
      </body>
    </html>
  `;
}

export type QuoteReceivedParams = {
  customerName: string;
  serviceLabel: string;
  total: number;
  quoteId: string;
};

export function quoteReceivedEmail({ customerName, serviceLabel, total, quoteId }: QuoteReceivedParams): { subject: string; html: string } {
  return {
    subject: `Got your quote — we'll be in touch soon`,
    html: layout(`
      <h1 style="font-size:22px;font-weight:700;color:${PRIMARY};margin:0 0 8px;">Hey ${customerName} 👋</h1>
      <p style="color:${MUTED};margin:0 0 8px;">Your quote came through — nice one for reaching out.</p>
      <p style="color:${MUTED};margin:0 0 20px;">We're looking it over and will send you a payment link within 2–4 business hours on weekdays once everything is confirmed.</p>
      <div style="background:#f0faf5;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;color:${MUTED};margin-bottom:4px;">Service</div>
        <div style="font-size:16px;font-weight:600;color:${PRIMARY};">${serviceLabel}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:8px;margin-bottom:4px;">Estimated total</div>
        <div style="font-size:20px;font-weight:700;color:${PRIMARY};">$${total.toFixed(2)}</div>
        <div style="font-size:11px;color:${MUTED};margin-top:4px;">Quote #${quoteId.slice(0, 8).toUpperCase()}</div>
      </div>
      <p style="color:${MUTED};font-size:13px;margin:0 0 12px;">Keep an eye on your inbox — your payment link will arrive once we've confirmed everything.</p>
      <p style="color:${MUTED};font-size:14px;margin:0 0 8px;">Got something to add or a question? Just reply to this email — we're real people and we read every one.</p>
      <p style="color:${MUTED};font-size:14px;margin:0 0 20px;">Talk soon.</p>
      <p style="color:${PRIMARY};font-weight:600;margin:0;">– The Buds At Work team</p>
    `),
  };
}

export type QuoteFinalizedParams = {
  customerName: string;
  serviceLabel: string;
  total: number;
  quoteId: string;
  paymentUrl: string;
};

export function quoteFinalizedEmail({ customerName, serviceLabel, total, quoteId, paymentUrl }: QuoteFinalizedParams): { subject: string; html: string } {
  return {
    subject: `Your quote is ready — pay now to confirm your booking`,
    html: layout(`
      <h1 style="font-size:22px;font-weight:700;color:${PRIMARY};margin:0 0 8px;">Your quote is ready, ${customerName}!</h1>
      <p style="color:${MUTED};margin:0 0 20px;">We've reviewed your quote. Pay now to lock in your booking.</p>
      <div style="background:#f0faf5;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;color:${MUTED};margin-bottom:4px;">Service</div>
        <div style="font-size:16px;font-weight:600;color:${PRIMARY};">${serviceLabel}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:8px;margin-bottom:4px;">Total due</div>
        <div style="font-size:20px;font-weight:700;color:${PRIMARY};">$${total.toFixed(2)}</div>
        <div style="font-size:11px;color:${MUTED};margin-top:4px;">Quote #${quoteId.slice(0, 8).toUpperCase()}</div>
      </div>
      <a href="${paymentUrl}" style="display:inline-block;background:${PRIMARY};color:#fff;text-decoration:none;border-radius:10px;padding:12px 24px;font-weight:600;font-size:15px;margin-bottom:12px;">Pay Now</a>
      <p style="color:${MUTED};font-size:12px;margin:0 0 16px;">This link is valid for 48 hours. After that, you can re-request it from your <a href="https://budsatwork.com/portal/payments" style="color:${PRIMARY};">client portal</a>.</p>
      <p style="color:${MUTED};font-size:13px;margin:0;">We accept card, Apple Pay, Google Pay and more — checkout takes under 30 seconds.</p>
    `),
  };
}

export type ServiceScheduledParams = {
  customerName: string;
  serviceLabel: string;
  scheduledDate: string; // human-readable, e.g. "Monday 21 April 2026"
  scheduledTime: string; // e.g. "9:00 AM – 11:00 AM"
  crewFirstName: string;
  serviceAddress: string;
  orderId: string;
};

export function serviceScheduledEmail({
  customerName,
  serviceLabel,
  scheduledDate,
  scheduledTime,
  crewFirstName,
  serviceAddress,
  orderId,
}: ServiceScheduledParams): { subject: string; html: string } {
  return {
    subject: `Your booking is scheduled — ${scheduledDate}`,
    html: layout(`
      <h1 style="font-size:22px;font-weight:700;color:${PRIMARY};margin:0 0 8px;">You're locked in, ${customerName}!</h1>
      <p style="color:${MUTED};margin:0 0 20px;">Here are your confirmed service details.</p>
      <div style="background:#f0faf5;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;color:${MUTED};margin-bottom:4px;">Service</div>
        <div style="font-size:16px;font-weight:600;color:${PRIMARY};">${serviceLabel}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:12px;margin-bottom:4px;">Date & time</div>
        <div style="font-size:15px;font-weight:600;color:${PRIMARY};">${scheduledDate}</div>
        <div style="font-size:14px;color:${PRIMARY};margin-top:2px;">${scheduledTime}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:12px;margin-bottom:4px;">Address</div>
        <div style="font-size:14px;color:${PRIMARY};">${serviceAddress}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:12px;margin-bottom:4px;">Crew</div>
        <div style="font-size:14px;color:${PRIMARY};">Your team member is <strong>${crewFirstName}</strong></div>
        <div style="font-size:11px;color:${MUTED};margin-top:8px;">Order #${orderId.slice(0, 8).toUpperCase()}</div>
      </div>
      <div style="background:#f0faf5;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:${PRIMARY};margin-bottom:10px;">Before we arrive</div>
        <ul style="margin:0;padding-left:16px;color:${MUTED};font-size:13px;line-height:1.7;">
          <li>Ensure access to all areas to be serviced</li>
          <li>Secure pets in a separate room or yard</li>
          <li>Leave any key, gate code or parking notes handy — or reply to this email</li>
          <li>Clear driveway access if needed for larger jobs</li>
        </ul>
      </div>
      <p style="color:${MUTED};font-size:14px;margin:0 0 20px;">
        Need to reschedule or have a question? Log in to your
        <a href="https://budsatwork.com/portal" style="color:${PRIMARY};">client portal</a>
        or reply to this email.
      </p>
      <p style="color:${PRIMARY};font-weight:600;margin:0;">– The Buds At Work team</p>
    `),
  };
}

export type BookingConfirmedParams = {
  customerName: string;
  serviceLabel: string;
  total: number;
  orderId: string;
};

export function bookingConfirmedEmail({ customerName, serviceLabel, total, orderId }: BookingConfirmedParams): { subject: string; html: string } {
  return {
    subject: `Booking confirmed — see you soon!`,
    html: layout(`
      <h1 style="font-size:22px;font-weight:700;color:${PRIMARY};margin:0 0 8px;">You're all booked in, ${customerName}! 🎉</h1>
      <p style="color:${MUTED};margin:0 0 20px;">Payment received — your booking is confirmed. We'll be in touch with scheduling details shortly.</p>
      <div style="background:#f0faf5;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;color:${MUTED};margin-bottom:4px;">Service</div>
        <div style="font-size:16px;font-weight:600;color:${PRIMARY};">${serviceLabel}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:8px;margin-bottom:4px;">Amount paid</div>
        <div style="font-size:20px;font-weight:700;color:${PRIMARY};">$${total.toFixed(2)}</div>
        <div style="font-size:11px;color:${MUTED};margin-top:4px;">Order #${orderId.slice(0, 8).toUpperCase()}</div>
      </div>
      <p style="color:${MUTED};font-size:14px;margin:0 0 20px;">
        You can track your booking and view invoices anytime from your
        <a href="https://budsatwork.com/portal" style="color:${PRIMARY};">client portal</a>.
      </p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:20px;text-align:center;">
        <div style="font-size:14px;font-weight:600;color:#92400e;margin-bottom:4px;">Enjoying the experience so far?</div>
        <div style="font-size:13px;color:#78350f;margin-bottom:12px;">A quick Google review means the world to our small team — and helps other locals find us.</div>
        <a href="https://g.page/r/CYTORrk6H3xmEAI/review" style="display:inline-block;background:${PRIMARY};color:#fff;text-decoration:none;border-radius:8px;padding:10px 20px;font-weight:600;font-size:13px;">⭐ Leave a Google review</a>
      </div>
      <p style="color:${PRIMARY};font-weight:600;margin:0;">– The Buds At Work team</p>
    `),
  };
}

export type CheckoutExpiredParams = {
  customerName: string;
  serviceLabel: string;
  total: number;
  quoteId: string;
};

export function checkoutExpiredEmail({ customerName, serviceLabel, total, quoteId }: CheckoutExpiredParams): { subject: string; html: string } {
  return {
    subject: `Your payment link expired — here's how to get a new one`,
    html: layout(`
      <h1 style="font-size:22px;font-weight:700;color:${PRIMARY};margin:0 0 8px;">No worries, ${customerName} — happens to everyone.</h1>
      <p style="color:${MUTED};margin:0 0 20px;">Your payment link has expired (Stripe links are valid for 24 hours), but your quote is still saved and ready to go.</p>
      <div style="background:#f0faf5;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;color:${MUTED};margin-bottom:4px;">Service</div>
        <div style="font-size:16px;font-weight:600;color:${PRIMARY};">${serviceLabel}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:8px;margin-bottom:4px;">Quote total</div>
        <div style="font-size:20px;font-weight:700;color:${PRIMARY};">$${total.toFixed(2)}</div>
        <div style="font-size:11px;color:${MUTED};margin-top:4px;">Quote #${quoteId.slice(0, 8).toUpperCase()}</div>
      </div>
      <p style="color:${MUTED};font-size:14px;margin:0 0 16px;">To get a fresh payment link, log in to your client portal and re-request it — takes 10 seconds.</p>
      <a href="https://budsatwork.com/portal/payments" style="display:inline-block;background:${PRIMARY};color:#fff;text-decoration:none;border-radius:10px;padding:12px 24px;font-weight:600;font-size:15px;margin-bottom:20px;">Re-request payment link</a>
      <p style="color:${MUTED};font-size:13px;margin:0 0 20px;">Or just reply to this email and we'll sort it out for you.</p>
      <p style="color:${PRIMARY};font-weight:600;margin:0;">– The Buds At Work team</p>
    `),
  };
}

// ─── 6. 24-hour unpaid quote nudge ──────────────────────────────────────────
// Fires when a quote has been finalized but the customer hasn't paid within ~24h.
// The admin triggers this manually from the dashboard OR an automated cron calls
// POST /api/quotes/[id]/remind  (see that route for schedule details).

export type QuoteReminderParams = {
  customerName: string;
  serviceLabel: string;
  total: number;
  quoteId: string;
  paymentUrl: string;
};

export function quoteReminderEmail({
  customerName,
  serviceLabel,
  total,
  quoteId,
  paymentUrl,
}: QuoteReminderParams): { subject: string; html: string } {
  return {
    subject: `Still thinking? Your quote is ready to go`,
    html: layout(`
      <h1 style="font-size:22px;font-weight:700;color:${PRIMARY};margin:0 0 8px;">Hey ${customerName},</h1>
      <p style="color:${MUTED};margin:0 0 20px;">
        Just a quick heads-up — your payment link for <strong>${serviceLabel}</strong>
        is still active and ready whenever you are.
      </p>
      <div style="background:#f0faf5;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;color:${MUTED};margin-bottom:4px;">Service</div>
        <div style="font-size:16px;font-weight:600;color:${PRIMARY};">${serviceLabel}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:8px;margin-bottom:4px;">Total due</div>
        <div style="font-size:20px;font-weight:700;color:${PRIMARY};">$${total.toFixed(2)}</div>
        <div style="font-size:11px;color:${MUTED};margin-top:4px;">Quote #${quoteId.slice(0, 8).toUpperCase()}</div>
      </div>
      <a href="${paymentUrl}" style="display:inline-block;background:${PRIMARY};color:#fff;text-decoration:none;border-radius:10px;padding:12px 24px;font-weight:600;font-size:15px;margin-bottom:16px;">
        Pay &amp; confirm my booking
      </a>
      <p style="color:${MUTED};font-size:13px;margin:0 0 12px;">
        Checkout takes under 30 seconds — we accept card, Apple Pay, and Google Pay.
        The link expires in 24 hours.
      </p>
      <p style="color:${MUTED};font-size:13px;margin:0 0 20px;">
        Got a question first? Just reply to this email — we&apos;re happy to help.
      </p>
      <p style="color:${PRIMARY};font-weight:600;margin:0;">– The Buds At Work team</p>
    `),
  };
}

// ─── 7. Day-before service reminder ─────────────────────────────────────────
// Fires the evening before a confirmed booking so the customer is ready.
// Triggered by: POST /api/orders/[id]/remind-day-before  (see that route).

export type DayBeforeReminderParams = {
  customerName: string;
  serviceLabel: string;
  scheduledDate: string;   // e.g. "Tuesday 22 April 2026"
  scheduledTime: string;   // e.g. "9:00 AM – 11:00 AM"
  crewFirstName: string;
  serviceAddress: string;
  orderId: string;
  portalUrl?: string;
};

export function dayBeforeReminderEmail({
  customerName,
  serviceLabel,
  scheduledDate,
  scheduledTime,
  crewFirstName,
  serviceAddress,
  orderId,
  portalUrl = 'https://budsatwork.com/portal',
}: DayBeforeReminderParams): { subject: string; html: string } {
  return {
    subject: `Reminder: we're coming tomorrow — ${scheduledDate}`,
    html: layout(`
      <h1 style="font-size:22px;font-weight:700;color:${PRIMARY};margin:0 0 8px;">See you tomorrow, ${customerName}! 👋</h1>
      <p style="color:${MUTED};margin:0 0 20px;">
        Just a friendly heads-up — your <strong>${serviceLabel}</strong> is scheduled for
        <strong>${scheduledDate}</strong>. Here&apos;s everything you need.
      </p>
      <div style="background:#f0faf5;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;color:${MUTED};margin-bottom:4px;">Service</div>
        <div style="font-size:16px;font-weight:600;color:${PRIMARY};">${serviceLabel}</div>

        <div style="font-size:13px;color:${MUTED};margin-top:12px;margin-bottom:4px;">When</div>
        <div style="font-size:15px;font-weight:600;color:${PRIMARY};">${scheduledDate}</div>
        <div style="font-size:14px;color:${PRIMARY};margin-top:2px;">${scheduledTime}</div>

        <div style="font-size:13px;color:${MUTED};margin-top:12px;margin-bottom:4px;">Where</div>
        <div style="font-size:14px;color:${PRIMARY};">${serviceAddress}</div>

        <div style="font-size:13px;color:${MUTED};margin-top:12px;margin-bottom:4px;">Who to expect</div>
        <div style="font-size:14px;color:${PRIMARY};">
          <strong>${crewFirstName}</strong> from the Buds At Work team
        </div>

        <div style="font-size:11px;color:${MUTED};margin-top:8px;">Order #${orderId.slice(0, 8).toUpperCase()}</div>
      </div>

      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:#92400e;margin-bottom:8px;">Quick checklist for tomorrow ✓</div>
        <ul style="margin:0;padding-left:16px;color:#78350f;font-size:13px;line-height:1.8;">
          <li>Clear access to all areas we&apos;ll be working in</li>
          <li>Secure pets in a separate room or yard</li>
          <li>Leave any gate code, key info, or parking notes ready</li>
          <li>Clear driveway if we need access for larger jobs</li>
        </ul>
      </div>

      <p style="color:${MUTED};font-size:14px;margin:0 0 20px;">
        Need to change anything last minute? Log in to your
        <a href="${portalUrl}" style="color:${PRIMARY};">client portal</a>
        or just reply to this email — we&apos;ll get back to you quickly.
      </p>
      <p style="color:${PRIMARY};font-weight:600;margin:0;">– The Buds At Work team</p>
    `),
  };
}
