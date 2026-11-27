import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suhail Industries - Next-Gen Defense & Energy Technology",
  description:
    "Suhail Industries contracts and delivers next-generation defense and energy technology across the Arab world.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preload" href="/sites/intelic/fonts/magnetik-regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/sites/intelic/fonts/magnetik-light.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
