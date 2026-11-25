import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scout — GenAI Fund Founder Outreach Console",
  description: "AI-Powered Founder Discovery & Evidence-Grounded Outreach Console for Southeast Asia AI & Robotics Ecosystem",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/25 to-indigo-50/20 font-sans text-slate-900 antialiased selection:bg-blue-500/20 selection:text-blue-900 relative overflow-x-hidden"
      >
        {children}
      </body>
    </html>
  );
}
