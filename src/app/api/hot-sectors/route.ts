// GET /api/hot-sectors
// 市场热点板块：涨幅榜 + 跌幅榜（概念板块）

import { NextResponse } from 'next/server';

interface SectorItem {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  change: number;
}

const EAST_URL = 'https://push2.eastmoney.com/api/qt/clist/get';

async function fetchSectors(order: 'asc' | 'desc', count = 10): Promise<SectorItem[]> {
  const params = new URLSearchParams({
    fid: 'f3',
    po: order === 'desc' ? '1' : '0',
    pz: String(count),
    pn: '1',
    np: '1',
    fltt: '2',
    invt: '2',
    fs: 'm:90+t:3',  // 概念板块
    fields: 'f2,f3,f4,f12,f14',
  });

  const res = await fetch(`${EAST_URL}?${params}`, {
    headers: { Referer: 'https://data.eastmoney.com' },
    next: { revalidate: 60 },
  });

  const json = await res.json();
  const items = json.data?.diff || [];

  return items.map((item: Record<string, number | string>) => ({
    code: String(item.f12),
    name: String(item.f14),
    price: Number(item.f2) || 0,
    changePercent: Number(item.f3) || 0,
    change: Number(item.f4) || 0,
  }));
}

export async function GET() {
  try {
    const [gainers, losers] = await Promise.all([
      fetchSectors('desc', 10),
      fetchSectors('asc', 10),
    ]);

    return NextResponse.json({
      gainers,
      losers,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch {
    return NextResponse.json({ error: '获取板块数据失败' }, { status: 500 });
  }
}
