import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Poppins } from "next/font/google";
import { cn } from "@/lib/utils";

const poppins = Poppins({ 
  subsets: ['latin'], 
  weight: ['300','400'], 
  variable: '--font-poppins' 
});

export const metadata: Metadata = {
  title: "Design Online - IA",
  description: "Gestão inteligente de leads para concessionárias",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={cn("antialiased", poppins.variable)}>
      <body className="font-poppins">
        {children}
      </body>
    </html>
  );
}
