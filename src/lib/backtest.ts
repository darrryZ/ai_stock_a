// 历史回测引擎 — 用当前策略信号回测历史表现

import { KlineItem, BacktestResult, BacktestTrade, TechnicalIndicators } from '@/types/stock';

interface BacktestConfig {
  stopLossPct: number;    // 止损比例（如 0.05 = 5%）
  takeProfitPct: number;  // 止盈比例
  holdDays: number;       // 最大持仓天数
}

const DEFAULT_CONFIG: BacktestConfig = {
  stopLossPct: 0.05,
  takeProfitPct: 0.08,
  holdDays: 20,
};

// 简化版指标计算（用于回测每一天的信号判断）
function calcSimpleSignal(
  closes: number[],
  volumes: number[],
  idx: number,
): 'buy' | 'sell' | 'hold' {
  if (idx < 26) return 'hold'; // 数据不足

  // MA
  const ma5 = avg(closes, idx, 5);
  const ma10 = avg(closes, idx, 10);
  const ma20 = avg(closes, idx, 20);

  // EMA for MACD
  const ema12 = calcEmaAt(closes, 12, idx);
  const ema26 = calcEmaAt(closes, 26, idx);
  const dif = ema12 - ema26;
  const prevDif = calcEmaAt(closes, 12, idx - 1) - calcEmaAt(closes, 26, idx - 1);

  // RSI
  const rsi = calcRsiAt(closes, 6, idx);

  // 量比
  const volAvg5 = avg(volumes, idx - 1, 5);
  const volRatio = volAvg5 > 0 ? volumes[idx] / volAvg5 : 1;

  let score = 0;

  // MA 排列
  if (ma5 > ma10 && ma10 > ma20) score += 20;
  if (ma5 < ma10 && ma10 < ma20) score -= 20;

  // 价格在 MA20 上下
  if (closes[idx] > ma20) score += 5;
  else score -= 5;

  // MACD 金叉/死叉
  if (dif > 0 && prevDif <= 0) score += 15;
  if (dif < 0 && prevDif >= 0) score -= 15;

  // RSI
  if (rsi > 80) score -= 10;
  else if (rsi < 20) score += 10;

  // 量价配合
  const change = (closes[idx] - closes[idx - 1]) / closes[idx - 1];
  if (change > 0.01 && volRatio > 1.5) score += 10;
  if (change < -0.01 && volRatio > 2) score -= 10;

  if (score >= 25) return 'buy';
  if (score <= -25) return 'sell';
  return 'hold';
}

function avg(data: number[], endIdx: number, period: number): number {
  const start = Math.max(0, endIdx - period + 1);
  const slice = data.slice(start, endIdx + 1);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function calcEmaAt(data: number[], period: number, endIdx: number): number {
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i <= endIdx; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRsiAt(closes: number[], period: number, endIdx: number): number {
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= endIdx; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
  }
  if (avgLoss === 0) return 100;
  return +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2);
}

export function runBacktest(
  klines: KlineItem[],
  config: BacktestConfig = DEFAULT_CONFIG,
): BacktestResult {
  const closes = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);
  const trades: BacktestTrade[] = [];

  let inPosition = false;
  let buyPrice = 0;
  let buyDate = '';
  let buySignal = '';
  let holdCount = 0;

  for (let i = 30; i < klines.length; i++) {
    if (!inPosition) {
      const signal = calcSimpleSignal(closes, volumes, i);
      if (signal === 'buy') {
        inPosition = true;
        buyPrice = closes[i];
        buyDate = klines[i].date;
        buySignal = 'MA多头+MACD金叉';
        holdCount = 0;
      }
    } else {
      holdCount++;
      const returnPct = (closes[i] - buyPrice) / buyPrice;

      // 止损
      if (returnPct <= -config.stopLossPct) {
        trades.push({
          buyDate,
          buyPrice: +buyPrice.toFixed(2),
          sellDate: klines[i].date,
          sellPrice: +closes[i].toFixed(2),
          returnPct: +(returnPct * 100).toFixed(2),
          signal: buySignal + ' → 止损',
        });
        inPosition = false;
        continue;
      }

      // 止盈
      if (returnPct >= config.takeProfitPct) {
        trades.push({
          buyDate,
          buyPrice: +buyPrice.toFixed(2),
          sellDate: klines[i].date,
          sellPrice: +closes[i].toFixed(2),
          returnPct: +(returnPct * 100).toFixed(2),
          signal: buySignal + ' → 止盈',
        });
        inPosition = false;
        continue;
      }

      // 到期或卖出信号
      const signal = calcSimpleSignal(closes, volumes, i);
      if (signal === 'sell' || holdCount >= config.holdDays) {
        trades.push({
          buyDate,
          buyPrice: +buyPrice.toFixed(2),
          sellDate: klines[i].date,
          sellPrice: +closes[i].toFixed(2),
          returnPct: +(returnPct * 100).toFixed(2),
          signal: buySignal + (holdCount >= config.holdDays ? ' → 到期' : ' → 卖出信号'),
        });
        inPosition = false;
      }
    }
  }

  // 统计
  const winTrades = trades.filter((t) => t.returnPct > 0).length;
  const loseTrades = trades.filter((t) => t.returnPct <= 0).length;
  const totalReturn = trades.reduce((s, t) => s + t.returnPct, 0);
  const avgReturn = trades.length > 0 ? +(totalReturn / trades.length).toFixed(2) : 0;

  // 最大回撤
  let peak = 1;
  let maxDD = 0;
  let equity = 1;
  for (const t of trades) {
    equity *= (1 + t.returnPct / 100);
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // 简化夏普比率
  const returns = trades.map((t) => t.returnPct);
  const meanR = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdR = returns.length > 1
    ? Math.sqrt(returns.reduce((s, r) => s + (r - meanR) ** 2, 0) / (returns.length - 1))
    : 1;
  const sharpeRatio = stdR > 0 ? +(meanR / stdR).toFixed(2) : 0;

  return {
    totalTrades: trades.length,
    winTrades,
    loseTrades,
    winRate: trades.length > 0 ? +(winTrades / trades.length * 100).toFixed(1) : 0,
    totalReturn: +totalReturn.toFixed(2),
    maxDrawdown: +(maxDD * 100).toFixed(2),
    sharpeRatio,
    avgReturn,
    trades: trades.slice(-10), // 只返回最近 10 笔
  };
}
