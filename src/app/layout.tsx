import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'A股分析助手',
  description: '实时A股行情分析 + 技术指标 + 操作建议',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-950 text-gray-100 min-h-screen">{children}</body>
    </html>
  );
}
