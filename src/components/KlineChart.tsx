'use client';

import { useEffect, useRef } from 'react';
import type { KlineItem } from '@/types/stock';

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

export default function KlineChart({ klines, title = 'K线图', indicators }: KlineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    if (!chartRef.current || klines.length === 0) return;

    // dynamic import echarts on client side
    import('echarts').then((echarts) => {
      if (!chartRef.current) return;

      if (instanceRef.current) {
        instanceRef.current.dispose();
      }

      const chart = echarts.init(chartRef.current, 'dark');
      instanceRef.current = chart;

      const dates = klines.map((k) => k.date);
      const ohlc = klines.map((k) => [k.open, k.close, k.low, k.high]);
      const volumes = klines.map((k) => k.volume);
      const colors = klines.map((k) => (k.close >= k.open ? '#ef4444' : '#22c55e'));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const series: any[] = [
        {
          name: 'K线',
          type: 'candlestick',
          data: ohlc,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: '#ef4444',
            color0: '#22c55e',
            borderColor: '#ef4444',
            borderColor0: '#22c55e',
          },
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumes.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i] + '80' },
          })),
          xAxisIndex: 1,
          yAxisIndex: 1,
        },
      ];

      // 均线
      if (indicators) {
        const maLines = [
          { name: 'MA5', data: indicators.ma5, color: '#eab308' },
          { name: 'MA10', data: indicators.ma10, color: '#3b82f6' },
          { name: 'MA20', data: indicators.ma20, color: '#a855f7' },
          { name: 'MA60', data: indicators.ma60, color: '#06b6d4' },
        ];
        maLines.forEach((ma) => {
          series.push({
            name: ma.name,
            type: 'line',
            data: ma.data,
            smooth: true,
            lineStyle: { width: 1 },
            symbol: 'none',
            itemStyle: { color: ma.color },
            xAxisIndex: 0,
            yAxisIndex: 0,
          });
        });

        // 布林带
        if (indicators.boll) {
          series.push(
            {
              name: 'BOLL上轨',
              type: 'line',
              data: indicators.boll.upper,
              smooth: true,
              lineStyle: { width: 1, type: 'dashed' },
              symbol: 'none',
              itemStyle: { color: '#f97316' },
              xAxisIndex: 0,
              yAxisIndex: 0,
            },
            {
              name: 'BOLL中轨',
              type: 'line',
              data: indicators.boll.middle,
              smooth: true,
              lineStyle: { width: 1 },
              symbol: 'none',
              itemStyle: { color: '#f97316' },
              xAxisIndex: 0,
              yAxisIndex: 0,
            },
            {
              name: 'BOLL下轨',
              type: 'line',
              data: indicators.boll.lower,
              smooth: true,
              lineStyle: { width: 1, type: 'dashed' },
              symbol: 'none',
              itemStyle: { color: '#f97316' },
              xAxisIndex: 0,
              yAxisIndex: 0,
            },
          );
        }

        // MACD 副图
        if (indicators.macd) {
          series.push(
            {
              name: 'DIF',
              type: 'line',
              data: indicators.macd.dif,
              smooth: true,
              lineStyle: { width: 1 },
              symbol: 'none',
              itemStyle: { color: '#eab308' },
              xAxisIndex: 2,
              yAxisIndex: 2,
            },
            {
              name: 'DEA',
              type: 'line',
              data: indicators.macd.dea,
              smooth: true,
              lineStyle: { width: 1 },
              symbol: 'none',
              itemStyle: { color: '#3b82f6' },
              xAxisIndex: 2,
              yAxisIndex: 2,
            },
            {
              name: 'MACD',
              type: 'bar',
              data: indicators.macd.histogram.map((v) => ({
                value: v,
                itemStyle: { color: v >= 0 ? '#ef4444' : '#22c55e' },
              })),
              xAxisIndex: 2,
              yAxisIndex: 2,
            },
          );
        }
      }

      const option = {
        backgroundColor: 'transparent',
        title: { text: title, left: 'center', textStyle: { color: '#e5e7eb', fontSize: 14 } },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
        },
        legend: {
          data: ['MA5', 'MA10', 'MA20', 'MA60'],
          top: 10,
          right: 20,
          textStyle: { color: '#9ca3af', fontSize: 11 },
        },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        dataZoom: [
          { type: 'inside', xAxisIndex: [0, 1, 2], start: 60, end: 100 },
          { type: 'slider', xAxisIndex: [0, 1, 2], start: 60, end: 100, top: '95%', height: 16 },
        ],
        grid: [
          { left: 60, right: 20, top: 40, height: '45%' },
          { left: 60, right: 20, top: '58%', height: '12%' },
          { left: 60, right: 20, top: '75%', height: '18%' },
        ],
        xAxis: [
          { type: 'category', data: dates, gridIndex: 0, show: false, boundaryGap: true },
          { type: 'category', data: dates, gridIndex: 1, show: false, boundaryGap: true },
          { type: 'category', data: dates, gridIndex: 2, boundaryGap: true, axisLabel: { fontSize: 10 } },
        ],
        yAxis: [
          { type: 'value', gridIndex: 0, splitLine: { lineStyle: { color: '#333' } }, scale: true },
          { type: 'value', gridIndex: 1, splitLine: { show: false }, axisLabel: { show: false } },
          { type: 'value', gridIndex: 2, splitLine: { lineStyle: { color: '#333' } }, scale: true },
        ],
        series,
      };

      chart.setOption(option);

      const handleResize = () => chart.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.dispose();
      };
    });
  }, [klines, indicators, title]);

  return <div ref={chartRef} className="w-full h-[400px] sm:h-[600px]" />;
}
