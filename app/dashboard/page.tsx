import type { Metadata } from "next";
import { Suspense } from "react";

import { logout } from "@/app/actions/auth";
import {
  SiteFooter,
  SiteHeader,
  secondaryButton,
} from "@/components/site-chrome";
import { requireUser } from "@/lib/current-user";

export const metadata: Metadata = {
  title: "Dashboard",
};

/** A placeholder landing spot for sign-up and sign-in until quotes exist. */
export default function DashboardPage() {
  return (
    <>
      <SiteHeader
        action={
          <form action={logout}>
            <button type="submit" className={secondaryButton}>
              Sign out
            </button>
          </form>
        }
      />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-16">
          <div className="animate-rise rounded-card border border-line bg-surface p-6 shadow-lift sm:p-8">
            {/* Reads the session cookie, so it streams in behind a boundary. */}
            <Suspense fallback={<GreetingSkeleton />}>
              <Greeting />
            </Suspense>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

async function Greeting() {
  const user = await requireUser();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome, {user.fullName}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Signed in as {user.email}
        {user.role === "admin" && " · admin"}
      </p>
    </>
  );
}

function GreetingSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="h-8 w-64 rounded-control bg-sunken" />
      <div className="mt-2 h-5 w-48 rounded-control bg-sunken" />
    </div>
  );
}
