// 信号分析引擎 — 多指标交叉验证 → 输出信号 + 建议

import { KlineItem, TechnicalIndicators, AnalysisResult, StockQuote, NewsItem } from '@/types/stock';
import { calculateIndicators } from './indicators';

type Signal = 'bullish' | 'bearish' | 'neutral';

interface SignalScore {
  score: number; // -100 ~ +100
  details: string[];
}

// ============ 第一层：趋势判断 ============

function analyzeTrend(ind: TechnicalIndicators, quote: StockQuote): SignalScore {
  let score = 0;
  const details: string[] = [];

  // MA 排列
  const { ma5, ma10, ma20, ma60 } = ind.ma;
  if (ma5 > ma10 && ma10 > ma20 && ma20 > ma60) {
    score += 25;
    details.push('📈 均线多头排列，上升趋势确认');
  } else if (ma5 < ma10 && ma10 < ma20 && ma20 < ma60) {
    score -= 25;
    details.push('📉 均线空头排列，下降趋势确认');
  } else {
    details.push('〰️ 均线交织，趋势不明朗');
  }

  // 价格相对 MA20
  if (quote.price > ma20) {
    score += 10;
    details.push(`价格在MA20(${ma20})上方，中期偏强`);
  } else {
    score -= 10;
    details.push(`价格在MA20(${ma20})下方，中期偏弱`);
  }

  // MACD
  const { dif, dea, histogram } = ind.macd;
  if (dif > dea && histogram > 0) {
    score += 20;
    details.push('MACD金叉，动量向上');
  } else if (dif < dea && histogram < 0) {
    score -= 20;
    details.push('MACD死叉，动量向下');
  }

  // MACD 柱状图趋势（缩放）
  if (histogram > 0 && dif > 0) {
    score += 5;
  } else if (histogram < 0 && dif < 0) {
    score -= 5;
  }

  // 布林带位置
  const { upper, lower, middle } = ind.boll;
  if (!isNaN(upper)) {
    if (quote.price >= upper) {
      score -= 10;
      details.push(`触及布林上轨(${upper})，短期超热`);
    } else if (quote.price <= lower) {
      score += 10;
      details.push(`触及布林下轨(${lower})，可能超卖`);
    } else if (quote.price > middle) {
      score += 5;
      details.push('价格在布林中轨上方，偏强');
    }
  }

  return { score, details };
}

// ============ 第二层：买卖时机 ============

function analyzeTiming(ind: TechnicalIndicators): SignalScore {
  let score = 0;
  const details: string[] = [];

  // RSI
  const { rsi6 } = ind.rsi;
  if (rsi6 > 80) {
    score -= 15;
    details.push(`⚠️ RSI6=${rsi6}，严重超买`);
  } else if (rsi6 > 70) {
    score -= 10;
    details.push(`RSI6=${rsi6}，进入超买区间`);
  } else if (rsi6 < 20) {
    score += 15;
    details.push(`RSI6=${rsi6}，严重超卖，可能反弹`);
  } else if (rsi6 < 30) {
    score += 10;
    details.push(`RSI6=${rsi6}，进入超卖区间`);
  } else {
    details.push(`RSI6=${rsi6}，处于正常区间`);
  }

  // KDJ
  const { k, d, j } = ind.kdj;
  if (j > 100) {
    score -= 10;
    details.push(`KDJ J值=${j}，极度超买`);
  } else if (j < 0) {
    score += 10;
    details.push(`KDJ J值=${j}，极度超卖`);
  }
  if (k > d && j > 0) {
    score += 5;
    details.push('KDJ金叉');
  } else if (k < d && j < 100) {
    score -= 5;
    details.push('KDJ死叉');
  }

  // 量比
  if (ind.volumeRatio !== undefined) {
    if (ind.volumeRatio > 3) {
      details.push(`📊 量比=${ind.volumeRatio}，成交异常放大`);
      // 放量方向跟随趋势加分
    } else if (ind.volumeRatio > 1.5) {
      details.push(`📊 量比=${ind.volumeRatio}，温和放量`);
    } else if (ind.volumeRatio < 0.5) {
      details.push(`📊 量比=${ind.volumeRatio}，明显缩量`);
    }
  }

  // 背离信号
  if (ind.divergence) {
    if (ind.divergence.macd === 'top') {
      score -= 15;
    } else if (ind.divergence.macd === 'bottom') {
      score += 15;
    }
    if (ind.divergence.rsi === 'top') {
      score -= 10;
    } else if (ind.divergence.rsi === 'bottom') {
      score += 10;
    }
    details.push(...ind.divergence.description);
  }

  return { score, details };
}

