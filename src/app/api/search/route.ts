// GET /api/search?q=贵州茅台 或 /api/search?q=gzmt 或 /api/search?q=600519
// 股票名称/拼音/代码模糊搜索（东方财富）

import { NextRequest, NextResponse } from 'next/server';

interface SearchResult {
  code: string;       // 如 sh600519
  name: string;       // 股票名称
  market: string;     // 市场
  type: string;       // 类型描述
}

const EAST_SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim();
  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const params = new URLSearchParams({
      input: query,
      type: '14',           // 14 = 沪深A股 + 基金
      token: 'D43BF722C8E33BDC906FB84D85E326E8',
      count: '10',
    });

    const res = await fetch(`${EAST_SEARCH_URL}?${params}`, {
      headers: { Referer: 'https://www.eastmoney.com' },
      next: { revalidate: 60 },
    });

    const json = await res.json();
    const items = json?.QuotationCodeTable?.Data || [];

    const results: SearchResult[] = items.map((item: Record<string, string | number>) => {
      const code = String(item.Code);
      const marketId = Number(item.MktNum);
      // 市场映射
      let prefix = '';
      if (marketId === 1) prefix = 'sh';       // 上海
      else if (marketId === 0) prefix = 'sz';   // 深圳
      else if (marketId === 2) prefix = 'bj';   // 北京

      return {
        code: `${prefix}${code}`,
        name: String(item.Name || ''),
        market: prefix === 'sh' ? '上海' : prefix === 'sz' ? '深圳' : prefix === 'bj' ? '北京' : '其他',
        type: String(item.SecurityTypeName || '股票'),
      };
    }).filter((r: SearchResult) => r.code.length >= 8); // 过滤无效

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
