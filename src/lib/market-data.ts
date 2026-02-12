// 行情数据获取 — 东方财富（UTF-8，无编码问题）

import { StockQuote, KlineItem, normalizeCode } from '@/types/stock';

const EAST_QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get';
const EAST_KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';

// 东财市场代码映射
function toEastSecid(code: string): string {
  const norm = normalizeCode(code);
  if (norm.startsWith('sh')) return `1.${norm.slice(2)}`;
  if (norm.startsWith('sz')) return `0.${norm.slice(2)}`;
  if (norm.startsWith('bj')) return `0.${norm.slice(2)}`;
  return `1.${norm}`;
}

// ============ 实时报价（东方财富） ============

export async function getQuote(rawCode: string): Promise<StockQuote> {
  const code = normalizeCode(rawCode);
  const secid = toEastSecid(code);

  const params = new URLSearchParams({
    secid,
    fields: 'f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f60,f168,f170,f171',
    ut: 'fa5fd1943c7b386f172d6893dbfba10b',
    _: String(Date.now()),
  });

  const res = await fetch(`${EAST_QUOTE_URL}?${params}`, {
    headers: { Referer: 'https://quote.eastmoney.com' },
    next: { revalidate: 0 },
  });

  const json = await res.json();
  const d = json?.data;
  if (!d) throw new Error(`无法获取行情数据: ${rawCode}`);

  // 东财价格字段单位是"分"或"角"，需要根据小数位处理
  const decimal = d.f59 ?? 2; // 小数位数
  const divisor = Math.pow(10, decimal);

  const price = d.f43 / divisor;
  const open = d.f44 / divisor;
  const high = d.f45 / divisor;
  const low = d.f46 / divisor;
  const close = d.f60 / divisor; // 昨收
  const volume = d.f47 / 100; // 手
  const amount = d.f48 / 10000; // 万元
  const changePercent = d.f170 / 100;
  const change = d.f171 / divisor;
  const turnover = d.f168 / 100; // 换手率

  return {
    code,
    name: d.f58 || d.f57 || rawCode,
    price,
    open,
    close,
    high,
    low,
    volume,
    amount,
    change: +change.toFixed(decimal),
    changePercent: +changePercent.toFixed(2),
    turnover: +turnover.toFixed(2),
    time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  };
}

// ============ K线数据（东方财富） ============

export type KlinePeriod = 'daily' | '5min';

const PERIOD_MAP: Record<KlinePeriod, string> = {
  daily: '101',
  '5min': '5',
};

export async function getKlines(
  rawCode: string,
  period: KlinePeriod = 'daily',
  limit: number = 120,
): Promise<KlineItem[]> {
  const secid = toEastSecid(rawCode);
  const klt = PERIOD_MAP[period];

  const params = new URLSearchParams({
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57',
    klt,
    fqt: '1',
    lmt: String(limit),
    end: '20500101',
    _: String(Date.now()),
  });

  const res = await fetch(`${EAST_KLINE_URL}?${params}`, {
    headers: { Referer: 'https://quote.eastmoney.com' },
    next: { revalidate: 0 },
  });

  const json = await res.json();
  if (!json.data?.klines) throw new Error(`无法获取K线数据: ${rawCode}`);

  return json.data.klines.map((line: string) => {
    const [date, open, close, high, low, volume, amount] = line.split(',');
    return {
      date,
      open: parseFloat(open),
      close: parseFloat(close),
      high: parseFloat(high),
      low: parseFloat(low),
      volume: parseFloat(volume),
      amount: parseFloat(amount),
    };
  });
}
