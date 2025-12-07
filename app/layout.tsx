import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StokStak - Professional Inventory Management",
  description: "Modern inventory & stock management system",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased bg-gradient-to-br from-slate-50 to-slate-100">
        {children}
      </body>
    </html>
  );
}