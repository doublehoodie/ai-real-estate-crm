import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
