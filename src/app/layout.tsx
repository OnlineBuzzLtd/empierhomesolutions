import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Empire Home Solutions",
  description: "Landing pages for boiler repair, boiler installation, power flushing, finance, and trust.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
