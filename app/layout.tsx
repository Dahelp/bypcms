import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://bypcms.ru",
  ),
  title: "BYPCMS — CMS, модули и разработка сайтов",
  description:
    "Удобная CMS для бизнеса, интернет-магазинов и контентных проектов. Лицензии, модули, индивидуальный дизайн и разработка.",
  openGraph: {
    title: "BYPCMS — платформа для сильных веб-проектов",
    description:
      "CMS, модули, индивидуальный дизайн и разработка сайтов под ключ.",
    images: [{ url: "/og.png", width: 1672, height: 943, alt: "BYPCMS" }],
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BYPCMS — платформа для сильных веб-проектов",
    description:
      "CMS, модули, индивидуальный дизайн и разработка сайтов под ключ.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
