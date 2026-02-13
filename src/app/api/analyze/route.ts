// GET /api/analyze?code=600519
// 综合分析：行情 + K线 + 技术指标 + 资讯

import { NextRequest, NextResponse } from 'next/server';
import { getQuote, getKlines } from '@/lib/market-data';
import { normalizeCode } from '@/types/stock';
import { analyzeStock } from '@/lib/analyzer';
import { calculateIndicatorSeries } from '@/lib/indicators';
import { runBacktest } from '@/lib/backtest';
import type { NewsItem, MoneyFlow } from '@/types/stock';

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

function codeToSecid(code: string): string {
  const pure = code.replace(/^(sh|sz|bj)/, '');
  if (code.startsWith('sh')) return `1.${pure}`;
  return `0.${pure}`;
}

async function fetchMoneyFlow(code: string): Promise<MoneyFlow | null> {
  try {
    const secid = codeToSecid(code);
    const fields = 'f62,f64,f65,f66,f70,f71,f72,f76,f77,f78,f82,f83,f84,f124,f184';
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=${fields}&secids=${secid}`;
    const res = await fetch(url, {
      headers: { Referer: 'https://data.eastmoney.com' },
      next: { revalidate: 30 },
    });
    const json = await res.json();
    const d = json.data?.diff?.[0];
    if (!d) return null;

    const toWan = (v: number) => +(v / 10000).toFixed(2);
    const superLargeIn = toWan(d.f64 || 0);
    const superLargeOut = toWan(d.f65 || 0);
    const largeIn = toWan(d.f70 || 0);
    const largeOut = toWan(d.f71 || 0);
    const mediumIn = toWan(d.f76 || 0);
    const mediumOut = toWan(d.f77 || 0);
    const smallIn = toWan(d.f82 || 0);
    const smallOut = toWan(d.f83 || 0);

    return {
      mainInflow: +(superLargeIn + largeIn).toFixed(2),
      mainOutflow: +(superLargeOut + largeOut).toFixed(2),
      mainNet: +((superLargeIn + largeIn) - (superLargeOut + largeOut)).toFixed(2),
      retailInflow: +(mediumIn + smallIn).toFixed(2),
      retailOutflow: +(mediumOut + smallOut).toFixed(2),
      retailNet: +((mediumIn + smallIn) - (mediumOut + smallOut)).toFixed(2),
      superLargeNet: +(superLargeIn - superLargeOut).toFixed(2),
      largeNet: +(largeIn - largeOut).toFixed(2),
      mediumNet: +(mediumIn - mediumOut).toFixed(2),
      smallNet: +(smallIn - smallOut).toFixed(2),
    };
  } catch {
    return null;
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

    // 获取资讯 + 资金流向（并行）
    const [news, moneyFlow] = await Promise.all([
      fetchNews(quote.name),
      fetchMoneyFlow(normalized),
    ]);

    // 分析
    const result = analyzeStock(quote, dailyKlines, news);

    // 计算全序列指标（给图表用）
    const indicatorSeries = calculateIndicatorSeries(dailyKlines);

    // 历史回测（用日线数据）
    const backtest = runBacktest(dailyKlines);

    return NextResponse.json({
      ...result,
      dailyKlines,
      min5Klines,
      indicatorSeries,
      moneyFlow,
      backtest,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '分析失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
