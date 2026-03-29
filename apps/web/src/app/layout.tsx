import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ConditionalShell } from "@/components/layout/conditional-shell";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Apex Hire – Hiring Intelligence Platform",
  description: "AI-Driven Hiring Intelligence Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ margin: 0, padding: 0 }}>
        <Providers>
          <ConditionalShell>{children}</ConditionalShell>
          <Toaster position="top-right" richColors expand />
        </Providers>
      </body>
    </html>
  );
}
