import { Resend } from 'resend';

let _client: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(process.env.RESEND_API_KEY);
  return _client;
}

export const FROM_ADDRESS = 'Buds At Work <admin@budsatwork.com>';
