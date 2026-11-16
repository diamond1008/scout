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
        {/* Apple Liquid Glass Ambient Glow Orbs */}
        <div suppressHydrationWarning className="fixed -top-40 -left-40 w-[550px] h-[550px] bg-gradient-to-br from-blue-300/20 via-sky-200/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
        <div suppressHydrationWarning className="fixed top-1/4 -right-40 w-[600px] h-[600px] bg-gradient-to-bl from-indigo-200/20 via-purple-100/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
        <div suppressHydrationWarning className="fixed -bottom-40 left-1/4 w-[700px] h-[700px] bg-gradient-to-tr from-sky-200/20 via-blue-100/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
        {children}
      </body>
    </html>
  );
}
