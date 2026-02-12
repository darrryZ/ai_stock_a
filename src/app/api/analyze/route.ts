// GET /api/analyze?code=600519
// 综合分析：行情 + K线 + 技术指标 + 资讯

import { NextRequest, NextResponse } from 'next/server';
import { getQuote, getKlines } from '@/lib/market-data';
import { normalizeCode } from '@/types/stock';
import { analyzeStock } from '@/lib/analyzer';
import { calculateIndicatorSeries } from '@/lib/indicators';
import type { NewsItem } from '@/types/stock';

const EAST_NEWS_URL = 'https://search-api-web.eastmoney.com/search/jsonp';

async function fetchNews(keyword: string): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    cb: 'cb',
    param: JSON.stringify({
      uid: '',
      keyword,
      type: ['cmsArticleWebOld'],
      client: 'web',
      clientType: 'web',
      clientVersion: 'curr',
      param: { cmsArticleWebOld: { searchScope: 'default', sort: 'default', pageIndex: 1, pageSize: 6 } },
    }),
  });

  try {
    const res = await fetch(`${EAST_NEWS_URL}?${params}`, {
      headers: { Referer: 'https://so.eastmoney.com' },
      next: { revalidate: 300 },
    });
    const text = await res.text();
    const jsonStr = text.replace(/^cb\(/, '').replace(/\);?$/, '');
    const json = JSON.parse(jsonStr);
    const articles = json?.result?.cmsArticleWebOld || [];
    return articles.map((item: Record<string, string>) => ({
      title: (item.title || '').replace(/<[^>]+>/g, ''),
      url: item.url || item.articleUrl || '',
      source: item.mediaName || '东方财富',
      time: item.date || '',
      summary: (item.content || '').replace(/<[^>]+>/g, '').slice(0, 120),
    }));
  } catch {
    return [];
  }
}

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
      getKlines(normalized, '5min', 48),
    ]);

    // 获取资讯（用股票名称搜索）
    const news = await fetchNews(quote.name);

    // 分析
    const result = analyzeStock(quote, dailyKlines, news);

    // 计算全序列指标（给图表用）
    const indicatorSeries = calculateIndicatorSeries(dailyKlines);

    return NextResponse.json({
      ...result,
      dailyKlines,
      min5Klines,
      indicatorSeries,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '分析失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
