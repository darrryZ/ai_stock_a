'use client';

import { useState } from 'react';
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

export default function Home() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullAnalysis | null>(null);
  const [error, setError] = useState('');
  const [chartType, setChartType] = useState<'daily' | '5min'>('daily');

  const handleAnalyze = async () => {
    const input = code.trim();
    if (!input) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
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

  const signalColor = (s: string) =>
    s === 'bullish' ? 'text-green-400' : s === 'bearish' ? 'text-red-400' : 'text-yellow-400';
  const signalBg = (s: string) =>
    s === 'bullish' ? 'border-green-800 bg-green-950/30' : s === 'bearish' ? 'border-red-800 bg-red-950/30' : 'border-yellow-800 bg-yellow-950/30';
  const signalText = (s: string) =>
    s === 'bullish' ? '🟢 看多' : s === 'bearish' ? '🔴 看空' : '🟡 观望';

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">📊 A股分析助手</h1>
        <span className="text-xs text-gray-500">数据来源：新浪/东方财富</span>
      </div>

      {/* 搜索栏 */}
      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder="输入股票代码（600519）或基金代码（159915）"
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition-colors"
        >
          {loading ? '⏳ 分析中...' : '分析'}
        </button>
      </div>

      {error && <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg mb-6 text-red-200">{error}</div>}

      {result && (
        <div className="space-y-6">
          {/* 行情概览 + 信号 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 价格卡 */}
            <div className="md:col-span-2 p-6 bg-gray-900 rounded-lg border border-gray-800">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{result.quote.name}</h2>
                  <span className="text-gray-400 text-sm">{result.quote.code}</span>
                  <span className="text-gray-600 text-xs ml-3">{result.quote.time}</span>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${result.quote.changePercent >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {result.quote.price}
                  </div>
                  <div className={`text-lg ${result.quote.changePercent >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {result.quote.change > 0 ? '+' : ''}{result.quote.change} ({result.quote.changePercent > 0 ? '+' : ''}{result.quote.changePercent}%)
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="text-gray-400">开盘 <span className="text-gray-200 ml-1">{result.quote.open}</span></div>
                <div className="text-gray-400">最高 <span className="text-red-400 ml-1">{result.quote.high}</span></div>
                <div className="text-gray-400">最低 <span className="text-green-400 ml-1">{result.quote.low}</span></div>
                <div className="text-gray-400">成交额 <span className="text-gray-200 ml-1">{(result.quote.amount / 10000).toFixed(2)}亿</span></div>
              </div>
            </div>

            {/* 信号卡 */}
            <div className={`p-6 rounded-lg border ${signalBg(result.signal)}`}>
              <h3 className={`text-2xl font-bold mb-3 ${signalColor(result.signal)}`}>
                {signalText(result.signal)}
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">{result.suggestion}</p>
              {result.stopLoss && (
                <div className="mt-4 flex gap-4 text-sm">
                  <span className="px-2 py-1 bg-green-900/50 rounded text-green-400">止损 {result.stopLoss}</span>
                  <span className="px-2 py-1 bg-red-900/50 rounded text-red-400">止盈 {result.takeProfit}</span>
                </div>
              )}
            </div>
          </div>

          {/* K线图 */}
          <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setChartType('daily')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${chartType === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
              >
                日线
              </button>
              <button
                onClick={() => setChartType('5min')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${chartType === '5min' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 分析详情 */}
            <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
              <h3 className="text-lg font-bold mb-3">📋 分析详情</h3>
              <div className="space-y-1.5 text-sm text-gray-300">
                {result.summary.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>

            {/* 技术指标 */}
            <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
              <h3 className="text-lg font-bold mb-3">📈 技术指标</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 mb-1 font-medium">均线</div>
                  <div>MA5: <span className="text-yellow-400">{result.indicators.ma.ma5}</span></div>
                  <div>MA10: <span className="text-blue-400">{result.indicators.ma.ma10}</span></div>
                  <div>MA20: <span className="text-purple-400">{result.indicators.ma.ma20}</span></div>
                  <div>MA60: <span className="text-cyan-400">{result.indicators.ma.ma60}</span></div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1 font-medium">MACD</div>
                  <div>DIF: {result.indicators.macd.dif}</div>
                  <div>DEA: {result.indicators.macd.dea}</div>
                  <div>柱: <span className={result.indicators.macd.histogram >= 0 ? 'text-red-400' : 'text-green-400'}>{result.indicators.macd.histogram}</span></div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1 font-medium">RSI</div>
                  <div>RSI6: <span className={result.indicators.rsi.rsi6 > 70 ? 'text-red-400' : result.indicators.rsi.rsi6 < 30 ? 'text-green-400' : ''}>{result.indicators.rsi.rsi6}</span></div>
                  <div>RSI12: {result.indicators.rsi.rsi12}</div>
                  <div>RSI24: {result.indicators.rsi.rsi24}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1 font-medium">KDJ</div>
                  <div>K: {result.indicators.kdj.k}</div>
                  <div>D: {result.indicators.kdj.d}</div>
                  <div>J: <span className={result.indicators.kdj.j > 100 ? 'text-red-400' : result.indicators.kdj.j < 0 ? 'text-green-400' : ''}>{result.indicators.kdj.j}</span></div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1 font-medium">布林带</div>
                  <div>上轨: {result.indicators.boll.upper}</div>
                  <div>中轨: {result.indicators.boll.middle}</div>
                  <div>下轨: {result.indicators.boll.lower}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1 font-medium">风控</div>
                  <div>ATR: {result.indicators.atr}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 资讯 */}
          {result.news && result.news.length > 0 && (
            <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
              <h3 className="text-lg font-bold mb-3">📰 最新资讯</h3>
              <div className="space-y-3">
                {result.news.map((item: NewsItem, i: number) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-gray-800/50 rounded hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="text-sm text-gray-200 font-medium">{item.title}</h4>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{item.time}</span>
                    </div>
                    {item.summary && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.summary}</p>
                    )}
                    <span className="text-xs text-gray-600 mt-1 inline-block">{item.source}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
