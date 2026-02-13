import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'A股分析助手 — 实时行情 · 技术分析',
  description: '实时A股行情分析，覆盖MA/MACD/RSI/KDJ/BOLL等技术指标，提供操作建议',
  keywords: 'A股,股票分析,技术指标,MACD,RSI,KDJ,布林带,K线图',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0f1e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
