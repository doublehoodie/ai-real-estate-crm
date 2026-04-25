import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { UserNav } from "@/components/UserNav";
import { ActionWindowRoot } from "@/components/action-window/ActionWindowRoot";
import { GlobalExecutionLayers } from "@/components/execution/GlobalExecutionLayers";
import { AuthStateBridge } from "@/components/providers/AuthStateBridge";

export const metadata: Metadata = {
  title: {
    default: "GrassLeads",
    template: "%s · GrassLeads",
  },
  description: "AI-native CRM for real estate agents to manage and qualify leads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`theme-light ${GeistSans.variable} ${GeistSans.className}`}>
      <body className="bg-slate-50 text-slate-900 dark:bg-neutral-950 dark:text-white">
        <AuthStateBridge />
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-3.5 transition-all duration-200 dark:border-neutral-800 dark:bg-neutral-950">
          <UserNav />
        </header>
        {children}
        <ActionWindowRoot />
        <GlobalExecutionLayers />
      </body>
    </html>
  );
}
