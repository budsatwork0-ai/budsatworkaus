import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type AdminCredentials = {
  email: string;
  password: string;
};

let envLoaded = false;

function isLocalSupabaseUrl(url: string) {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url);
}

function assertE2EAdminUserCreationAllowed(url: string) {
  const explicitE2E =
    process.env.E2E_ADMIN_AUTH === 'true' ||
    process.env.PLAYWRIGHT_TEST === 'true' ||
    process.env.TEST_WORKER_INDEX !== undefined ||
    process.env.NODE_ENV === 'test';
  const explicitRemote = process.env.E2E_ALLOW_REMOTE_SUPABASE_ADMIN === 'true';

  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to create an E2E admin user in a production runtime.');
  }

  if (!explicitE2E) {
    throw new Error('Refusing to create an E2E admin user unless E2E_ADMIN_AUTH=true or NODE_ENV=test.');
  }

  if (!isLocalSupabaseUrl(url) && !explicitRemote) {
    throw new Error('Refusing to use the service-role key against a remote Supabase project without E2E_ALLOW_REMOTE_SUPABASE_ADMIN=true.');
  }
}

function loadDotEnvLocal() {
  if (envLoaded) return;
  envLoaded = true;

  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;

  const contents = readFileSync(path, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function adminCredentials(): AdminCredentials {
  return {
    email: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@budsatwork.test',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin!2026-local-only',
  };
}

export async function ensureAdminUser(): Promise<AdminCredentials> {
  loadDotEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Authenticated visual QA requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  assertE2EAdminUserCreationAllowed(url);

  const credentials = adminCredentials();
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: credentials.email,
    password: credentials.password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { full_name: 'E2E Admin' },
  });

  let userId = created.user?.id ?? null;
  if (createError) {
    const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    userId = users.users.find((user) => user.email?.toLowerCase() === credentials.email.toLowerCase())?.id ?? null;
    if (!userId) throw createError;

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: credentials.password,
      email_confirm: true,
      app_metadata: { role: 'admin' },
      user_metadata: { full_name: 'E2E Admin' },
    });
    if (updateError) throw updateError;
  }

  if (!userId) throw new Error('Unable to resolve E2E admin user id.');

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: credentials.email,
      full_name: 'E2E Admin',
      role: 'admin',
    });
  if (profileError) throw profileError;

  return credentials;
}

export async function signInAsAdmin(page: Page, redirectPath = '/dashboard/sandbox') {
  const credentials = await ensureAdminUser();

  await page.goto(`/account?redirect=${encodeURIComponent(redirectPath)}`);
  await page.getByLabel(/email address/i).fill(credentials.email);
  await page.getByLabel(/^password$/i).fill(credentials.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => url.pathname === redirectPath, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: /^Agent Operations Centre$/ })).toBeVisible();
}
