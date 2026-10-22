import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Furigana Dubbing Studio — 日语假名注音与台本排版工具",
  description: "面向日语学习者与声优配音的离线振假名（ルビ）注音与排版系统。支持多音字消歧、数量词音变、专名词典与原生 Word / SRT 导出。",
  manifest: "./manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Furigana",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eef2f9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen selection:bg-indigo-500/20 selection:text-indigo-900 dark:selection:bg-indigo-400/30 dark:selection:text-indigo-100">
        {children}
      </body>
    </html>
  );
}
