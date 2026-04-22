import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

const ACCOUNT_PREFERENCES_PREFIX = 'account_preferences_';

type AccountNotifications = {
  jobUpdates: boolean;
  newBookings: boolean;
  payments: boolean;
  reminders: boolean;
  browserNotifications: boolean;
  smsNotifications: boolean;
};

const DEFAULT_NOTIFICATIONS: AccountNotifications = {
  jobUpdates: true,
  newBookings: true,
  payments: true,
  reminders: true,
  browserNotifications: true,
  smsNotifications: false,
};

function normalizeNotifications(value: unknown): AccountNotifications {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_NOTIFICATIONS;
  }

  const record = value as Record<string, unknown>;
  return {
    jobUpdates: Boolean(record.jobUpdates ?? DEFAULT_NOTIFICATIONS.jobUpdates),
    newBookings: Boolean(record.newBookings ?? DEFAULT_NOTIFICATIONS.newBookings),
    payments: Boolean(record.payments ?? DEFAULT_NOTIFICATIONS.payments),
    reminders: Boolean(record.reminders ?? DEFAULT_NOTIFICATIONS.reminders),
    browserNotifications: Boolean(record.browserNotifications ?? DEFAULT_NOTIFICATIONS.browserNotifications),
    smsNotifications: Boolean(record.smsNotifications ?? DEFAULT_NOTIFICATIONS.smsNotifications),
  };
}

async function readAccountSettings(userId: string) {
  const client = createServiceClientSafe();
  if (!client) {
    return { error: NextResponse.json({ error: 'Database unavailable' }, { status: 503 }) };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profileRes, employeeRes, customerRes, preferenceRes] = await Promise.all([
    (client as any)
      .from('profiles')
      .select('full_name, email, role, avatar_url')
      .eq('id', userId)
      .maybeSingle(),
    (client as any)
      .from('employees')
      .select('full_name, email, phone, photo_url, bio')
      .eq('user_id', userId)
      .maybeSingle(),
    (client as any)
      .from('customers')
      .select('full_name, email, phone')
      .eq('user_id', userId)
      .maybeSingle(),
    (client as any)
      .from('site_settings')
      .select('value')
      .eq('key', `${ACCOUNT_PREFERENCES_PREFIX}${userId}`)
      .maybeSingle(),
  ]);

  if (profileRes.error) {
    return { error: NextResponse.json({ error: profileRes.error.message }, { status: 500 }) };
  }
  if (employeeRes.error) {
    return { error: NextResponse.json({ error: employeeRes.error.message }, { status: 500 }) };
  }
  if (customerRes.error) {
    return { error: NextResponse.json({ error: customerRes.error.message }, { status: 500 }) };
  }
  if (preferenceRes.error) {
    return { error: NextResponse.json({ error: preferenceRes.error.message }, { status: 500 }) };
  }

  const profile = profileRes.data;
  const employee = employeeRes.data;
  const customer = customerRes.data;

  return {
    account: {
      fullName: employee?.full_name ?? customer?.full_name ?? profile?.full_name ?? '',
      phone: employee?.phone ?? customer?.phone ?? '',
      bio: employee?.bio ?? '',
      avatarUrl: employee?.photo_url ?? profile?.avatar_url ?? '',
      role: profile?.role ?? 'customer',
      email: profile?.email ?? employee?.email ?? customer?.email ?? '',
      notifications: normalizeNotifications(preferenceRes.data?.value),
    },
  };
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await readAccountSettings(authUser.id);
  if ('error' in result) {
    return result.error;
  }

  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const profileInput =
    body.profile && typeof body.profile === 'object' && !Array.isArray(body.profile)
      ? (body.profile as Record<string, unknown>)
      : null;

  const notificationsInput = normalizeNotifications(body.notifications);

  if (!profileInput && !body.notifications) {
    return NextResponse.json({ error: 'No valid account settings payload provided' }, { status: 400 });
  }

  if (profileInput) {
    const fullName = typeof profileInput.fullName === 'string' ? profileInput.fullName.trim() : '';
    const phone = typeof profileInput.phone === 'string' ? profileInput.phone.trim() : '';
    const bio = typeof profileInput.bio === 'string' ? profileInput.bio.trim() : '';
    const avatarUrl = typeof profileInput.avatarUrl === 'string' ? profileInput.avatarUrl.trim() : '';
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (client as any)
      .from('profiles')
      .update({
        ...(fullName ? { full_name: fullName } : {}),
        avatar_url: avatarUrl || null,
        updated_at: now,
      })
      .eq('id', authUser.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (authUser.role === 'admin' || authUser.role === 'employee') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: employeeError } = await (client as any)
        .from('employees')
        .update({
          ...(fullName ? { full_name: fullName } : {}),
          phone: phone || null,
          photo_url: avatarUrl || null,
          bio: bio || null,
          updated_at: now,
        })
        .eq('user_id', authUser.id);

      if (employeeError) {
        return NextResponse.json({ error: employeeError.message }, { status: 500 });
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: customerError } = await (client as any)
        .from('customers')
        .update({
          ...(fullName ? { full_name: fullName } : {}),
          phone: phone || null,
          updated_at: now,
        })
        .eq('user_id', authUser.id);

      if (customerError) {
        return NextResponse.json({ error: customerError.message }, { status: 500 });
      }
    }
  }

  if (body.notifications) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: preferenceError } = await (client as any)
      .from('site_settings')
      .upsert({
        key: `${ACCOUNT_PREFERENCES_PREFIX}${authUser.id}`,
        value: notificationsInput,
        updated_at: new Date().toISOString(),
        updated_by: authUser.email || authUser.id,
      }, { onConflict: 'key' });

    if (preferenceError) {
      return NextResponse.json({ error: preferenceError.message }, { status: 500 });
    }
  }

  const result = await readAccountSettings(authUser.id);
  if ('error' in result) {
    return result.error;
  }

  return NextResponse.json(result);
}
