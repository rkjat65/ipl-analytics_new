import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: { default: "IPL Analytics", template: "%s | IPL Analytics" },
  description: "Premium ball-by-ball IPL analytics dashboard — 2007 to 2025.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen antialiased" style={{ background: "var(--color-bg-base)" }}>
        <Suspense>
          <Sidebar />
        </Suspense>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {/* Top bar */}
          <header
            className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 border-b"
            style={{
              background: "rgba(7,8,10,0.85)",
              backdropFilter: "blur(12px)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-text-muted)" }}>
                Indian Premier League
              </span>
              <span className="text-xs" style={{ color: "var(--color-border-subtle)" }}>·</span>
              <span className="text-xs font-medium" style={{ color: "var(--color-brand)" }}>
                2007 – 2025
              </span>
            </div>

            {/* Live indicator */}
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span className="flex h-2 w-2 rounded-full" style={{ background: "var(--color-success)" }} />
              DB connected
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 px-8 py-6">
            <Suspense>
              {children}
            </Suspense>
          </main>
        </div>
      </body>
    </html>
  );
}
