import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Product Hierarchy Manager",
  description: "Interactive product hierarchy builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}