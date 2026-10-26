import Link from "next/link";

/** The trail back up from a user, or one of their quotes, to the users list. */
export function AdminBreadcrumbs({
  trail,
}: {
  /** Ancestors of the current page, outermost first. */
  trail: { href: string; label: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-subtle">
      <ol className="flex flex-wrap items-center gap-1.5">
        {trail.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            <Link
              href={crumb.href}
              className="font-medium text-brand hover:text-brand-strong"
            >
              {crumb.label}
            </Link>
            <span aria-hidden="true">/</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
