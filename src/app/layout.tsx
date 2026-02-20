import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Empire Home Solutions",
  description: "Paid landing page foundation for repair, installation, finance, and trust pages.",
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
