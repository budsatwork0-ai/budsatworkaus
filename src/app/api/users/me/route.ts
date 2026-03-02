import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// GET /api/users/me - Returns the current user's role from the profiles table (server-trusted).
// Safe to use as the authoritative role source on the client — never reads user_metadata.
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ id: authUser.id, role: authUser.role, email: authUser.email });
}
