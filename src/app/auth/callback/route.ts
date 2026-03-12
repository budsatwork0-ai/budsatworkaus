import { createAuthServerClient } from '@/lib/supabase/server-client';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { homePathForRole, resolveUserRole, type UserRole } from '@/types/roles';

// OAuth / email confirmation callback handler.
// Exchanges the auth code for a session and redirects based on role.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const rawRedirect = searchParams.get('redirect');

  // Only allow same-origin relative paths to prevent open redirect attacks.
  const explicitRedirect = rawRedirect?.startsWith('/') ? rawRedirect : null;

  // Default to the customer sign-in page so unauthenticated users land somewhere sensible.
  let destination = explicitRedirect || '/account';

  if (code) {
    const supabase = await createAuthServerClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data?.session?.user) {
      const user = data.session.user;
      let role = resolveUserRole(user.app_metadata?.role);

      // New OAuth users (e.g. first-time Google sign-in) won't have app_metadata.role set.
      // We need to resolve their role from the DB or assign a default.
      if (!user.app_metadata?.role) {
        const serviceClient = createServiceClientSafe();
        if (serviceClient) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: profile } = await (serviceClient as any)
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.role) {
            // Existing user logging in via a new OAuth provider — honour their DB role.
            role = resolveUserRole(profile.role) as UserRole;
          } else {
            // Brand-new OAuth sign-up: default to customer and provision their profile.
            role = 'customer';
            const fullName =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              '';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (serviceClient as any).from('profiles').upsert({
              id: user.id,
              full_name: fullName,
              email: user.email,
              role: 'customer',
            });

            // Link any anonymous quotes submitted with this email to this new account.
            if (user.email) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: orphaned } = await (serviceClient as any)
                .from('quotes')
                .select('id')
                .ilike('customer_email', user.email)
                .is('customer_id', null);
              if (orphaned && orphaned.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (serviceClient as any)
                  .from('quotes')
                  .update({ customer_id: user.id, updated_at: new Date().toISOString() })
                  .in('id', orphaned.map((q: { id: string }) => q.id));
              }
            }
          }

          // Sync the resolved role into app_metadata so the JWT is correct on next sign-in.
          await serviceClient.auth.admin.updateUserById(user.id, {
            app_metadata: { role },
          });
        }
      }

      // Honour an explicit redirect (e.g. /account/update-password), otherwise
      // send the user to their role-based home.
      destination = explicitRedirect || homePathForRole(role);
    }
  }

  return NextResponse.redirect(new URL(destination, req.url));
}
