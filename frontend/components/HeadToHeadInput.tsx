"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

interface Props {
  currentPlayer: string;
  currentOpponent?: string;
}

export default function HeadToHeadInput({ currentPlayer, currentOpponent }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery]     = useState(currentOpponent ?? "");
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen]       = useState(false);
  const [isPending, startTransition] = useTransition();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    const res = await fetch(`/api/players?q=${encodeURIComponent(q)}&limit=8`);
    const data: { name: string }[] = await res.json();
    setResults(data.map(d => d.name).filter(n => n !== currentPlayer));
    setOpen(true);
  }, [currentPlayer]);

  function select(name: string) {
    setQuery(name);
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set("opponent", name);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("opponent");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        {/* Fixed player */}
        <div className="px-3 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "var(--color-bg-raised)", color: "var(--color-brand)", border: "1px solid var(--color-border-subtle)" }}>
          {currentPlayer}
        </div>

        <span className="text-sm font-bold" style={{ color: "var(--color-text-muted)" }}>vs</span>

        {/* Opponent search */}
        <div className="relative">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-border-subtle)" }}>
            <Search size={13} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search opponent…"
              value={query}
              onChange={e => { setQuery(e.target.value); search(e.target.value); }}
              onFocus={() => query.length >= 2 && setOpen(true)}
              className="bg-transparent text-sm outline-none w-48"
              style={{ color: "var(--color-text-primary)" }}
            />
            {query && (
              <button onClick={clear} style={{ color: "var(--color-text-muted)" }}>
                <X size={12} />
              </button>
            )}
          </div>

          {open && results.length > 0 && (
            <ul className="absolute z-20 top-full mt-1 w-full rounded-lg shadow-xl overflow-hidden"
              style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-border-subtle)" }}>
              {results.map(name => (
                <li key={name}>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-hover)] transition-colors"
                    style={{ color: "var(--color-text-primary)" }}
                    onClick={() => select(name)}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isPending && (
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Loading…
          </span>
        )}
      </div>
    </div>
  );
}
