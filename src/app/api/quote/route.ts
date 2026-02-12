// GET /api/quote?code=600519
import { NextRequest, NextResponse } from 'next/server';
import { getQuote, getKlines } from '@/lib/market-data';
import { normalizeCode } from '@/types/stock';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: '请提供股票代码' }, { status: 400 });
  }

  try {
    const normalized = normalizeCode(code);
    const [quote, dailyKlines, min5Klines] = await Promise.all([
      getQuote(normalized),
      getKlines(normalized, 'daily', 120),
      getKlines(normalized, '5min', 48), // 最近2天的5分钟线
    ]);

    return NextResponse.json({ quote, dailyKlines, min5Klines });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取行情失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
