'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { KlineItem } from '@/types/stock';
import { init, dispose, type Chart, type KLineData } from 'klinecharts';

interface KlineChartProps {
  klines: KlineItem[];
  title?: string;
  indicators?: {
    ma5: number[];
    ma10: number[];
    ma20: number[];
    ma60: number[];
    macd: { dif: number[]; dea: number[]; histogram: number[] };
    boll: { upper: number[]; middle: number[]; lower: number[] };
  };
}

// 转换数据格式
function convertToKLineData(klines: KlineItem[]): KLineData[] {
  return klines.map((k) => ({
    timestamp: new Date(k.date.replace(/-/g, '/')).getTime(),
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
    volume: k.volume,
    turnover: k.amount,
  }));
}

export default function KlineChart({ klines, title: _title, indicators: _indicators }: KlineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const dataRef = useRef<KLineData[]>([]);

  const initChart = useCallback(() => {
    if (!containerRef.current || klines.length === 0) return;

    // 先清理旧实例
    if (chartRef.current) {
      dispose(containerRef.current);
      chartRef.current = null;
    }

    // 准备数据
    dataRef.current = convertToKLineData(klines);

    const chart = init(containerRef.current, {
      styles: {
        grid: {
          show: true,
          horizontal: {
            show: true,
            size: 1,
            color: 'rgba(59,130,246,0.06)',
            style: 'dashed',
          },
          vertical: {
            show: false,
            size: 1,
            color: 'rgba(59,130,246,0.06)',
            style: 'dashed',
          },
        },
        candle: {
          type: 'candle_solid',
          bar: {
            upColor: '#ef4444',
            downColor: '#22c55e',
            noChangeColor: '#888888',
            upBorderColor: '#ef4444',
            downBorderColor: '#22c55e',
            noChangeBorderColor: '#888888',
            upWickColor: '#ef4444',
            downWickColor: '#22c55e',
            noChangeWickColor: '#888888',
          },
          priceMark: {
            show: true,
            high: {
              show: true,
              color: '#ef4444',
              textSize: 10,
            },
            low: {
              show: true,
              color: '#22c55e',
              textSize: 10,
            },
            last: {
              show: true,
              upColor: '#ef4444',
              downColor: '#22c55e',
              noChangeColor: '#888888',
              line: { show: true, style: 'dashed', size: 1 },
              text: {
                show: true,
                style: 'fill',
                size: 11,
                color: '#ffffff',
                borderSize: 0,
                borderRadius: 2,
                paddingLeft: 4,
                paddingRight: 4,
                paddingTop: 2,
                paddingBottom: 2,
              },
            },
          },
          tooltip: {
            showRule: 'always',
            showType: 'standard',
          },
        },
        indicator: {
          lastValueMark: { show: false },
          tooltip: {
            showRule: 'always',
            showType: 'standard',
          },
        },
        xAxis: {
          show: true,
          axisLine: { show: true, color: 'rgba(59,130,246,0.1)', size: 1 },
          tickText: { show: true, color: '#64748b', size: 10 },
          tickLine: { show: false },
        },
        yAxis: {
          show: true,
          axisLine: { show: false },
          tickText: { show: true, color: '#64748b', size: 10 },
          tickLine: { show: false },
        },
        separator: {
          size: 1,
          color: 'rgba(59,130,246,0.08)',
          fill: true,
          activeBackgroundColor: 'rgba(59,130,246,0.15)',
        },
        crosshair: {
          show: true,
          horizontal: {
            show: true,
            line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: 'rgba(59,130,246,0.4)' },
            text: {
              show: true,
              style: 'fill',
              color: '#ffffff',
              size: 11,
              borderSize: 0,
              borderRadius: 2,
              paddingLeft: 4,
              paddingRight: 4,
              paddingTop: 2,
              paddingBottom: 2,
              backgroundColor: 'rgba(59,130,246,0.75)',
            },
          },
          vertical: {
            show: true,
            line: { show: true, style: 'dashed', dashedValue: [4, 2], size: 1, color: 'rgba(59,130,246,0.4)' },
            text: {
              show: true,
              style: 'fill',
              color: '#ffffff',
              size: 11,
              borderSize: 0,
              borderRadius: 2,
              paddingLeft: 4,
              paddingRight: 4,
              paddingTop: 2,
              paddingBottom: 2,
              backgroundColor: 'rgba(59,130,246,0.75)',
            },
          },
        },
      },
      locale: 'zh-CN',
    });

    if (!chart) return;
    chartRef.current = chart;

    // 创建副图指标
    chart.createIndicator('VOL', false, { id: 'pane_vol', height: 80 });
    chart.createIndicator('MACD', false, { id: 'pane_macd', height: 100 });

    // 主图叠加指标
    chart.createIndicator('MA', true, { id: 'candle_pane' });
    chart.createIndicator('BOLL', true, { id: 'candle_pane' });

    // 通过 DataLoader 加载数据
    chart.setDataLoader({
      getBars: (params) => {
        if (params.type === 'init') {
          params.callback(dataRef.current, false);
        } else {
          params.callback([], false);
        }
      },
    });

    // 设置 symbol 和 period 触发数据加载
    chart.setSymbol({ ticker: 'stock', pricePrecision: 2, volumePrecision: 0 });
    chart.setPeriod({ type: 'day', span: 1 });
  }, [klines]);

  useEffect(() => {
    initChart();

    return () => {
      if (containerRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        dispose(containerRef.current);
        chartRef.current = null;
      }
    };
  }, [initChart]);

  // 响应式调整
  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;

    const ro = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    ro.observe(containerRef.current);

    return () => ro.disconnect();
  }, [klines]);

  return <div ref={containerRef} className="w-full h-[420px] sm:h-[560px]" />;
}
