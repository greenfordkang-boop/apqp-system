import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "신성오토텍(주) 품질문서관리 시스템",
  description: "신성오토텍 APQP 품질문서관리 시스템 - IATF 16949 Compliant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
