import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Персональная концепция — BYPCMS",
  robots: { index: false, follow: false, nocache: true },
};

export default function ConceptsLayout({children}:{children:React.ReactNode}) { return children; }
