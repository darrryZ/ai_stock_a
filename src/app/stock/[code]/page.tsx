'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { AnalysisResult, KlineItem, NewsItem } from '@/types/stock';
import { IconArrowLeft, IconRefresh, IconTrendUp, IconTrendDown, IconMinus, IconShield, IconTarget, IconChart, IconCandlestick, IconNews, IconBarChart, IconExternalLink, IconSwap, IconStar, IconStarFilled } from '@/components/Icons';
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

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FullAnalysis | null>(null);
  const [error, setError] = useState('');
  const [chartType, setChartType] = useState<'daily' | '5min'>('daily');
  const [refreshing, setRefreshing] = useState(false);
  const { isInWatchlist, toggleStock } = useWatchlist();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/analyze?code=${encodeURIComponent(code)}`);
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
      setRefreshing(false);
    }
  }, [code]);

  useEffect(() => {
    if (code) fetchData();
  }, [code, fetchData]);

  const SignalIcon = ({ signal }: { signal: string }) => {
    if (signal === 'bullish') return <IconTrendUp size={22} className="text-green-400" />;
    if (signal === 'bearish') return <IconTrendDown size={22} className="text-red-400" />;
    return <IconMinus size={22} className="text-yellow-400" />;
  };

  const signalColor = (s: string) =>
    s === 'bullish' ? 'text-green-400' : s === 'bearish' ? 'text-red-400' : 'text-yellow-400';
  const signalBorder = (s: string) =>
    s === 'bullish' ? 'border-green-500/20' : s === 'bearish' ? 'border-red-500/20' : 'border-yellow-500/20';
  const signalText = (s: string) =>
    s === 'bullish' ? '看多' : s === 'bearish' ? '看空' : '观望';
  const priceColor = (v: number) => (v >= 0 ? 'text-red-400' : 'text-green-400');

  // 加载骨架屏
  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
          <button onClick={() => router.push('/')} className="btn-secondary p-2 rounded-lg">
            <IconArrowLeft size={18} />
          </button>
          <div className="skeleton h-7 w-32" />
        </div>
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 skeleton h-48" />
            <div className="skeleton h-48" />
          </div>
          <div className="skeleton h-96" />
          <div className="grid grid-cols-2 gap-5">
            <div className="skeleton h-56" />
            <div className="skeleton h-56" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
          <button onClick={() => router.push('/')} className="btn-secondary p-2 rounded-lg">
            <IconArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold">分析失败</h1>
        </div>
        <div className="card p-5 border-red-500/20 animate-fade-in-up delay-1">
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button onClick={() => fetchData()} className="btn-primary px-5 py-2 text-sm">重试</button>
        </div>
      </main>
    );
  }

  if (!result) return null;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 sm:mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="btn-secondary p-2 rounded-lg">
            <IconArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{result.quote.name}</h1>
            <span className="text-[var(--text-muted)] text-xs font-mono">{result.quote.code}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={`btn-secondary p-2 rounded-lg ${refreshing ? 'animate-spin' : ''}`}
          >
            <IconRefresh size={18} />
          </button>
          <button
            onClick={() => toggleStock(result.quote.code, result.quote.name)}
            className="btn-secondary p-2 rounded-lg hover:scale-105 transition-transform"
            title={isInWatchlist(result.quote.code) ? '取消收藏' : '加入自选'}
          >
            {isInWatchlist(result.quote.code)
              ? <IconStarFilled size={18} className="text-yellow-400" />
              : <IconStar size={18} />
            }
          </button>
          <span className="text-[10px] sm:text-xs text-[var(--text-muted)] hidden sm:block">{result.quote.time}</span>
        </div>
      </div>

      <div className="space-y-5 sm:space-y-6">
        {/* 行情概览 + 信号 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* 价格卡 */}
          <div className="lg:col-span-2 card p-5 sm:p-6 animate-fade-in-up delay-1">
            <div className="text-right mb-5">
              <div className={`text-4xl sm:text-5xl font-bold tabular-nums ${priceColor(result.quote.changePercent)}`}>
                {result.quote.price}
              </div>
              <div className={`text-lg sm:text-xl mt-1 font-medium tabular-nums ${priceColor(result.quote.changePercent)}`}>
                {result.quote.change > 0 ? '+' : ''}{result.quote.change}&ensp;
                {result.quote.changePercent > 0 ? '+' : ''}{result.quote.changePercent}%
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {[
                { label: '开盘', value: result.quote.open, color: '' },
                { label: '最高', value: result.quote.high, color: 'text-red-400' },
                { label: '最低', value: result.quote.low, color: 'text-green-400' },
                { label: '昨收', value: result.quote.close, color: '' },
                { label: '成交量', value: `${(result.quote.volume / 10000).toFixed(2)}万手`, color: '' },
                { label: '成交额', value: `${(result.quote.amount / 10000).toFixed(2)}亿`, color: '' },
                ...(result.quote.turnover > 0 ? [{ label: '换手率', value: `${result.quote.turnover}%`, color: '' }] : []),
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
            <div className="flex items-center gap-3 mb-4">
              <div className={`signal-dot ${result.signal}`} />
              <h3 className={`text-2xl sm:text-3xl font-bold ${signalColor(result.signal)}`}>
                {signalText(result.signal)}
              </h3>
              <SignalIcon signal={result.signal} />
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-4">{result.suggestion}</p>
            {result.stopLoss && (
              <div className="flex gap-3 text-xs sm:text-sm">
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
                <div className="tabular-nums">MA120: <span className="text-orange-400">{result.indicators.ma.ma120}</span></div>
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
                <div className="tabular-nums">RSI12: <span className={result.indicators.rsi.rsi12 > 70 ? 'text-red-400' : result.indicators.rsi.rsi12 < 30 ? 'text-green-400' : ''}>{result.indicators.rsi.rsi12}</span></div>
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
    </main>
  );
}
