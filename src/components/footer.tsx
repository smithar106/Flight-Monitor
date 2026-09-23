import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-sm text-ink-muted sm:px-8 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-medium text-ink">Flight Pulse</div>
          <p className="mt-1 max-w-md text-[0.8125rem] leading-relaxed text-ink-faint">
            U.S. flight operations intelligence. Live flight status via
            AviationStack; historical performance baselines via the U.S. Bureau
            of Transportation Statistics.
          </p>
        </div>
        <div className="flex gap-8 text-[0.8125rem]">
          <div>
            <div className="mb-2 font-medium text-ink">Data</div>
            <ul className="space-y-1.5">
              <li>
                <Link href="/methodology" className="hover:text-ink">
                  Methodology
                </Link>
              </li>
              <li>
                <a
                  href="https://aviationstack.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-ink"
                >
                  AviationStack
                </a>
              </li>
              <li>
                <a
                  href="https://www.bts.gov"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-ink"
                >
                  BTS
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
