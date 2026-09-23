import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-pulse text-white">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 10 6.5 3l2.2 5.5 2.3-2.8L14 10H2Z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">
            Flight Pulse
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm text-ink-muted">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Overview
          </Link>
          <Link
            href="/#airlines"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Airlines
          </Link>
          <Link
            href="/methodology"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Methodology
          </Link>
        </nav>
      </div>
    </header>
  );
}
