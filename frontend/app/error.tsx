"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl"
        style={{ background: "rgba(239,68,68,0.12)" }}>
        <AlertTriangle size={28} style={{ color: "var(--color-danger)" }} />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
          Something went wrong
        </h2>
        <p className="text-sm max-w-md" style={{ color: "var(--color-text-muted)" }}>
          {error.message?.includes("API error") || error.message?.includes("fetch")
            ? "Could not reach the API server. Make sure the FastAPI backend is running on port 8000."
            : error.message || "An unexpected error occurred."}
        </p>
      </div>

      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: "var(--color-brand)", color: "#fff" }}
      >
        <RefreshCw size={14} />
        Try again
      </button>

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Backend: <code className="font-mono">uvicorn backend.main:app --port 8000</code>
      </p>
    </div>
  );
}
