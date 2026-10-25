import Link from "next/link";

export type NavSection = "new" | "quotes";

const links: { section: NavSection; href: string; label: string }[] = [
  { section: "new", href: "/quotes/new", label: "New quote" },
  { section: "quotes", href: "/quotes", label: "My quotes" },
];

/**
 * Each page names its own section, rather than the nav reading the URL, which
 * would make it a Client Component that cannot prerender.
 */
export function AppNav({ current }: { current?: NavSection }) {
  return (
    <nav aria-label="Main" className="flex items-center gap-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={current === link.section ? "page" : undefined}
          className="rounded-control px-2.5 py-2 text-sm whitespace-nowrap sm:px-3 font-medium text-muted transition-colors hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink aria-[current=page]:shadow-card"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
