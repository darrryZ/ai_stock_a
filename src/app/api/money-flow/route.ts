// GET /api/money-flow?code=sh600519
// 个股资金流向：超大单/大单/中单/小单 流入流出

import { NextRequest, NextResponse } from 'next/server';
import { normalizeCode } from '@/types/stock';

function codeToSecid(code: string): string {
  const pure = code.replace(/^(sh|sz|bj)/, '');
  if (code.startsWith('sh')) return `1.${pure}`;
  if (code.startsWith('sz')) return `0.${pure}`;
  if (code.startsWith('bj')) return `0.${pure}`;
  return `1.${pure}`;
}

export async function GET(req: NextRequest) {
  const rawCode = req.nextUrl.searchParams.get('code');
  if (!rawCode) {
    return NextResponse.json({ error: '请提供股票代码' }, { status: 400 });
  }

  const code = normalizeCode(rawCode);
  const secid = codeToSecid(code);

  try {
    const fields = 'f62,f64,f65,f66,f70,f71,f72,f76,f77,f78,f82,f83,f84,f124,f184';
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=${fields}&secids=${secid}`;

    const res = await fetch(url, {
      headers: { Referer: 'https://data.eastmoney.com' },
      next: { revalidate: 30 },
    });

    const json = await res.json();
    const d = json.data?.diff?.[0];

    if (!d) {
      return NextResponse.json({ error: '未找到资金流向数据' }, { status: 404 });
    }

    // 单位：元 → 万元
    const toWan = (v: number) => +(v / 10000).toFixed(2);

    const superLargeIn = toWan(d.f64 || 0);
    const superLargeOut = toWan(d.f65 || 0);
    const largeIn = toWan(d.f70 || 0);
    const largeOut = toWan(d.f71 || 0);
    const mediumIn = toWan(d.f76 || 0);
    const mediumOut = toWan(d.f77 || 0);
    const smallIn = toWan(d.f82 || 0);
    const smallOut = toWan(d.f83 || 0);

    const mainInflow = superLargeIn + largeIn;
    const mainOutflow = superLargeOut + largeOut;

    return NextResponse.json({
      code,
      moneyFlow: {
        mainInflow: +mainInflow.toFixed(2),
        mainOutflow: +mainOutflow.toFixed(2),
        mainNet: +(mainInflow - mainOutflow).toFixed(2),
        retailInflow: +(mediumIn + smallIn).toFixed(2),
        retailOutflow: +(mediumOut + smallOut).toFixed(2),
        retailNet: +((mediumIn + smallIn) - (mediumOut + smallOut)).toFixed(2),
        superLargeNet: +(superLargeIn - superLargeOut).toFixed(2),
        largeNet: +(largeIn - largeOut).toFixed(2),
        mediumNet: +(mediumIn - mediumOut).toFixed(2),
        smallNet: +(smallIn - smallOut).toFixed(2),
      },
      mainNetPercent: d.f184 || 0,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch {
    return NextResponse.json({ error: '获取资金流向失败' }, { status: 500 });
  }
}
