import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://bypcms.ru",
  ),
  title: "BYPCMS — сайты, которые не боятся изменений",
  description:
    "Модульная CMS для индивидуальных сайтов, бизнеса, интернет-магазинов и контентных проектов.",
  openGraph: {
    title: "BYPCMS — сайты, которые не боятся изменений",
    description:
      "Стабильное ядро, независимые модули и свобода индивидуальной веб-разработки.",
    images: [{ url: "/og.png", width: 1672, height: 943, alt: "BYPCMS" }],
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BYPCMS — сайты, которые не боятся изменений",
    description:
      "Стабильное ядро, независимые модули и свобода индивидуальной веб-разработки.",
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
