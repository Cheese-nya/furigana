import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Furigana Dubbing Studio — Neumorphism",
  description: "基于新拟物派 (Neumorphism) 柔和立体触感的日语假名注音与配音台本处理系统。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`antialiased min-h-screen bg-[#e0e5ec] text-gray-700 selection:bg-blue-200 selection:text-gray-900`}>
        {children}
      </body>
    </html>
  );
}
