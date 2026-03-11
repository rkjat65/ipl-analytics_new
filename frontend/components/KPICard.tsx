import { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  accent?: "brand" | "accent" | "success" | "warn";
  className?: string;
}

const accentMap = {
  brand:   { color: "var(--color-brand)",   bg: "var(--color-brand-glow)" },
  accent:  { color: "var(--color-accent)",  bg: "rgba(59,130,246,0.12)" },
  success: { color: "var(--color-success)", bg: "rgba(34,197,94,0.12)" },
  warn:    { color: "var(--color-warn)",    bg: "rgba(234,179,8,0.12)" },
};

export default function KPICard({ label, value, sub, icon: Icon, accent = "brand", className }: Props) {
  const { color, bg } = accentMap[accent];

  return (
    <div
      className={clsx("card flex flex-col gap-3 p-5 transition-all duration-200 hover:border-[var(--color-border-subtle)]", className)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--color-text-muted)" }}>
          {label}
        </span>
        {Icon && (
          <span className="flex items-center justify-center w-7 h-7 rounded-md"
            style={{ background: bg, color }}>
            <Icon size={14} />
          </span>
        )}
      </div>

      <div>
        <p className="stat-num text-3xl font-bold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}>
          {value}
        </p>
        {sub && (
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
