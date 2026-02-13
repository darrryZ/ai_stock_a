'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { AnalysisResult, KlineItem, NewsItem } from '@/types/stock';
import { IconSearch, IconChart, IconTrendUp, IconTrendDown, IconMinus, IconShield, IconTarget, IconNews, IconExternalLink, IconBarChart, IconSwap, IconCandlestick, IconActivity, IconStar, IconStarFilled, IconTrash, IconFire } from '@/components/Icons';
import { useWatchlist } from '@/hooks/useWatchlist';

const KlineChart = dynamic(() => import('@/components/KlineChart'), { ssr: false });

interface FullAnalysis extends AnalysisResult {
  dailyKlines: KlineItem[];
  min5Klines: KlineItem[];
  indicatorSeries: {
    ma5: number[];
    ma10: number[];
    ma20: number[];
    ma60: number[];
    macd: { dif: number[]; dea: number[]; histogram: number[] };
    boll: { upper: number[]; middle: number[]; lower: number[] };
  };
}

interface SearchResult {
  code: string;
  name: string;
  market: string;
  type: string;
}

interface IndexQuote {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  amount: number;
}

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullAnalysis | null>(null);
  const [error, setError] = useState('');
  const [chartType, setChartType] = useState<'daily' | '5min'>('daily');

  // 搜索建议
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 大盘数据
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [marketTime, setMarketTime] = useState('');
  const [marketLoading, setMarketLoading] = useState(true);

  // 自选股
  const { watchlist, loaded: watchlistLoaded, isInWatchlist, toggleStock, removeStock } = useWatchlist();
  const [watchlistQuotes, setWatchlistQuotes] = useState<Record<string, { price: number; changePercent: number; change: number }>>({});

  // 热点板块
  interface SectorItem { code: string; name: string; price: number; changePercent: number; change: number; }
  const [sectorGainers, setSectorGainers] = useState<SectorItem[]>([]);
  const [sectorLosers, setSectorLosers] = useState<SectorItem[]>([]);
  const [sectorTab, setSectorTab] = useState<'gainers' | 'losers'>('gainers');

  // 获取大盘数据 + 热点板块
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const [marketRes, sectorRes] = await Promise.all([
          fetch('/api/market-overview'),
          fetch('/api/hot-sectors'),
        ]);
        const marketData = await marketRes.json();
        if (marketData.indices) {
          setIndices(marketData.indices);
          setMarketTime(marketData.time);
        }
        const sectorData = await sectorRes.json();
        if (sectorData.gainers) setSectorGainers(sectorData.gainers);
        if (sectorData.losers) setSectorLosers(sectorData.losers);
      } catch { /* ignore */ }
      finally { setMarketLoading(false); }
    };
    fetchMarket();
    const timer = setInterval(fetchMarket, 30000); // 30秒刷新
    return () => clearInterval(timer);
  }, []);

  // 自选股行情刷新（批量接口）
  useEffect(() => {
    if (!watchlistLoaded || watchlist.length === 0) return;
    const fetchWatchlistQuotes = async () => {
      try {
        const codes = watchlist.map((item) => item.code).join(',');
        const res = await fetch(`/api/batch-quote?codes=${codes}`);
        const data = await res.json();
        if (data.quotes) {
          setWatchlistQuotes(data.quotes);
        }
      } catch { /* ignore */ }
    };
    fetchWatchlistQuotes();
    const timer = setInterval(fetchWatchlistQuotes, 30000);
    return () => clearInterval(timer);
  }, [watchlist, watchlistLoaded]);

  // 搜索建议 — 防抖
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(data.results || []);
      setShowSuggestions((data.results || []).length > 0);
      setSelectedIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setCode(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => fetchSuggestions(value.trim()), 300);
  };

  const handleSelectSuggestion = (item: SearchResult) => {
    setCode(item.code);
    setShowSuggestions(false);
    setSuggestions([]);
    handleAnalyze(item.code);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') handleAnalyze();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[selectedIndex]);
      } else {
        setShowSuggestions(false);
        handleAnalyze();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // 点击外部关闭建议
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAnalyze = async (inputCode?: string) => {
    let input = (inputCode || code).trim();
    if (!input) return;
    setLoading(true);
    setError('');
    setResult(null);
    setShowSuggestions(false);

    try {
      // 如果不是纯股票代码格式，先搜索拿到代码
      const isCode = /^(sh|sz|bj)?\d{6}$/i.test(input);
      if (!isCode) {
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(input)}`);
        const searchData = await searchRes.json();
        const results = searchData.results || [];
        if (results.length === 0) {
          setError(`未找到"${input}"相关股票`);
          setLoading(false);
          return;
        }
        // 取第一个匹配结果
        input = results[0].code;
        setCode(input);
      }

      const res = await fetch(`/api/analyze?code=${encodeURIComponent(input)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError('请求失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const goToDetail = () => {
    if (result) {
      router.push(`/stock/${result.quote.code}`);
    }
  };

  const SignalIcon = ({ signal }: { signal: string }) => {
    if (signal === 'bullish') return <IconTrendUp size={20} className="text-green-400" />;
    if (signal === 'bearish') return <IconTrendDown size={20} className="text-red-400" />;
    return <IconMinus size={20} className="text-yellow-400" />;
  };

  const signalColor = (s: string) =>
    s === 'bullish' ? 'text-green-400' : s === 'bearish' ? 'text-red-400' : 'text-yellow-400';
  const signalBorder = (s: string) =>
    s === 'bullish' ? 'border-green-500/20' : s === 'bearish' ? 'border-red-500/20' : 'border-yellow-500/20';
  const signalText = (s: string) =>
    s === 'bullish' ? '看多' : s === 'bearish' ? '看空' : '观望';
  const priceColor = (v: number) => (v >= 0 ? 'text-red-400' : 'text-green-400');

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8 bg-grid min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-10 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <IconChart size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">A股分析助手</h1>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">实时行情 · 技术分析 · 操作建议</p>
          </div>
        </div>
        <span className="text-[10px] sm:text-xs text-[var(--text-muted)] hidden sm:block">数据来源：东方财富</span>
      </div>

      {/* 搜索栏 */}
      <div className="relative mb-8 sm:mb-10 animate-fade-in-up delay-1">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="输入股票代码、名称或拼音首字母"
              className="input w-full pl-11 pr-4 py-3 sm:py-3.5 text-base sm:text-lg"
            />
            {/* 搜索建议下拉 */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-2 card p-1.5 z-50 max-h-80 overflow-y-auto"
              >
                {suggestions.map((item, i) => (
                  <button
                    key={item.code}
                    onClick={() => handleSelectSuggestion(item)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-colors ${
                      i === selectedIndex
                        ? 'bg-blue-500/15 text-blue-300'
                        : 'hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-sm text-blue-400 shrink-0">{item.code.replace(/^(sh|sz|bj)/, '')}</span>
                      <span className="text-sm truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-default)]">{item.market}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{item.type}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => handleAnalyze()}
            disabled={loading}
            className="btn-primary px-6 sm:px-8 py-3 sm:py-3.5 text-base sm:text-lg flex items-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <IconSearch size={18} />
                <span className="hidden sm:inline">分析</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="card p-4 mb-6 border-red-500/20 animate-fade-in-up">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* 分析结果 */}
      {result && (
        <div className="space-y-5 sm:space-y-6">
          {/* 行情概览 + 信号 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* 价格卡 */}
            <div className="lg:col-span-2 card p-5 sm:p-6 animate-fade-in-up delay-1">
              <div className="flex justify-between items-start mb-4 sm:mb-5">
                <div>
                  <h2
                    className="text-lg sm:text-2xl font-bold cursor-pointer hover:text-blue-400 transition-colors flex items-center gap-2"
                    onClick={goToDetail}
                  >
                    {result.quote.name}
                    <span className="text-blue-500 text-sm">→</span>
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[var(--text-muted)] text-xs sm:text-sm font-mono">{result.quote.code}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStock(result.quote.code, result.quote.name); }}
                      className="p-0.5 hover:scale-110 transition-transform"
                      title={isInWatchlist(result.quote.code) ? '取消收藏' : '加入自选'}
                    >
                      {isInWatchlist(result.quote.code)
                        ? <IconStarFilled size={14} className="text-yellow-400" />
                        : <IconStar size={14} className="text-[var(--text-muted)] hover:text-yellow-400" />
                      }
                    </button>
                    <span className="text-[var(--text-muted)] text-[10px] sm:text-xs opacity-60">{result.quote.time}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl sm:text-4xl font-bold tabular-nums ${priceColor(result.quote.changePercent)}`}>
                    {result.quote.price}
                  </div>
                  <div className={`text-sm sm:text-base mt-0.5 font-medium tabular-nums ${priceColor(result.quote.changePercent)}`}>
                    {result.quote.change > 0 ? '+' : ''}{result.quote.change}&ensp;
                    {result.quote.changePercent > 0 ? '+' : ''}{result.quote.changePercent}%
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {[
                  { label: '开盘', value: result.quote.open, color: '' },
                  { label: '最高', value: result.quote.high, color: 'text-red-400' },
                  { label: '最低', value: result.quote.low, color: 'text-green-400' },
                  { label: '成交额', value: `${(result.quote.amount / 10000).toFixed(2)}亿`, color: '' },
                ].map((item) => (
                  <div key={item.label} className="px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                    <div className="text-[var(--text-muted)] text-[11px] mb-0.5">{item.label}</div>
                    <div className={`font-medium text-sm tabular-nums ${item.color || 'text-[var(--text-primary)]'}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 信号卡 */}
            <div className={`card p-5 sm:p-6 ${signalBorder(result.signal)} animate-fade-in-up delay-2`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`signal-dot ${result.signal}`} />
                <h3 className={`text-xl sm:text-2xl font-bold ${signalColor(result.signal)}`}>
                  {signalText(result.signal)}
                </h3>
                <SignalIcon signal={result.signal} />
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{result.suggestion}</p>
              {result.stopLoss && (
                <div className="mt-4 flex gap-3 text-xs sm:text-sm">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/8 border border-green-500/15 text-green-400">
                    <IconShield size={14} />
                    止损 {result.stopLoss}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/8 border border-red-500/15 text-red-400">
                    <IconTarget size={14} />
                    止盈 {result.takeProfit}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* K线图 */}
          <div className="card p-4 sm:p-5 animate-fade-in-up delay-3">
            <div className="flex items-center gap-2 mb-3">
              <IconCandlestick size={16} className="text-blue-400" />
              <div className="flex gap-1.5">
                <button
                  onClick={() => setChartType('daily')}
                  className={`btn-secondary px-3 py-1 text-xs sm:text-sm ${chartType === 'daily' ? 'active' : ''}`}
                >
                  日线
                </button>
                <button
                  onClick={() => setChartType('5min')}
                  className={`btn-secondary px-3 py-1 text-xs sm:text-sm ${chartType === '5min' ? 'active' : ''}`}
                >
                  5分钟
                </button>
              </div>
            </div>
            <KlineChart
              klines={chartType === 'daily' ? result.dailyKlines : result.min5Klines}
              title={`${result.quote.name} ${chartType === 'daily' ? '日线' : '5分钟'}`}
              indicators={chartType === 'daily' ? result.indicatorSeries : undefined}
            />
          </div>

          {/* 分析详情 + 指标 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {/* 分析详情 */}
            <div className="card p-5 sm:p-6 animate-fade-in-up delay-4">
              <h3 className="text-sm sm:text-base font-semibold mb-3 flex items-center gap-2">
                <IconChart size={16} className="text-blue-400" />
                分析详情
              </h3>
              <div className="space-y-1.5 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {result.summary.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className={
                    line.includes('📈') || line.includes('金叉') ? 'text-green-400' :
                    line.includes('📉') || line.includes('死叉') ? 'text-red-400' :
                    line.includes('⚠️') ? 'text-yellow-400' : ''
                  }>{line}</p>
                ))}
              </div>
            </div>

            {/* 技术指标 */}
            <div className="card p-5 sm:p-6 animate-fade-in-up delay-5">
              <h3 className="text-sm sm:text-base font-semibold mb-3 flex items-center gap-2">
                <IconBarChart size={16} className="text-blue-400" />
                技术指标
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs sm:text-sm">
                <div className="space-y-1">
                  <div className="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wider">均线</div>
                  <div className="tabular-nums">MA5: <span className="text-yellow-400">{result.indicators.ma.ma5}</span></div>
                  <div className="tabular-nums">MA10: <span className="text-blue-400">{result.indicators.ma.ma10}</span></div>
                  <div className="tabular-nums">MA20: <span className="text-purple-400">{result.indicators.ma.ma20}</span></div>
                  <div className="tabular-nums">MA60: <span className="text-cyan-400">{result.indicators.ma.ma60}</span></div>
                </div>
                <div className="space-y-1">
                  <div className="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wider">MACD</div>
                  <div className="tabular-nums">DIF: <span className={result.indicators.macd.dif >= 0 ? 'text-red-400' : 'text-green-400'}>{result.indicators.macd.dif}</span></div>
                  <div className="tabular-nums">DEA: <span className={result.indicators.macd.dea >= 0 ? 'text-red-400' : 'text-green-400'}>{result.indicators.macd.dea}</span></div>
                  <div className="tabular-nums">柱: <span className={result.indicators.macd.histogram >= 0 ? 'text-red-400' : 'text-green-400'}>{result.indicators.macd.histogram}</span></div>
                </div>
                <div className="space-y-1">
                  <div className="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wider">RSI</div>
                  <div className="tabular-nums">RSI6: <span className={result.indicators.rsi.rsi6 > 70 ? 'text-red-400' : result.indicators.rsi.rsi6 < 30 ? 'text-green-400' : ''}>{result.indicators.rsi.rsi6}</span></div>
                  <div className="tabular-nums">RSI12: {result.indicators.rsi.rsi12}</div>
                  <div className="tabular-nums">RSI24: {result.indicators.rsi.rsi24}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wider">KDJ</div>
                  <div className="tabular-nums">K: {result.indicators.kdj.k}</div>
                  <div className="tabular-nums">D: {result.indicators.kdj.d}</div>
                  <div className="tabular-nums">J: <span className={result.indicators.kdj.j > 100 ? 'text-red-400' : result.indicators.kdj.j < 0 ? 'text-green-400' : ''}>{result.indicators.kdj.j}</span></div>
                </div>
                <div className="space-y-1">
                  <div className="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wider">布林带</div>
                  <div className="tabular-nums">上: <span className="text-orange-400">{result.indicators.boll.upper}</span></div>
                  <div className="tabular-nums">中: <span className="text-orange-300">{result.indicators.boll.middle}</span></div>
                  <div className="tabular-nums">下: <span className="text-orange-400">{result.indicators.boll.lower}</span></div>
                </div>
                <div className="space-y-1">
                  <div className="text-[var(--text-muted)] text-[11px] font-medium uppercase tracking-wider">风控</div>
                  <div className="tabular-nums">ATR: {result.indicators.atr}</div>
                  {result.quote.turnover > 0 && (
                    <div className="flex items-center gap-1 tabular-nums">
                      <IconSwap size={12} className="text-[var(--text-muted)]" />
                      {result.quote.turnover}%
                    </div>
                  )}
                  <div className="mt-1">
                    <span className={`indicator-tag ${result.indicators.rsi.rsi6 > 70 ? 'overbought' : result.indicators.rsi.rsi6 < 30 ? 'oversold' : 'normal'}`}>
                      {result.indicators.rsi.rsi6 > 70 ? '超买' : result.indicators.rsi.rsi6 < 30 ? '超卖' : '正常'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 资讯 */}
          {result.news && result.news.length > 0 && (
            <div className="card p-5 sm:p-6 animate-fade-in-up delay-5">
              <h3 className="text-sm sm:text-base font-semibold mb-3 flex items-center gap-2">
                <IconNews size={16} className="text-blue-400" />
                最新资讯
              </h3>
              <div className="space-y-2">
                {result.news.map((item: NewsItem, i: number) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-default)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] transition-all duration-200 group"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm text-[var(--text-primary)] font-medium leading-snug group-hover:text-blue-400 transition-colors line-clamp-1">{item.title}</h4>
                      {item.summary && (
                        <p className="text-[10px] sm:text-xs text-[var(--text-muted)] mt-1 line-clamp-1">{item.summary}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--text-muted)]">
                        <span>{item.source}</span>
                        <span>·</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                    <IconExternalLink size={14} className="text-[var(--text-muted)] group-hover:text-blue-400 transition-colors mt-1 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 空状态 — 大盘行情 */}
      {!result && !error && !loading && (
        <div className="animate-fade-in-up delay-2">
          {/* 大盘指数概览 */}
          <div className="mb-8">
            <h2 className="text-sm sm:text-base font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)]">
              <IconActivity size={16} className="text-blue-400" />
              大盘行情
              {marketTime && <span className="text-[10px] text-[var(--text-muted)] font-normal ml-2">{marketTime}</span>}
            </h2>
            {marketLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-24" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {indices.map((idx) => (
                  <button
                    key={idx.code}
                    onClick={() => {
                      setCode(idx.code);
                      handleAnalyze(idx.code);
                    }}
                    className="card p-4 text-left hover:border-[var(--border-hover)] transition-all group cursor-pointer"
                  >
                    <div className="text-xs text-[var(--text-muted)] mb-1.5 group-hover:text-blue-400 transition-colors">{idx.name}</div>
                    <div className={`text-lg sm:text-xl font-bold tabular-nums ${priceColor(idx.changePercent)}`}>
                      {idx.price.toFixed(2)}
                    </div>
                    <div className={`text-xs mt-1 font-medium tabular-nums ${priceColor(idx.changePercent)}`}>
                      {idx.changePercent >= 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
                      <span className="ml-1.5 opacity-60">
                        {idx.change >= 0 ? '+' : ''}{idx.change.toFixed(2)}
                      </span>
                    </div>
                    {idx.amount > 0 && (
                      <div className="text-[10px] text-[var(--text-muted)] mt-1.5">
                        成交 {idx.amount.toFixed(0)}亿
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 热点板块 */}
          {(sectorGainers.length > 0 || sectorLosers.length > 0) && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-base font-semibold flex items-center gap-2 text-[var(--text-secondary)]">
                  <IconFire size={16} className="text-orange-400" />
                  热点板块
                </h2>
                <div className="flex gap-1">
                  <button
                    onClick={() => setSectorTab('gainers')}
                    className={`btn-secondary px-3 py-1 text-xs ${sectorTab === 'gainers' ? 'active' : ''}`}
                  >
                    🔥 涨幅榜
                  </button>
                  <button
                    onClick={() => setSectorTab('losers')}
                    className={`btn-secondary px-3 py-1 text-xs ${sectorTab === 'losers' ? 'active' : ''}`}
                  >
                    💧 跌幅榜
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(sectorTab === 'gainers' ? sectorGainers : sectorLosers).map((sector, i) => (
                  <div
                    key={sector.code}
                    className="card px-3 py-2.5 hover:border-[var(--border-hover)] transition-all group"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] text-[var(--text-muted)] opacity-60 font-mono w-4">{i + 1}</span>
                      <span className="text-xs text-[var(--text-primary)] group-hover:text-blue-400 transition-colors truncate">{sector.name}</span>
                    </div>
                    <div className={`text-sm font-bold tabular-nums ${priceColor(sector.changePercent)}`}>
                      {sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 自选股列表 */}
          {watchlistLoaded && watchlist.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm sm:text-base font-semibold mb-4 flex items-center gap-2 text-[var(--text-secondary)]">
                <IconStarFilled size={16} className="text-yellow-400" />
                我的自选
                <span className="text-[10px] text-[var(--text-muted)] font-normal ml-1">({watchlist.length})</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {watchlist.map((item) => {
                  const q = watchlistQuotes[item.code];
                  return (
                    <div
                      key={item.code}
                      className="card p-4 hover:border-[var(--border-hover)] transition-all group cursor-pointer relative"
                      onClick={() => {
                        setCode(item.code);
                        handleAnalyze(item.code);
                      }}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); removeStock(item.code); }}
                        className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 text-[var(--text-muted)]"
                        title="删除"
                      >
                        <IconTrash size={12} />
                      </button>
                      <div className="text-xs text-[var(--text-muted)] mb-1 group-hover:text-blue-400 transition-colors truncate">
                        {item.name}
                        <span className="ml-1.5 font-mono opacity-60">{item.code.replace(/^(sh|sz|bj)/, '')}</span>
                      </div>
                      {q ? (
                        <>
                          <div className={`text-lg sm:text-xl font-bold tabular-nums ${priceColor(q.changePercent)}`}>
                            {q.price.toFixed(2)}
                          </div>
                          <div className={`text-xs mt-1 font-medium tabular-nums ${priceColor(q.changePercent)}`}>
                            {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                            <span className="ml-1.5 opacity-60">
                              {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="skeleton h-10 mt-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 提示 */}
          <div className="text-center py-8 sm:py-12">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
              <IconCandlestick size={26} className="text-blue-400" />
            </div>
            <p className="text-[var(--text-muted)] text-sm">输入股票代码、名称或拼音首字母开始分析</p>
            <p className="text-[var(--text-muted)] text-xs mt-1 opacity-60">支持 A 股、ETF、LOF · 点击上方指数可快速查看</p>
          </div>
        </div>
      )}
    </main>
  );
}
