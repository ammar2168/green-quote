import type { Metadata } from "next";

import { LoginForm } from "@/components/auth-forms";
import { AuthTabs } from "@/components/auth-tabs";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Welcome back
      </h1>
      <p className="mt-1 text-sm text-muted">
        Sign in to request and keep your solar pre-qualification quotes.
      </p>
      <AuthTabs active="/login" />
      <LoginForm />
    </>
  );
}
