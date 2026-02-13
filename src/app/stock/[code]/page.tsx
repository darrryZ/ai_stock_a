'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { AnalysisResult, KlineItem, NewsItem } from '@/types/stock';

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

  const signalColor = (s: string) =>
    s === 'bullish' ? 'text-green-400' : s === 'bearish' ? 'text-red-400' : 'text-yellow-400';
  const signalBg = (s: string) =>
    s === 'bullish' ? 'border-green-800 bg-green-950/30' : s === 'bearish' ? 'border-red-800 bg-red-950/30' : 'border-yellow-800 bg-yellow-950/30';
  const signalText = (s: string) =>
    s === 'bullish' ? '🟢 看多' : s === 'bearish' ? '🔴 看空' : '🟡 观望';
  const priceColor = (v: number) => (v >= 0 ? 'text-red-400' : 'text-green-400');

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-200 transition-colors">
            ← 返回
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-400">加载中...</h1>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-gray-500 text-lg">⏳ 正在分析 {code} ...</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-6xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-200 transition-colors">
            ← 返回
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">分析失败</h1>
        </div>
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
          {error}
        </div>
        <button
          onClick={() => fetchData()}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
        >
          重试
        </button>
      </main>
    );
  }

  if (!result) return null;

  return (
    <main className="max-w-6xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-200 transition-colors text-sm">
            ← 返回
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">{result.quote.name}</h1>
            <span className="text-gray-400 text-xs sm:text-sm">{result.quote.code}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-xs sm:text-sm transition-colors"
          >
            {refreshing ? '⏳' : '🔄 刷新'}
          </button>
          <span className="text-[10px] sm:text-xs text-gray-500">{result.quote.time}</span>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* 行情概览 + 信号 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 价格卡 */}
          <div className="lg:col-span-2 p-4 sm:p-6 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex justify-between items-start mb-3 sm:mb-4">
              <div className="text-right w-full">
                <div className={`text-3xl sm:text-5xl font-bold ${priceColor(result.quote.changePercent)}`}>
                  {result.quote.price}
                </div>
                <div className={`text-lg sm:text-xl mt-1 ${priceColor(result.quote.changePercent)}`}>
                  {result.quote.change > 0 ? '+' : ''}{result.quote.change}&nbsp;&nbsp;
                  {result.quote.changePercent > 0 ? '+' : ''}{result.quote.changePercent}%
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="p-2 bg-gray-800/50 rounded">
                <div className="text-gray-500">开盘</div>
                <div className="text-gray-200 font-medium">{result.quote.open}</div>
              </div>
              <div className="p-2 bg-gray-800/50 rounded">
                <div className="text-gray-500">最高</div>
                <div className="text-red-400 font-medium">{result.quote.high}</div>
              </div>
              <div className="p-2 bg-gray-800/50 rounded">
                <div className="text-gray-500">最低</div>
                <div className="text-green-400 font-medium">{result.quote.low}</div>
              </div>
              <div className="p-2 bg-gray-800/50 rounded">
                <div className="text-gray-500">昨收</div>
                <div className="text-gray-200 font-medium">{result.quote.close}</div>
              </div>
              <div className="p-2 bg-gray-800/50 rounded">
                <div className="text-gray-500">成交量</div>
                <div className="text-gray-200 font-medium">{(result.quote.volume / 10000).toFixed(2)}万手</div>
              </div>
              <div className="p-2 bg-gray-800/50 rounded">
                <div className="text-gray-500">成交额</div>
                <div className="text-gray-200 font-medium">{(result.quote.amount / 10000).toFixed(2)}亿</div>
              </div>
              {result.quote.turnover > 0 && (
                <div className="p-2 bg-gray-800/50 rounded">
                  <div className="text-gray-500">换手率</div>
                  <div className="text-gray-200 font-medium">{result.quote.turnover}%</div>
                </div>
              )}
            </div>
          </div>

          {/* 信号卡 */}
          <div className={`p-4 sm:p-6 rounded-lg border ${signalBg(result.signal)}`}>
            <h3 className={`text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 ${signalColor(result.signal)}`}>
              {signalText(result.signal)}
            </h3>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-3">{result.suggestion}</p>
            {result.stopLoss && (
              <div className="flex gap-3 text-xs sm:text-sm">
                <span className="px-3 py-1.5 bg-green-900/50 rounded text-green-400">
                  止损 {result.stopLoss}
                </span>
                <span className="px-3 py-1.5 bg-red-900/50 rounded text-red-400">
                  止盈 {result.takeProfit}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* K线图 */}
        <div className="p-3 sm:p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div className="flex gap-2 mb-2 sm:mb-3">
            <button
              onClick={() => setChartType('daily')}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${chartType === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            >
              日线
            </button>
            <button
              onClick={() => setChartType('5min')}
              className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${chartType === '5min' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            >
              5分钟
            </button>
          </div>
          <KlineChart
            klines={chartType === 'daily' ? result.dailyKlines : result.min5Klines}
            title={`${result.quote.name} ${chartType === 'daily' ? '日线' : '5分钟'}`}
            indicators={chartType === 'daily' ? result.indicatorSeries : undefined}
          />
        </div>

        {/* 分析详情 + 指标 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 分析详情 */}
          <div className="p-4 sm:p-6 bg-gray-900 rounded-lg border border-gray-800">
            <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">📋 分析详情</h3>
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-300">
              {result.summary.split('\n').filter(Boolean).map((line, i) => (
                <p key={i} className={line.includes('📈') || line.includes('🟢') ? 'text-green-400' : line.includes('📉') || line.includes('🔴') ? 'text-red-400' : line.includes('⚠️') ? 'text-yellow-400' : ''}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* 技术指标 */}
          <div className="p-4 sm:p-6 bg-gray-900 rounded-lg border border-gray-800">
            <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">📈 技术指标</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <div className="text-gray-500 font-medium border-b border-gray-800 pb-1 mb-1">均线</div>
                <div>MA5: <span className="text-yellow-400">{result.indicators.ma.ma5}</span></div>
                <div>MA10: <span className="text-blue-400">{result.indicators.ma.ma10}</span></div>
                <div>MA20: <span className="text-purple-400">{result.indicators.ma.ma20}</span></div>
                <div>MA60: <span className="text-cyan-400">{result.indicators.ma.ma60}</span></div>
                <div>MA120: <span className="text-orange-400">{result.indicators.ma.ma120}</span></div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-500 font-medium border-b border-gray-800 pb-1 mb-1">MACD</div>
                <div>DIF: <span className={result.indicators.macd.dif >= 0 ? 'text-red-400' : 'text-green-400'}>{result.indicators.macd.dif}</span></div>
                <div>DEA: <span className={result.indicators.macd.dea >= 0 ? 'text-red-400' : 'text-green-400'}>{result.indicators.macd.dea}</span></div>
                <div>柱: <span className={result.indicators.macd.histogram >= 0 ? 'text-red-400' : 'text-green-400'}>{result.indicators.macd.histogram}</span></div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-500 font-medium border-b border-gray-800 pb-1 mb-1">RSI</div>
                <div>RSI6: <span className={result.indicators.rsi.rsi6 > 70 ? 'text-red-400' : result.indicators.rsi.rsi6 < 30 ? 'text-green-400' : ''}>{result.indicators.rsi.rsi6}</span></div>
                <div>RSI12: <span className={result.indicators.rsi.rsi12 > 70 ? 'text-red-400' : result.indicators.rsi.rsi12 < 30 ? 'text-green-400' : ''}>{result.indicators.rsi.rsi12}</span></div>
                <div>RSI24: {result.indicators.rsi.rsi24}</div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-500 font-medium border-b border-gray-800 pb-1 mb-1">KDJ</div>
                <div>K: {result.indicators.kdj.k}</div>
                <div>D: {result.indicators.kdj.d}</div>
                <div>J: <span className={result.indicators.kdj.j > 100 ? 'text-red-400' : result.indicators.kdj.j < 0 ? 'text-green-400' : ''}>{result.indicators.kdj.j}</span></div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-500 font-medium border-b border-gray-800 pb-1 mb-1">布林带</div>
                <div>上轨: <span className="text-orange-400">{result.indicators.boll.upper}</span></div>
                <div>中轨: <span className="text-orange-300">{result.indicators.boll.middle}</span></div>
                <div>下轨: <span className="text-orange-400">{result.indicators.boll.lower}</span></div>
              </div>
              <div className="space-y-1">
                <div className="text-gray-500 font-medium border-b border-gray-800 pb-1 mb-1">风控</div>
                <div>ATR: {result.indicators.atr}</div>
                {result.quote.turnover > 0 && <div>换手: {result.quote.turnover}%</div>}
                <div className="mt-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${result.indicators.rsi.rsi6 > 70 ? 'bg-red-900/50 text-red-400' : result.indicators.rsi.rsi6 < 30 ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                    {result.indicators.rsi.rsi6 > 70 ? '超买' : result.indicators.rsi.rsi6 < 30 ? '超卖' : '正常'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 资讯 */}
        {result.news && result.news.length > 0 && (
          <div className="p-4 sm:p-6 bg-gray-900 rounded-lg border border-gray-800">
            <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">📰 最新资讯</h3>
            <div className="space-y-2 sm:space-y-3">
              {result.news.map((item: NewsItem, i: number) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 sm:p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 active:bg-gray-700 transition-colors"
                >
                  <div className="flex justify-between items-start gap-3">
                    <h4 className="text-xs sm:text-sm text-gray-200 font-medium leading-snug">{item.title}</h4>
                    <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap shrink-0">{item.time}</span>
                  </div>
                  {item.summary && (
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 line-clamp-2">{item.summary}</p>
                  )}
                  <span className="text-[10px] sm:text-xs text-gray-600 mt-1 inline-block">{item.source}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
