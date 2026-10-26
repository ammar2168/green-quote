import Link from "next/link";

const tabs = [
  { href: "/login", label: "Sign in" },
  { href: "/signup", label: "Create account" },
] as const;

/**
 * Looks like a segmented control, but each side is its own route, so the
 * browser's back button and a shared /signup link both behave.
 */
export function AuthTabs({
  active,
}: {
  active: (typeof tabs)[number]["href"];
}) {
  return (
    <nav
      aria-label="Account"
      className="mt-6 grid grid-cols-2 rounded-control bg-sunken p-1 text-sm"
    >
      {tabs.map((tab) => {
        const isActive = tab.href === active;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-[0.5rem] py-1.5 text-center font-medium transition ${
              isActive
                ? "bg-surface text-ink shadow-card"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
