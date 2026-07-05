import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const uiSans = Manrope({
  variable: "--font-ui-sans",
  subsets: ["latin"],
});

const editorialSerif = Cormorant_Garamond({
  variable: "--font-editorial-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Oracle Room",
  description: "A premium digital tarot sanctuary with ritual pacing and AI interpretation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${uiSans.variable} ${editorialSerif.variable} h-full antialiased`}
    >
      <head>
        <Script id="oracle-theme-init" strategy="beforeInteractive">
          {`
            (() => {
              const stored = localStorage.getItem("oracle-theme");
              const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              const theme = stored === "light" || stored === "dark" ? stored : systemDark ? "dark" : "light";
              document.documentElement.dataset.theme = theme;
            })();
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
