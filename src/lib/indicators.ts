// 技术分析引擎 — MACD / RSI / KDJ / BOLL / MA / ATR

import { KlineItem, TechnicalIndicators } from '@/types/stock';

// ============ 移动平均线 ============

function calcMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(+(sum / period).toFixed(2));
    }
  }
  return result;
}

// ============ EMA ============

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(+(data[i] * k + result[i - 1] * (1 - k)).toFixed(4));
  }
  return result;
}

// ============ MACD ============

interface MACDResult {
  dif: number[];
  dea: number[];
  histogram: number[];
}

function calcMACD(closes: number[], short = 12, long = 26, signal = 9): MACDResult {
  const emaShort = calcEMA(closes, short);
  const emaLong = calcEMA(closes, long);
  const dif = emaShort.map((v, i) => +(v - emaLong[i]).toFixed(4));
  const dea = calcEMA(dif, signal);
  const histogram = dif.map((v, i) => +((v - dea[i]) * 2).toFixed(4));
  return { dif, dea, histogram };
}

// ============ RSI ============

function calcRSI(closes: number[], period: number): number[] {
  const result: number[] = [NaN];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      if (i < period) {
        result.push(NaN);
      } else {
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(+(100 - 100 / (1 + rs)).toFixed(2));
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(+(100 - 100 / (1 + rs)).toFixed(2));
    }
  }
  return result;
}

// ============ KDJ ============

interface KDJResult {
  k: number[];
  d: number[];
  j: number[];
}

function calcKDJ(klines: KlineItem[], period = 9): KDJResult {
  const kArr: number[] = [];
  const dArr: number[] = [];
  const jArr: number[] = [];

  let prevK = 50;
  let prevD = 50;

  for (let i = 0; i < klines.length; i++) {
    const start = Math.max(0, i - period + 1);
    const window = klines.slice(start, i + 1);
    const highest = Math.max(...window.map((k) => k.high));
    const lowest = Math.min(...window.map((k) => k.low));
    const rsv = highest === lowest ? 50 : ((klines[i].close - lowest) / (highest - lowest)) * 100;

    const k = +(2 / 3 * prevK + 1 / 3 * rsv).toFixed(2);
    const d = +(2 / 3 * prevD + 1 / 3 * k).toFixed(2);
    const j = +(3 * k - 2 * d).toFixed(2);

    kArr.push(k);
    dArr.push(d);
    jArr.push(j);

    prevK = k;
    prevD = d;
  }
  return { k: kArr, d: dArr, j: jArr };
}

// ============ 布林带 ============

interface BOLLResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

function calcBOLL(closes: number[], period = 20, multiplier = 2): BOLLResult {
  const middle = calcMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const std = Math.sqrt(slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period);
      upper.push(+(mean + multiplier * std).toFixed(2));
      lower.push(+(mean - multiplier * std).toFixed(2));
    }
  }
  return { upper, middle, lower };
}

// ============ ATR（真实波幅）============

function calcATR(klines: KlineItem[], period = 14): number[] {
  const tr: number[] = [klines[0].high - klines[0].low];

  for (let i = 1; i < klines.length; i++) {
    const h = klines[i].high;
    const l = klines[i].low;
    const pc = klines[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }

  const atr: number[] = [];
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) {
      atr.push(NaN);
    } else if (i === period - 1) {
      atr.push(+(tr.slice(0, period).reduce((a, b) => a + b, 0) / period).toFixed(2));
    } else {
      atr.push(+((atr[i - 1] * (period - 1) + tr[i]) / period).toFixed(2));
    }
  }
  return atr;
}

// ============ 综合计算 ============

export function calculateIndicators(klines: KlineItem[]): TechnicalIndicators {
  const closes = klines.map((k) => k.close);
  const last = klines.length - 1;

  const ma5 = calcMA(closes, 5);
  const ma10 = calcMA(closes, 10);
  const ma20 = calcMA(closes, 20);
  const ma60 = calcMA(closes, 60);
  const ma120 = calcMA(closes, 120);

  const macd = calcMACD(closes);
  const rsi6 = calcRSI(closes, 6);
  const rsi12 = calcRSI(closes, 12);
  const rsi24 = calcRSI(closes, 24);
  const kdj = calcKDJ(klines);
  const boll = calcBOLL(closes);
  const atr = calcATR(klines);

  return {
    ma: {
      ma5: ma5[last],
      ma10: ma10[last],
      ma20: ma20[last],
      ma60: ma60[last],
      ma120: ma120[last],
    },
    macd: {
      dif: macd.dif[last],
      dea: macd.dea[last],
      histogram: macd.histogram[last],
    },
    rsi: {
      rsi6: rsi6[last],
      rsi12: rsi12[last],
      rsi24: rsi24[last],
    },
    kdj: {
      k: kdj.k[last],
      d: kdj.d[last],
      j: kdj.j[last],
    },
    boll: {
      upper: boll.upper[last],
      middle: boll.middle[last],
      lower: boll.lower[last],
    },
    atr: atr[last],
  };
}

// ============ 导出全序列（给图表用）============

export function calculateIndicatorSeries(klines: KlineItem[]) {
  const closes = klines.map((k) => k.close);
  return {
    ma5: calcMA(closes, 5),
    ma10: calcMA(closes, 10),
    ma20: calcMA(closes, 20),
    ma60: calcMA(closes, 60),
    macd: calcMACD(closes),
    rsi6: calcRSI(closes, 6),
    rsi12: calcRSI(closes, 12),
    kdj: calcKDJ(klines),
    boll: calcBOLL(closes),
    atr: calcATR(klines),
  };
}
