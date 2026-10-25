import type { Metadata } from "next";

import { SignupForm } from "@/components/auth-forms";
import { AuthTabs } from "@/components/auth-tabs";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-muted">
        Sign up to request and keep your solar pre-qualification quotes.
      </p>
      <AuthTabs active="/signup" />
      <SignupForm />
    </>
  );
}
