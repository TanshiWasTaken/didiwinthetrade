import React, { useEffect, useRef } from 'react';
import { 
  createChart, 
  CandlestickSeries, 
  type IChartApi, 
  type ISeriesApi, 
  type CandlestickData 
} from 'lightweight-charts';
import { aggregateCandles, type Candle, type Timeframe } from '../data/mockChart';

interface ChartCanvasProps {
  baseCandles: Candle[];
  visibleCount: number;
  animatedCandle: Candle | null;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  baseCandles,
  visibleCount,
  animatedCandle,
  timeframe,
  onTimeframeChange,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize TradingView canvas
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0b0e14' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: { mode: 0 },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#334155',
      },
      rightPriceScale: { borderColor: '#334155' },
    });

    // Modern v5 syntax using addSeries(CandlestickSeries, options)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data whenever timeframe or visible sequence changes
  useEffect(() => {
    if (!seriesRef.current) return;

    const currentBase = baseCandles.slice(0, visibleCount);
    const aggregated = aggregateCandles(currentBase, timeframe) as CandlestickData[];

    seriesRef.current.setData(aggregated);

    // Apply tick-by-tick animation update on top of current timeframe
    if (animatedCandle) {
      const liveAggregated = aggregateCandles([animatedCandle], timeframe)[0] as CandlestickData;
      seriesRef.current.update(liveAggregated);
    }
  }, [baseCandles, visibleCount, animatedCandle, timeframe]);

  return (
    <div className="relative w-full h-[550px] bg-[#0b0e14] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Timeframe selector toolbar */}
      <div className="absolute top-4 left-4 z-10 flex space-x-1 bg-slate-900/80 backdrop-blur p-1 rounded-lg border border-slate-800">
        {(['1m', '5m', '15m'] as Timeframe[]).map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              timeframe === tf
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>

      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};