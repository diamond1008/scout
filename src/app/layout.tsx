import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scout — GenAI Fund Outreach",
  description: "AI-powered founder discovery & outreach console for GenAI Fund",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          {/* Top Nav */}
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-6 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">🔭 Scout</span>
                <span className="text-xs text-muted-foreground">by GenAI Fund</span>
              </div>

              <nav className="flex items-center gap-1 ml-6">
                <a
                  href="/"
                  className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-accent transition-colors"
                >
                  Campaigns
                </a>
              </nav>

              <div className="ml-auto flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Sandbox
                </span>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
