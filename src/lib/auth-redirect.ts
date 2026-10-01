/** Only route within this site after authentication. */
export function safeAuthRedirect(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return null;
  return value;
}

export function authCallbackUrl(origin: string, destination: string): string {
  const url = new URL('/auth/callback', origin);
  const redirect = safeAuthRedirect(destination);
  if (redirect) url.searchParams.set('redirect', redirect);
  return url.toString();
}
