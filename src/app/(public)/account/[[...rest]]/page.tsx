// src/app/(public)/account/[[...rest]]/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import SignInClient from "./SignInClient";

const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default async function AccountPage() {
  // If the user is already signed in, skip this page
  if (hasClerkKeys) {
    const { userId } = await auth();
    if (userId) redirect("/dashboard");
  }

  return <SignInClient hasClerkKeys={hasClerkKeys} />;
}
