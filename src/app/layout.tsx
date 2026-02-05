import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APQP 품질문서 관리시스템",
  description: "Advanced Product Quality Planning System - IATF 16949 Compliant",
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
