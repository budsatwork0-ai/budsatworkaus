import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { createCustomerRepository } from '@/lib/customers/repository';
import { resolveCustomerWorkspace } from '@/lib/customers/workspace';
import { withWorkspaceContext } from '@/lib/workspace/server';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const workspace = resolveCustomerWorkspace(searchParams, authUser.role);

  return withWorkspaceContext(workspace, async () => {
    const repository = createCustomerRepository({ client });
    const { data, error } = await repository.getStats();
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json(data);
  });
}
