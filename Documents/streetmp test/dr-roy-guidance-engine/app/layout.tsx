import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LiquidBackground from "@/components/ui/LiquidBackground";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dr. Roy Prasad | Future-Ready Guidance Engine",
  description: "Architecting Your Future. Workforce • Education • Migration • Compliance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <LiquidBackground />
        <main className="relative z-10 min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
