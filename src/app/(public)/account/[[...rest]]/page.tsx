// src/app/(public)/account/[[...rest]]/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { brand } from "../../../ui/theme";

const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default async function AccountPage() {
  if (!hasClerkKeys) {
    return (
      <main className="mx-auto max-w-6xl px-6 md:px-8 py-12 space-y-3">
        <h1 className="text-3xl font-bold" style={{ color: brand.primary }}>
          Dashboard access
        </h1>
        <p className="text-slate-600">Clerk is not configured for this build.</p>
        <p className="text-slate-600">Visit the dashboard directly to see the UI while you configure Clerk.</p>
        <Link
          className="inline-flex rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800"
          href="/dashboard"
        >
          Open dashboard
        </Link>
        <p className="text-xs text-slate-500">
          Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
          <code>CLERK_SECRET_KEY</code> when you are ready to sign in.
        </p>
      </main>
    );
  }

  // If the user is already signed in, skip this page
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-6xl px-6 md:px-8 py-12 space-y-3">
      <h1 className="text-3xl font-bold" style={{ color: brand.primary }}>
        Sign in
      </h1>

      <p className="text-slate-600">Access your Buds at Work dashboard.</p>

      <div className="mt-6 max-w-md">
        <SignIn afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard" />
      </div>
    </main>
  );
}
