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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-blue-600/30 selection:text-blue-200">
        {children}
      </body>
    </html>
  );
}
