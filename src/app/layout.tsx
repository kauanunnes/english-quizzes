import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { PreferencesSync } from "@/components/PreferencesSync";
import { SERVER_THEME, THEME_SCRIPT } from "@/components/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Segunda Tela",
    template: "%s · Segunda Tela",
  },
  description:
    "Perguntas de listening em inglês, bloco a bloco e sem spoiler, para responder no celular enquanto você assiste à série.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      data-theme={SERVER_THEME}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <PreferencesSync />
        <Header />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
