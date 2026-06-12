import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HALO Console",
  description: "Local AI Command Interface for HALO Brain Node",
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
