import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const uiSans = localFont({
  src: "./fonts/manrope-latin.woff2",
  variable: "--font-ui-sans",
  display: "swap",
  style: "normal",
  weight: "200 800",
});

const editorialSerif = localFont({
  src: "./fonts/cormorant-garamond-latin.woff2",
  variable: "--font-editorial-serif",
  display: "swap",
  style: "normal",
  weight: "400 700",
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
      lang="zh-CN"
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
