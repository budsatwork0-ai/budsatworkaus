import { createAuthServerClient } from '@/lib/supabase/server-client';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { homePathForRole, resolveUserRole, type UserRole } from '@/types/roles';
import { normalizeEmail } from '@/lib/auth/normalize-email';

/**
 * OAuth / email-confirmation callback handler.
 *
 * Hardened to prevent duplicate-account creation when a user signs up with
 * email/password first and later uses Google with the *same* (or aliased)
 * email — the most common way two rows for the same human end up in
 * auth.users.
 *
 * Flow per request:
 *   1. Exchange code → session.
 *   2. Look the OAuth user up by canonical email against `profiles`.
 *   3. If a different existing user already owns that canonical email AND
 *      has a verified email, sign the new session out and bounce them to
 *      the sign-in page with a clear "use your original method" hint. This
 *      avoids two auth.users rows for one inbox.
 *   4. Otherwise resolve their role (existing profile → keep it, new user →
 *      provision as customer) and sync app_metadata.role + normalized_email
 *      so subsequent JWTs and uniqueness checks stay consistent.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const rawRedirect = searchParams.get('redirect');
  const type = searchParams.get('type');

  // Only allow same-origin relative paths to prevent open redirect attacks.
  const explicitRedirect = rawRedirect?.startsWith('/') ? rawRedirect : null;

  // Default to the customer sign-in page so unauthenticated users land somewhere sensible.
  let destination = explicitRedirect || '/account';

  if (code) {
    const supabase = await createAuthServerClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data?.session?.user) {
      const user = data.session.user;
      const serviceClient = createServiceClientSafe();
      const { canonical: emailCanonical, display: emailDisplay } = normalizeEmail(user.email);

      // ── Duplicate-account guard ──────────────────────────────────────────
      // If a *different* user already owns this canonical email, this OAuth
      // sign-in just minted a duplicate. We sign it out, schedule deletion
      // of the dupe, and send the human back to sign-in with a hint.
      if (serviceClient && emailCanonical) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (serviceClient as any)
          .from('profiles')
          .select('id, role, normalized_email')
          .eq('normalized_email', emailCanonical)
          .neq('id', user.id)
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          // Tear down the duplicate auth.users row — never leave orphans.
          await supabase.auth.signOut();
          try {
            await serviceClient.auth.admin.deleteUser(user.id);
          } catch (err) {
            console.error('[auth.callback] Failed to delete duplicate user', user.id, err);
          }

          const params = new URLSearchParams({
            email: emailDisplay,
            reason: 'existing_account',
          });
          return NextResponse.redirect(new URL(`/account?${params.toString()}`, req.url));
        }
      }

      let role = resolveUserRole(user.app_metadata?.role);

      // New OAuth users (e.g. first-time Google sign-in) won't have app_metadata.role set.
      // We need to resolve their role from the DB or assign a default.
      if (!user.app_metadata?.role) {
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
              email: emailDisplay || user.email,
              normalized_email: emailCanonical || null,
              role: 'customer',
            });

            // Claim any anonymous quotes submitted with this email via Postgres RPC.
            // Pass the canonical form so we match across alias variants.
            if (emailCanonical) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (serviceClient as any).rpc('claim_anonymous_quotes', {
                p_user_id: user.id,
                p_email: emailCanonical,
              });
            }
          }

          // Sync the resolved role into app_metadata so the JWT is correct on next sign-in.
          await serviceClient.auth.admin.updateUserById(user.id, {
            app_metadata: { role },
          });
        }
      } else if (serviceClient && emailCanonical) {
        // Existing user signing in again — make sure normalized_email is set
        // (covers users who pre-date migration 035) and re-sync display email
        // in case Google returned a tidier capitalization.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (serviceClient as any).from('profiles').upsert({
          id: user.id,
          email: emailDisplay,
          normalized_email: emailCanonical,
        });
      }

      // Honour an explicit redirect (e.g. /account/update-password), otherwise
      // send the user to their role-based home.
      destination = explicitRedirect || homePathForRole(role);

      // For email confirmation sign-ups, flag the destination so the portal
      // can show a "email verified" success message.
      if (type === 'signup' && !explicitRedirect) {
        destination += '?confirmed=1';
      }
    }
  }

  return NextResponse.redirect(new URL(destination, req.url));
}
