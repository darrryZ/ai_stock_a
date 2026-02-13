// GET /api/batch-quote?codes=sh600519,sz000001,sz300750
// 批量获取行情（减少请求数）

import { NextRequest, NextResponse } from 'next/server';
import { normalizeCode } from '@/types/stock';

function toSecid(code: string): string {
  const pure = code.replace(/^(sh|sz|bj)/, '');
  if (code.startsWith('sh')) return `1.${pure}`;
  return `0.${pure}`;
}

export async function GET(req: NextRequest) {
  const codesParam = req.nextUrl.searchParams.get('codes');
  if (!codesParam) {
    return NextResponse.json({ error: '请提供股票代码列表' }, { status: 400 });
  }

  const codes = codesParam.split(',').map((c) => normalizeCode(c.trim())).filter(Boolean);
  if (codes.length === 0) {
    return NextResponse.json({ error: '无有效代码' }, { status: 400 });
  }

  try {
    const secids = codes.map((c) => toSecid(c)).join(',');
    const fields = 'f2,f3,f4,f12,f14,f58';
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=${fields}&secids=${secids}`;

    const res = await fetch(url, {
      headers: { Referer: 'https://data.eastmoney.com' },
      next: { revalidate: 0 },
    });

    const json = await res.json();
    const items = json.data?.diff || [];

    const quotes: Record<string, { price: number; changePercent: number; change: number; name: string }> = {};

    for (const item of items) {
      const stockCode = String(item.f12);
      // 找出对应的完整代码
      const fullCode = codes.find((c) => c.endsWith(stockCode)) || stockCode;
      quotes[fullCode] = {
        price: Number(item.f2) || 0,
        changePercent: Number(item.f3) || 0,
        change: Number(item.f4) || 0,
        name: item.f58 || item.f14 || '',
      };
    }

    return NextResponse.json({ quotes }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch {
    return NextResponse.json({ error: '批量查询失败' }, { status: 500 });
  }
}
