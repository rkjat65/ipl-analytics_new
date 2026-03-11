"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

const SEASONS = [
  "2025","2024","2023","2022","2021","2020/21","2019","2018",
  "2017","2016","2015","2014","2013","2012","2011","2009/10","2009","2007/08",
];

export default function SeasonPicker() {
  const router      = useRouter();
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const current     = searchParams.get("season") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) params.set("season", e.target.value);
    else params.delete("season");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="relative flex items-center">
      <select
        value={current}
        onChange={onChange}
        className="appearance-none pl-3 pr-8 py-2 text-sm font-medium rounded-lg border cursor-pointer outline-none transition-colors"
        style={{
          background:   "var(--color-bg-raised)",
          borderColor:  "var(--color-border-subtle)",
          color:        "var(--color-text-primary)",
        }}
      >
        <option value="">All Seasons</option>
        {SEASONS.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2 pointer-events-none"
        style={{ color: "var(--color-text-muted)" }}
      />
    </div>
  );
}
