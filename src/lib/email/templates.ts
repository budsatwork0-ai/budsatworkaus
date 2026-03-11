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
    subject: `We've got your quote — Buds At Work`,
    html: layout(`
      <h1 style="font-size:22px;font-weight:700;color:${PRIMARY};margin:0 0 8px;">Hey ${customerName} 👋</h1>
      <p style="color:${MUTED};margin:0 0 20px;">Thanks for getting in touch! We've received your quote request and will review it shortly.</p>
      <div style="background:#f0faf5;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="font-size:13px;color:${MUTED};margin-bottom:4px;">Service</div>
        <div style="font-size:16px;font-weight:600;color:${PRIMARY};">${serviceLabel}</div>
        <div style="font-size:13px;color:${MUTED};margin-top:8px;margin-bottom:4px;">Estimated total</div>
        <div style="font-size:20px;font-weight:700;color:${PRIMARY};">$${total.toFixed(2)}</div>
        <div style="font-size:11px;color:${MUTED};margin-top:4px;">Quote #${quoteId.slice(0, 8).toUpperCase()}</div>
      </div>
      <p style="color:${MUTED};font-size:14px;margin:0 0 20px;">We'll be in touch to confirm the details and lock in a time. In the meantime, if you have any questions just reply to this email.</p>
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
      <a href="${paymentUrl}" style="display:inline-block;background:${PRIMARY};color:#fff;text-decoration:none;border-radius:10px;padding:12px 24px;font-weight:600;font-size:15px;margin-bottom:20px;">Pay Now</a>
      <p style="color:${MUTED};font-size:13px;margin:0;">We accept card, Apple Pay, and Google Pay.</p>
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
      <h1 style="font-size:22px;font-weight:700;color:${PRIMARY};margin:0 0 8px;">You're all booked in! 🎉</h1>
      <p style="color:${MUTED};margin:0 0 20px;">Payment received — your booking is confirmed. We'll be in touch with scheduling details.</p>
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
      <p style="color:${PRIMARY};font-weight:600;margin:0;">– The Buds At Work team</p>
    `),
  };
}
