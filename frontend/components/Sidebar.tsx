"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  Shield,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/",          label: "Dashboard",       icon: Home },
  { href: "/matches",   label: "Match Centre",    icon: Trophy },
  { href: "/players",   label: "Player Profiles", icon: Users },
  { href: "/teams",     label: "Team Analytics",  icon: Shield },
  { href: "/analytics", label: "Deep Analytics",  icon: BarChart3 },
];

const COMPARISONS = [
  { href: "/teams/compare",              label: "Team Comparison" },
  { href: "/analytics/seasons/compare",  label: "Season Comparison" },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r"
      style={{ background: "var(--color-bg-surface)", borderColor: "var(--color-border)" }}>

      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b"
        style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold"
          style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
          <Zap size={16} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-wide" style={{ color: "var(--color-text-primary)" }}>
            IPL Analytics
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            2007 – 2025
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--color-text-muted)" }}>
          Navigation
        </p>

        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active ? "nav-item-active" : "hover:bg-[var(--color-bg-hover)]"
              )}
              style={{
                color: active ? "var(--color-brand)" : "var(--color-text-secondary)",
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}

        {/* Comparison Section */}
        <div className="mt-6">
          <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}>
            Comparisons
          </p>
          {COMPARISONS.map(({ href, label }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active ? "nav-item-active" : "hover:bg-[var(--color-bg-hover)]"
                )}
                style={{
                  color: active ? "var(--color-brand)" : "var(--color-text-secondary)",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t text-xs"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
        <p>Data: Cricsheet.org</p>
        <p className="mt-0.5">1,169 matches · 278K balls</p>
      </div>
    </aside>
  );
}
