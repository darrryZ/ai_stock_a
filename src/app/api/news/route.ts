// GET /api/news?code=600519&name=贵州茅台
// 从东方财富获取个股资讯

import { NextRequest, NextResponse } from 'next/server';
import { normalizeCode } from '@/types/stock';
import type { NewsItem } from '@/types/stock';

const EAST_NEWS_URL = 'https://search-api-web.eastmoney.com/search/jsonp';

// 东方财富个股新闻
async function fetchEastNews(keyword: string): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    cb: 'cb',
    param: JSON.stringify({
      uid: '',
      keyword,
      type: ['cmsArticleWebOld'],
      client: 'web',
      clientType: 'web',
      clientVersion: 'curr',
      param: { cmsArticleWebOld: { searchScope: 'default', sort: 'default', pageIndex: 1, pageSize: 8 } },
    }),
  });

  try {
    const res = await fetch(`${EAST_NEWS_URL}?${params}`, {
      headers: { Referer: 'https://so.eastmoney.com' },
      next: { revalidate: 300 }, // 5分钟缓存
    });

    const text = await res.text();
    // 去掉 JSONP 包裹: cb(...)
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

// 备用：新浪财经新闻
async function fetchSinaNews(code: string): Promise<NewsItem[]> {
  const norm = normalizeCode(code);
  const symbol = norm.replace(/^(sh|sz|bj)/, '');
  const market = norm.startsWith('sh') ? 'sh' : 'sz';

  try {
    const res = await fetch(
      `https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllNewsStock/symbol/${market}${symbol}.phtml`,
      { next: { revalidate: 300 } },
    );
    const html = await res.text();

    const items: NewsItem[] = [];
    const regex = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>\s*(\d{4}-\d{2}-\d{2})?/g;
    let match;
    let count = 0;
    while ((match = regex.exec(html)) !== null && count < 8) {
      if (match[2].length > 5) {
        items.push({
          title: match[2].trim(),
          url: match[1].startsWith('http') ? match[1] : `https:${match[1]}`,
          source: '新浪财经',
          time: match[3] || '',
        });
        count++;
      }
    }
    return items;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') || '';
  const name = req.nextUrl.searchParams.get('name') || '';

  if (!code && !name) {
    return NextResponse.json({ error: '请提供股票代码或名称' }, { status: 400 });
  }

  const keyword = name || code;

  // 并行抓取多个源
  const [eastNews, sinaNews] = await Promise.all([
    fetchEastNews(keyword),
    fetchSinaNews(code),
  ]);

  // 合并去重
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of [...eastNews, ...sinaNews]) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      merged.push(item);
    }
  }

  return NextResponse.json({ news: merged.slice(0, 12) });
}
