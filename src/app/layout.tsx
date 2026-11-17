import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dados IPCF — Igreja Presbiteriana em Casa Forte",
  description:
    "Plataforma oficial de cadastro, vínculo familiar e acompanhamento pastoral dos membros e congregados da Igreja Presbiteriana em Casa Forte (Recife - PE).",
  manifest: "/manifest.json",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  icons: {
    icon: [
      { url: "/dados-ipcf-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/dados-ipcf-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/dados-ipcf-icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b4d37",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ipcf-bg text-ipcf-ink font-sans selection:bg-ipcf-gold-soft selection:text-ipcf-deep">
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo principal
        </a>
        {children}
      </body>
    </html>
  );
}
