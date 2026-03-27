import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Clown Arena🤡",
  description: "1v1 coding duels with user-generated problems and token stakes."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-sans">
      <body className="poster-grid">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
