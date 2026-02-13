// 股票行情数据类型定义

export interface StockQuote {
  code: string;          // 股票代码 如 sh600519
  name: string;          // 股票名称
  price: number;         // 当前价
  open: number;          // 开盘价
  close: number;         // 昨收
  high: number;          // 最高
  low: number;           // 最低
  volume: number;        // 成交量（手）
  amount: number;        // 成交额（万元）
  change: number;        // 涨跌额
  changePercent: number; // 涨跌幅 %
  turnover: number;      // 换手率 %
  time: string;          // 数据时间
}

export interface KlineItem {
  date: string;          // 日期/时间
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
}

export interface TechnicalIndicators {
  ma: { ma5: number; ma10: number; ma20: number; ma60: number; ma120: number };
  macd: { dif: number; dea: number; histogram: number };
  rsi: { rsi6: number; rsi12: number; rsi24: number };
  kdj: { k: number; d: number; j: number };
  boll: { upper: number; middle: number; lower: number };
  atr: number;
  obv?: number;                 // 量价指标
  volumeRatio?: number;         // 量比
  divergence?: DivergenceInfo;  // 背离信息
}

export interface DivergenceInfo {
  macd?: 'top' | 'bottom' | null;   // MACD 顶/底背离
  rsi?: 'top' | 'bottom' | null;
  description: string[];
}

export interface AnalysisResult {
  quote: StockQuote;
  indicators: TechnicalIndicators;
  klines: KlineItem[];
  signal: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  suggestion: string;
  stopLoss?: number;
  takeProfit?: number;
  news: NewsItem[];
  moneyFlow?: MoneyFlow;      // 资金流向
  backtest?: BacktestResult;  // 历史回测
}

export interface MoneyFlow {
  mainInflow: number;     // 主力流入（万元）
  mainOutflow: number;    // 主力流出（万元）
  mainNet: number;        // 主力净流入（万元）
  retailInflow: number;   // 散户流入
  retailOutflow: number;  // 散户流出
  retailNet: number;      // 散户净流入
  superLargeNet: number;  // 超大单净流入
  largeNet: number;       // 大单净流入
  mediumNet: number;      // 中单净流入
  smallNet: number;       // 小单净流入
}

export interface BacktestResult {
  totalTrades: number;    // 总交易次数
  winTrades: number;      // 盈利次数
  loseTrades: number;     // 亏损次数
  winRate: number;        // 胜率 %
  totalReturn: number;    // 总收益 %
  maxDrawdown: number;    // 最大回撤 %
  sharpeRatio: number;    // 夏普比率（简化）
  avgReturn: number;      // 平均每笔收益 %
  trades: BacktestTrade[];
}

export interface BacktestTrade {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  returnPct: number;     // 收益率 %
  signal: string;        // 触发信号
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  time: string;
  summary?: string;
}

// 标准化股票代码：补全市场前缀
export function normalizeCode(input: string): string {
  const code = input.trim().replace(/\s+/g, '');
  // 已有前缀
  if (/^(sh|sz|bj)\d{6}$/i.test(code)) return code.toLowerCase();
  // 纯数字
  if (/^\d{6}$/.test(code)) {
    if (code.startsWith('6')) return `sh${code}`;
    if (code.startsWith('0') || code.startsWith('3')) return `sz${code}`;
    if (code.startsWith('4') || code.startsWith('8')) return `bj${code}`;
    // ETF/LOF
    if (code.startsWith('5')) return `sh${code}`;
    if (code.startsWith('1')) return `sz${code}`;
  }
  return code.toLowerCase();
}
