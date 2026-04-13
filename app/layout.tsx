import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { UserNav } from "@/components/UserNav";

export const metadata: Metadata = {
  title: "AI Real Estate CRM",
  description: "AI-native CRM for real estate agents to manage and qualify leads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistSans.className}`}>
      <body>
        <header className="flex items-center justify-end border-b border-gray-300 bg-[#e5e7eb] px-5 py-3">
          <UserNav />
        </header>
        {children}
      </body>
    </html>
  );
}
