/** The greenQuote mark: a sun rising over a two-tone solar panel. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="13" r="6" fill="var(--color-sun)" />
      <g stroke="var(--color-sun)" strokeWidth="2" strokeLinecap="round">
        <path d="M16 2.5v2.5M6.5 6.5l1.8 1.8M25.5 6.5l-1.8 1.8M3 13h2.5M26.5 13H29" />
      </g>
      <path d="M4 29l5-10h7l-3 10z" fill="var(--color-panel)" />
      <path d="M13 29l3-10h7l5 10z" fill="var(--color-panel-light)" />
    </svg>
  );
}
