import type { Metadata } from "next";
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
    <html lang="en">
      <body>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "12px 20px",
            borderBottom: "1px solid #e5e7eb",
            background: "var(--surface, #fff)",
          }}
        >
          <UserNav />
        </header>
        {children}
      </body>
    </html>
  );
}