// ============ 第二点五层：量价验证 ============

function analyzeVolume(ind: TechnicalIndicators, quote: StockQuote): SignalScore {
  let score = 0;
  const details: string[] = [];

  const vr = ind.volumeRatio ?? 1;

  // 涨 + 放量 = 强势确认
  if (quote.changePercent > 1 && vr > 1.5) {
    score += 10;
    details.push('上涨放量，多头力量充足');
  }
  // 涨 + 缩量 = 上涨乏力
  if (quote.changePercent > 1 && vr < 0.7) {
    score -= 5;
    details.push('上涨缩量，追高需谨慎');
  }
  // 跌 + 放量 = 恐慌
  if (quote.changePercent < -1 && vr > 2) {
    score -= 15;
    details.push('下跌放量，空头主导');
  }
  // 跌 + 缩量 = 惜售
  if (quote.changePercent < -1 && vr < 0.7) {
    score += 5;
    details.push('下跌缩量，抛压减轻');
  }

  return { score, details };
}

// ============ 第三层：风险控制 ============

function analyzeRisk(ind: TechnicalIndicators, quote: StockQuote): {
  stopLoss: number;
  takeProfit: number;
  details: string[];
} {
  const details: string[] = [];
  const atr = ind.atr;

  // 基于 ATR 的止损止盈
  let stopLoss: number;
  let takeProfit: number;

  if (!isNaN(atr) && atr > 0) {
    stopLoss = +(quote.price - 2 * atr).toFixed(2);
    takeProfit = +(quote.price + 3 * atr).toFixed(2);
    details.push(`ATR=${atr}，建议止损位: ${stopLoss}，止盈位: ${takeProfit}`);
  } else {
    // 回退：用3%止损，5%止盈
    stopLoss = +(quote.price * 0.97).toFixed(2);
    takeProfit = +(quote.price * 1.05).toFixed(2);
    details.push(`建议止损位: ${stopLoss}(-3%)，止盈位: ${takeProfit}(+5%)`);
  }

  return { stopLoss, takeProfit, details };
}

// ============ 综合信号 ============

function deriveSignal(totalScore: number): Signal {
  if (totalScore >= 20) return 'bullish';
  if (totalScore <= -20) return 'bearish';
  return 'neutral';
}

function generateSummary(signal: Signal, trendDetails: string[], timingDetails: string[], riskDetails: string[]): string {
  const allDetails = [...trendDetails, ...timingDetails, ...riskDetails];
  const header = signal === 'bullish' ? '🟢 偏多信号' : signal === 'bearish' ? '🔴 偏空信号' : '🟡 观望信号';
  return `${header}\n\n${allDetails.join('\n')}`;
}

function generateSuggestion(signal: Signal, stopLoss: number, takeProfit: number): string {
  switch (signal) {
    case 'bullish':
      return `看多，可考虑逢低布局。止损: ${stopLoss}，目标: ${takeProfit}。注意仓位控制，建议不超过总仓位30%。`;
    case 'bearish':
      return `看空，建议观望或减仓。若持有，建议在${stopLoss}以下严格止损。不建议此时追涨。`;
    case 'neutral':
      return `方向不明，建议观望等待信号明确。若持有可继续持有，但设好止损${stopLoss}。不建议加仓。`;
  }
}

// ============ 主入口 ============

export function analyzeStock(
  quote: StockQuote,
  klines: KlineItem[],
  news: NewsItem[] = [],
): AnalysisResult {
  const indicators = calculateIndicators(klines);

  const trend = analyzeTrend(indicators, quote);
  const timing = analyzeTiming(indicators);
  const volume = analyzeVolume(indicators, quote);
  const risk = analyzeRisk(indicators, quote);

  const totalScore = trend.score + timing.score + volume.score;
  const signal = deriveSignal(totalScore);

  return {
    quote,
    indicators,
    klines,
    signal,
    summary: generateSummary(signal, trend.details, timing.details, [...volume.details, ...risk.details]),
    suggestion: generateSuggestion(signal, risk.stopLoss, risk.takeProfit),
    stopLoss: risk.stopLoss,
    takeProfit: risk.takeProfit,
    news,
  };
}
