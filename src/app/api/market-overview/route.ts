// GET /api/market-overview
// 大盘指数概览：上证、深证、创业板

import { NextResponse } from 'next/server';

interface IndexQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;    // 亿手
  amount: number;    // 亿元
}

const INDICES = [
  { secid: '1.000001', code: 'sh000001', name: '上证指数' },
  { secid: '0.399001', code: 'sz399001', name: '深证成指' },
  { secid: '0.399006', code: 'sz399006', name: '创业板指' },
  { secid: '1.000688', code: 'sh000688', name: '科创50' },
  { secid: '1.000300', code: 'sh000300', name: '沪深300' },
  { secid: '0.399905', code: 'sz399905', name: '中证500' },
];

const EAST_QUOTE_URL = 'https://push2.eastmoney.com/api/qt/ulist.np/get';

export async function GET() {
  try {
    const secids = INDICES.map(i => i.secid).join(',');
    const params = new URLSearchParams({
      fltt: '2',
      secids: secids,
      fields: 'f2,f3,f4,f6,f12,f14',
      ut: 'fa5fd1943c7b386f172d6893dbfba10b',
      _: String(Date.now()),
    });

    const res = await fetch(`${EAST_QUOTE_URL}?${params}`, {
      headers: { Referer: 'https://quote.eastmoney.com' },
      next: { revalidate: 0 },
    });

    const json = await res.json();
    const items = json?.data?.diff || [];

    const quotes: IndexQuote[] = items.map((d: Record<string, number | string>, i: number) => ({
      code: INDICES[i]?.code || String(d.f12),
      name: INDICES[i]?.name || String(d.f14),
      price: Number(d.f2) || 0,
      change: Number(d.f4) || 0,
      changePercent: Number(d.f3) || 0,
      volume: 0,
      amount: Number(d.f6) ? Number(d.f6) / 100000000 : 0, // 转为亿
    }));

    return NextResponse.json({ indices: quotes, time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) });
  } catch (err) {
    console.error('获取大盘数据失败:', err);
    return NextResponse.json({ indices: [], time: '' });
  }
}
