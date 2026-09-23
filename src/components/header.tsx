import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-abyss/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-sm2 bg-pulse text-abyss">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 9.5 6.5 2l2.2 6 2.3-3L14 9.5H2Z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">
            Flight&nbsp;Pulse
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-ink-muted md:flex">
          <Link href="/" className="transition-colors hover:text-ink">
            Overview
          </Link>
          <Link href="/#airlines" className="transition-colors hover:text-ink">
            Airlines
          </Link>
          <Link href="/methodology" className="transition-colors hover:text-ink">
            Methodology
          </Link>
        </nav>

        <div className="text-[0.6875rem] uppercase tracking-eyebrow text-ink-faint">
          U.S. Flight Operations
        </div>
      </div>
    </header>
  );
}
