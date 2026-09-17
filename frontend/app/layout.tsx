import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
