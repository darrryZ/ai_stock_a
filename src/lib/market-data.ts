// 行情数据获取 — 新浪财经 + 东方财富

import { StockQuote, KlineItem, normalizeCode } from '@/types/stock';

const SINA_HQ_URL = 'https://hq.sinajs.cn/list=';
const EAST_KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';

// ============ 实时报价 ============

export async function getQuote(rawCode: string): Promise<StockQuote> {
  const code = normalizeCode(rawCode);
  const res = await fetch(`${SINA_HQ_URL}${code}`, {
    headers: { Referer: 'https://finance.sina.com.cn' },
    next: { revalidate: 0 },
  });
  const text = await res.text();
  return parseSinaQuote(code, text);
}

function parseSinaQuote(code: string, raw: string): StockQuote {
  // 格式: var hq_str_sh600519="贵州茅台,1800.00,1795.00,..."
  const match = raw.match(/"(.+)"/);
  if (!match) throw new Error(`无法解析行情数据: ${code}`);

  const parts = match[1].split(',');
  const name = parts[0];
  const open = parseFloat(parts[1]);
  const close = parseFloat(parts[2]); // 昨收
  const price = parseFloat(parts[3]);
  const high = parseFloat(parts[4]);
  const low = parseFloat(parts[5]);
  const volume = parseFloat(parts[8]) / 100; // 股→手
  const amount = parseFloat(parts[9]) / 10000; // 元→万元

  return {
    code,
    name,
    price,
    open,
    close,
    high,
    low,
    volume,
    amount,
    change: +(price - close).toFixed(2),
    changePercent: +(((price - close) / close) * 100).toFixed(2),
    turnover: 0, // 需要额外接口
    time: `${parts[30]} ${parts[31]}`,
  };
}

// ============ K线数据（东方财富）============

// 东财市场代码映射
function toEastCode(code: string): { secid: string } {
  const norm = normalizeCode(code);
  if (norm.startsWith('sh')) return { secid: `1.${norm.slice(2)}` };
  if (norm.startsWith('sz')) return { secid: `0.${norm.slice(2)}` };
  if (norm.startsWith('bj')) return { secid: `0.${norm.slice(2)}` };
  return { secid: `1.${norm}` };
}

export type KlinePeriod = 'daily' | '5min';

const PERIOD_MAP: Record<KlinePeriod, string> = {
  daily: '101',   // 日线
  '5min': '5',    // 5分钟
};

export async function getKlines(
  rawCode: string,
  period: KlinePeriod = 'daily',
  limit: number = 120,
): Promise<KlineItem[]> {
  const { secid } = toEastCode(rawCode);
  const klt = PERIOD_MAP[period];

  const params = new URLSearchParams({
    secid,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57',
    klt,
    fqt: '1', // 前复权
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
