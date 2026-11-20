import type { ReactNode } from "react";
import { LocaleProvider } from "../components/PublicLocale";
export default function EnglishLayout({children}: {children: ReactNode}) {
  return <LocaleProvider locale="en"><div lang="en">{children}</div></LocaleProvider>;
}
