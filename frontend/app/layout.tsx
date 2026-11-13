import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-thai",
  display: "swap",
});

const THEME_SCRIPT = `try{var t=localStorage.getItem("saijai_theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}`;

export const metadata: Metadata = {
  title: "SaiJai Analytics | วิเคราะห์ค่าใช้จ่ายจากสลิป",
  description: "แดชบอร์ดวิเคราะห์ค่าใช้จ่ายจากสลิปธนาคารด้วย OCR และ AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${plexThai.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply the saved or system theme before first paint to avoid a light flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
