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

    import('echarts').then((echarts) => {
      if (!chartRef.current) return;

      if (instanceRef.current) {
        instanceRef.current.dispose();
      }

      const chart = echarts.init(chartRef.current, undefined, {
        renderer: 'canvas',
      });
      instanceRef.current = chart;

      const dates = klines.map((k) => k.date);
      const ohlc = klines.map((k) => [k.open, k.close, k.low, k.high]);
      const volumes = klines.map((k) => k.volume);
      const colors = klines.map((k) => (k.close >= k.open ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)'));

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
          large: true,
          largeThreshold: 100,
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumes.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i] },
          })),
          xAxisIndex: 1,
          yAxisIndex: 1,
          large: true,
          largeThreshold: 100,
        },
      ];

      // 均线 — 使用 sampling 减少渲染点
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
            smooth: 0.3,
            lineStyle: { width: 1.2, opacity: 0.8 },
            symbol: 'none',
            itemStyle: { color: ma.color },
            xAxisIndex: 0,
            yAxisIndex: 0,
            sampling: 'lttb',
            animation: false,
          });
        });

        // 布林带
        if (indicators.boll) {
          series.push(
            {
              name: 'BOLL上轨',
              type: 'line',
              data: indicators.boll.upper,
              smooth: 0.3,
              lineStyle: { width: 1, type: 'dashed', opacity: 0.5 },
              symbol: 'none',
              itemStyle: { color: '#f97316' },
              xAxisIndex: 0,
              yAxisIndex: 0,
              sampling: 'lttb',
              animation: false,
            },
            {
              name: 'BOLL中轨',
              type: 'line',
              data: indicators.boll.middle,
              smooth: 0.3,
              lineStyle: { width: 1, opacity: 0.6 },
              symbol: 'none',
              itemStyle: { color: '#f97316' },
              xAxisIndex: 0,
              yAxisIndex: 0,
              sampling: 'lttb',
              animation: false,
            },
            {
              name: 'BOLL下轨',
              type: 'line',
              data: indicators.boll.lower,
              smooth: 0.3,
              lineStyle: { width: 1, type: 'dashed', opacity: 0.5 },
              symbol: 'none',
              itemStyle: { color: '#f97316' },
              xAxisIndex: 0,
              yAxisIndex: 0,
              sampling: 'lttb',
              animation: false,
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
              smooth: 0.3,
              lineStyle: { width: 1.2 },
              symbol: 'none',
              itemStyle: { color: '#eab308' },
              xAxisIndex: 2,
              yAxisIndex: 2,
              sampling: 'lttb',
              animation: false,
            },
            {
              name: 'DEA',
              type: 'line',
              data: indicators.macd.dea,
              smooth: 0.3,
              lineStyle: { width: 1.2 },
              symbol: 'none',
              itemStyle: { color: '#3b82f6' },
              xAxisIndex: 2,
              yAxisIndex: 2,
              sampling: 'lttb',
              animation: false,
            },
            {
              name: 'MACD',
              type: 'bar',
              data: indicators.macd.histogram.map((v) => ({
                value: v,
                itemStyle: { color: v >= 0 ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)' },
              })),
              xAxisIndex: 2,
              yAxisIndex: 2,
              large: true,
              largeThreshold: 100,
              animation: false,
            },
          );
        }
      }

      const option = {
        backgroundColor: 'transparent',
        title: {
          text: title,
          left: 'center',
          textStyle: { color: '#94a3b8', fontSize: 13, fontWeight: 500 },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
            crossStyle: { color: '#3b82f6', width: 0.5 },
            lineStyle: { color: 'rgba(59,130,246,0.3)', width: 0.5 },
          },
          backgroundColor: 'rgba(10,15,30,0.95)',
          borderColor: 'rgba(59,130,246,0.2)',
          borderWidth: 1,
          textStyle: { color: '#e2e8f0', fontSize: 12 },
          padding: [8, 12],
        },
        legend: {
          data: ['MA5', 'MA10', 'MA20', 'MA60'],
          top: 8,
          right: 16,
          textStyle: { color: '#64748b', fontSize: 10 },
          itemWidth: 12,
          itemHeight: 2,
        },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        dataZoom: [
          {
            type: 'inside',
            xAxisIndex: [0, 1, 2],
            start: 60,
            end: 100,
            throttle: 50,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            preventDefaultMouseMove: false,
          },
          {
            type: 'slider',
            xAxisIndex: [0, 1, 2],
            start: 60,
            end: 100,
            top: '94%',
            height: 18,
            borderColor: 'transparent',
            backgroundColor: 'rgba(59,130,246,0.05)',
            fillerColor: 'rgba(59,130,246,0.12)',
            handleStyle: { color: '#3b82f6', borderColor: '#3b82f6' },
            textStyle: { color: '#64748b', fontSize: 10 },
            dataBackground: {
              lineStyle: { color: 'rgba(59,130,246,0.2)' },
              areaStyle: { color: 'rgba(59,130,246,0.05)' },
            },
            throttle: 50,
          },
        ],
        grid: [
          { left: 55, right: 16, top: 36, height: '44%' },
          { left: 55, right: 16, top: '56%', height: '12%' },
          { left: 55, right: 16, top: '73%', height: '18%' },
        ],
        xAxis: [
          { type: 'category', data: dates, gridIndex: 0, show: false, boundaryGap: true },
          { type: 'category', data: dates, gridIndex: 1, show: false, boundaryGap: true },
          {
            type: 'category',
            data: dates,
            gridIndex: 2,
            boundaryGap: true,
            axisLabel: { fontSize: 10, color: '#64748b' },
            axisLine: { lineStyle: { color: 'rgba(59,130,246,0.1)' } },
          },
        ],
        yAxis: [
          {
            type: 'value',
            gridIndex: 0,
            splitLine: { lineStyle: { color: 'rgba(59,130,246,0.06)' } },
            axisLabel: { color: '#64748b', fontSize: 10 },
            scale: true,
          },
          {
            type: 'value',
            gridIndex: 1,
            splitLine: { show: false },
            axisLabel: { show: false },
          },
          {
            type: 'value',
            gridIndex: 2,
            splitLine: { lineStyle: { color: 'rgba(59,130,246,0.06)' } },
            axisLabel: { color: '#64748b', fontSize: 10 },
            scale: true,
          },
        ],
        series,
        animation: false,
      };

      chart.setOption(option);

      const ro = new ResizeObserver(() => chart.resize());
      ro.observe(chartRef.current);

      return () => {
        ro.disconnect();
        chart.dispose();
      };
    });
  }, [klines, indicators, title]);

  return <div ref={chartRef} className="w-full h-[420px] sm:h-[560px]" />;
}
