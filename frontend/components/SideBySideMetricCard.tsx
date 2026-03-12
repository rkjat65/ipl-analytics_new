import React from "react";
import { LucideIcon } from "lucide-react";

interface SideBySideMetricCardProps {
  label: string;
  value1: number | string;
  value2: number | string;
  label1: string;
  label2: string;
  icon?: LucideIcon;
  color1?: string;
  color2?: string;
  showDifference?: boolean;
}

export default function SideBySideMetricCard({
  label,
  value1,
  value2,
  label1,
  label2,
  icon: Icon,
  color1 = "var(--color-brand)",
  color2 = "var(--color-success)",
  showDifference = true,
}: SideBySideMetricCardProps) {
  // Calculate difference if both values are numbers
  let diff: number | null = null;
  let diffPercent: number | null = null;

  if (
    typeof value1 === "number" &&
    typeof value2 === "number" &&
    showDifference
  ) {
    diff = value2 - value1;
    if (value1 !== 0) {
      diffPercent = ((diff / value1) * 100);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={20} style={{ color: color1 }} />}
        <h3 className="font-semibold text-sm">{label}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left Value */}
        <div className="text-center p-4 rounded-lg" style={{ backgroundColor: `${color1}20` }}>
          <p className="text-xs font-medium text-gray-600 mb-2">{label1}</p>
          <p className="text-3xl font-bold" style={{ color: color1 }}>
            {value1}
          </p>
        </div>

        {/* Right Value */}
        <div className="text-center p-4 rounded-lg" style={{ backgroundColor: `${color2}20` }}>
          <p className="text-xs font-medium text-gray-600 mb-2">{label2}</p>
          <p className="text-3xl font-bold" style={{ color: color2 }}>
            {value2}
          </p>
        </div>
      </div>

      {/* Difference */}
      {diff !== null && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Difference</span>
          <div className="text-right">
            <p
              className="text-lg font-bold"
              style={{
                color:
                  diff > 0
                    ? "var(--color-success)"
                    : diff < 0
                      ? "var(--color-danger)"
                      : "var(--color-text-muted)",
              }}
            >
              {diff > 0 ? "+" : ""}
              {diff}
            </p>
            {diffPercent !== null && (
              <p className="text-xs text-gray-500">
                {diffPercent > 0 ? "+" : ""}
                {diffPercent.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
