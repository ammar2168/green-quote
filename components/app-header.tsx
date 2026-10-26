import { Suspense } from "react";

import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/current-user";

import { AppNav, type NavSection } from "./app-nav";
import { SiteHeader } from "./site-chrome";

/**
 * The header of every signed-in page: the main nav and the account menu.
 * `admin` swaps the nav for the admin pages' own.
 */
export function AppHeader({
  current,
  admin = false,
}: {
  current?: NavSection;
  admin?: boolean;
}) {
  return (
    <SiteHeader
      nav={<AppNav current={current} admin={admin} />}
      action={
        // Reads the session cookie, so it streams in behind a boundary.
        <Suspense fallback={<div className="h-9 w-20 sm:w-40" />}>
          <AccountMenu />
        </Suspense>
      }
    />
  );
}

async function AccountMenu() {
  const user = await requireUser();

  return (
    <>
      <span
        aria-hidden="true"
        className="hidden size-8 items-center justify-center rounded-full bg-panel sm:flex text-sm font-semibold text-white"
      >
        {user.fullName.charAt(0).toUpperCase()}
      </span>
      <span className="hidden text-sm font-medium sm:inline">
        {user.fullName}
      </span>
      <form action={logout}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="flex size-9 items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink"
        >
          <SignOutIcon />
        </button>
      </form>
    </>
  );
}

function SignOutIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
