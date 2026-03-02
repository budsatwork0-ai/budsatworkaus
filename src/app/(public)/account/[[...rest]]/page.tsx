// src/app/(public)/account/[[...rest]]/page.tsx
import { createAuthServerClient } from "@/lib/supabase/server-client";
import { redirect } from "next/navigation";
import SignInClient from "./SignInClient";
import { homePathForRole, resolveUserRole } from "@/types/roles";

export default async function AccountPage() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect(homePathForRole(resolveUserRole(user.app_metadata?.role)));
  }

  return <SignInClient />;
}
