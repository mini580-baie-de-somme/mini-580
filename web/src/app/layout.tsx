import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShellWrapper } from "@/components/AppShellWrapper";
import { Footer } from "@/components/Footer";
import { LocaleProvider } from "@/components/LocaleProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Class Mini 5.80 Baie de Somme — Class Globe 5.80 #268-269-270",
    template: "%s | Class Mini 5.80 Baie de Somme",
  },
  description:
    "Class Mini 5.80 baie de Somme. Blog bilingue de construction de trois Class Globe 5.80 en baie de Somme.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} flex min-h-screen flex-col antialiased`}>
        <LocaleProvider>
          <AppShellWrapper>
            <main className="flex-1">{children}</main>
            <Footer />
          </AppShellWrapper>
        </LocaleProvider>
      </body>
    </html>
  );
}
