import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type Time
} from 'lightweight-charts';
import { aggregateCandles, type Candle, type Timeframe } from '../data/mockChart';

interface ChartCanvasProps {
  baseCandles: Candle[];
  visibleCount: number;
  animatedCandle?: Candle | null;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  tpPrice: number | null;
  slPrice: number | null;
  onUpdateTpSl: (tp: number, sl: number) => void;
  isAnimating: boolean;
}

// 1. Updated Interface: Uses Time instead of Logical index
interface DrawnLine {
  id: string;
  startTime: Time;
  startPrice: number;
  endTime: Time;
  endPrice: number;
}

export const ChartCanvas: React.FC<ChartCanvasProps> = ({
  baseCandles,
  visibleCount,
  timeframe,
  onTimeframeChange,
  tpPrice,
  slPrice,
  onUpdateTpSl,
  isAnimating,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const tpLineRef = useRef<IPriceLine | null>(null);
  const slLineRef = useRef<IPriceLine | null>(null);

  const tpPriceRef = useRef(tpPrice);
  const slPriceRef = useRef(slPrice);
  tpPriceRef.current = tpPrice;
  slPriceRef.current = slPrice;

  const [tpY, setTpY] = useState<number | null>(null);
  const [slY, setSlY] = useState<number | null>(null);
  const isDraggingRef = useRef<'TP' | 'SL' | null>(null);

  const [, setTick] = useState(0);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [lines, setLines] = useState<DrawnLine[]>([]);
  const [currentLine, setCurrentLine] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

  // Store initial time anchor for active drawing line
  const drawStartRef = useRef<{ x: number; y: number; price: number; time: Time } | null>(null);

  const updateOverlayPositions = useCallback(() => {
    if (!seriesRef.current || !chartContainerRef.current) return;

    if (tpPriceRef.current !== null) {
      const y = seriesRef.current.priceToCoordinate(tpPriceRef.current);
      setTpY(y);
    }
    if (slPriceRef.current !== null) {
      const y = seriesRef.current.priceToCoordinate(slPriceRef.current);
      setSlY(y);
    }
    setTick((t) => t + 1);
  }, []);

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    const chart = createChart(container, {
      width,
      height,
      layout: { background: { color: '#09090b' }, textColor: '#71717a', attributionLogo: false },
      grid: { vertLines: { color: '#18181b' }, horzLines: { color: '#18181b' } },
      crosshair: { mode: 0 },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#27272a' },
      rightPriceScale: { borderColor: '#27272a' },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      requestAnimationFrame(updateOverlayPositions);
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(updateOverlayPositions);
    });

    const handlePointerMoveOrScroll = () => {
      requestAnimationFrame(updateOverlayPositions);
    };

    container.addEventListener('pointermove', handlePointerMoveOrScroll);
    container.addEventListener('wheel', handlePointerMoveOrScroll, { passive: true });
    container.addEventListener('touchmove', handlePointerMoveOrScroll, { passive: true });

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: w, height: h } = entries[0].contentRect;
      if (w > 0 && h > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width: w, height: h });
        requestAnimationFrame(updateOverlayPositions);
      }
    });

    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('pointermove', handlePointerMoveOrScroll);
      container.removeEventListener('wheel', handlePointerMoveOrScroll);
      container.removeEventListener('touchmove', handlePointerMoveOrScroll);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [updateOverlayPositions]);

  // 2. Update Data
  useEffect(() => {
    if (!seriesRef.current) return;

    const safeCount = Math.max(1, visibleCount);
    const currentBase = baseCandles.slice(0, safeCount);
    if (currentBase.length === 0) return;

    const aggregated = aggregateCandles(currentBase, timeframe) as CandlestickData[];
    seriesRef.current.setData(aggregated);

    requestAnimationFrame(() => {
      updateOverlayPositions();
    });
  }, [baseCandles, visibleCount, timeframe, updateOverlayPositions]);

  // 3. Render TP & SL Lines
  useEffect(() => {
    if (!seriesRef.current) return;

    if (tpPrice !== null) {
      if (tpLineRef.current) seriesRef.current.removePriceLine(tpLineRef.current);
      tpLineRef.current = seriesRef.current.createPriceLine({
        price: tpPrice,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'TP',
      });
    }

    if (slPrice !== null) {
      if (slLineRef.current) seriesRef.current.removePriceLine(slLineRef.current);
      slLineRef.current = seriesRef.current.createPriceLine({
        price: slPrice,
        color: '#f43f5e',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'SL',
      });
    }

    requestAnimationFrame(() => {
      updateOverlayPositions();
    });
  }, [tpPrice, slPrice, updateOverlayPositions]);

  const handlePointerDown = (type: 'TP' | 'SL') => (e: React.PointerEvent) => {
    if (isAnimating) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = type;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !seriesRef.current || !chartContainerRef.current) return;

    const rect = chartContainerRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const newPrice = seriesRef.current.coordinateToPrice(offsetY);

    if (newPrice !== null && tpPriceRef.current !== null && slPriceRef.current !== null) {
      const roundedPrice = Number(newPrice.toFixed(2));
      if (isDraggingRef.current === 'TP') {
        onUpdateTpSl(roundedPrice, slPriceRef.current);
      } else {
        onUpdateTpSl(tpPriceRef.current, roundedPrice);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      isDraggingRef.current = null;
    }
  };

  // Convert stored timestamp & price anchors back to current canvas X/Y
  // Helper to snap/find closest valid coordinate even if exact minute doesn't exist on current TF
const getLineCoordinates = (line: DrawnLine) => {
    if (!seriesRef.current || !chartRef.current) return null;
  
    const y1 = seriesRef.current.priceToCoordinate(line.startPrice);
    const y2 = seriesRef.current.priceToCoordinate(line.endPrice);
  
    const timeScale = chartRef.current.timeScale();
    
    // Try exact lookup first
    let x1 = timeScale.timeToCoordinate(line.startTime);
    let x2 = timeScale.timeToCoordinate(line.endTime);
  
    // Fallback: If timestamp doesn't exist on higher timeframe, fallback to logical index interpolation
    if (x1 === null) {
      const timeNum = typeof line.startTime === 'number' ? line.startTime : Number(line.startTime);
      // Find closest candle time in current aggregated series data
      const data = seriesRef.current.data();
      if (data.length > 0) {
        const closest = data.reduce((prev, curr) => {
          const prevTime = typeof prev.time === 'number' ? prev.time : Number(prev.time);
          const currTime = typeof curr.time === 'number' ? curr.time : Number(curr.time);
          return Math.abs(currTime - timeNum) < Math.abs(prevTime - timeNum) ? curr : prev;
        });
        x1 = timeScale.timeToCoordinate(closest.time);
      }
    }
  
    if (x2 === null) {
      const timeNum = typeof line.endTime === 'number' ? line.endTime : Number(line.endTime);
      const data = seriesRef.current.data();
      if (data.length > 0) {
        const closest = data.reduce((prev, curr) => {
          const prevTime = typeof prev.time === 'number' ? prev.time : Number(prev.time);
          const currTime = typeof curr.time === 'number' ? curr.time : Number(curr.time);
          return Math.abs(currTime - timeNum) < Math.abs(prevTime - timeNum) ? curr : prev;
        });
        x2 = timeScale.timeToCoordinate(closest.time);
      }
    }
  
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
  
    return { x1, y1, x2, y2 };
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingMode || !seriesRef.current || !chartRef.current) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const price = seriesRef.current.coordinateToPrice(y);
    const time = chartRef.current.timeScale().coordinateToTime(x);

    if (price === null || time === null) return;

    drawStartRef.current = { x, y, price, time };
    setCurrentLine({ startX: x, startY: y, endX: x, endY: y });
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingMode || !currentLine) return;
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentLine((prev) => (prev ? { ...prev, endX: x, endY: y } : null));
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingMode || !currentLine || !seriesRef.current || !chartRef.current) return;

    const startData = drawStartRef.current;

    if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }

    setCurrentLine(null);
    drawStartRef.current = null;

    if (!startData) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const endPrice = seriesRef.current.coordinateToPrice(y);
    const endTime = chartRef.current.timeScale().coordinateToTime(x);

    if (endPrice !== null && endTime !== null) {
      setLines((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          startTime: startData.time,
          startPrice: startData.price,
          endTime,
          endPrice,
        },
      ]);
    }
  };

  return (
    <div className="relative w-full h-[550px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden select-none">
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="flex space-x-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800">
          {(['1m', '5m', '15m'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              disabled={isAnimating}
              onClick={() => onTimeframeChange(tf)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                timeframe === tf
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsDrawingMode(!isDrawingMode)}
          className={`px-3 py-1 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${
            isDrawingMode
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
              : 'bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:text-zinc-200'
          }`}
        >
          ✏️ {isDrawingMode ? 'Drawing On' : 'Draw Line'}
        </button>

        {lines.length > 0 && (
          <button
            onClick={() => setLines([])}
            className="px-2 py-1 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors"
          >
            Clear Lines
          </button>
        )}
      </div>

      <div ref={chartContainerRef} className="w-full h-full" />

      <svg
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        style={{ touchAction: 'none' }}
        className={`absolute inset-0 w-full h-full z-10 touch-none ${
          isDrawingMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
        }`}
      >
        {lines.map((line) => {
          const coords = getLineCoordinates(line);
          if (!coords) return null;

          return (
            <line
              key={line.id}
              x1={coords.x1}
              y1={coords.y1}
              x2={coords.x2}
              y2={coords.y2}
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          );
        })}

        {currentLine && (
          <line
            x1={currentLine.startX}
            y1={currentLine.startY}
            x2={currentLine.endX}
            y2={currentLine.endY}
            stroke="#60a5fa"
            strokeWidth="2"
          />
        )}
      </svg>

      {!isAnimating && tpY !== null && tpY >= 0 && tpY <= 550 && (
        <div
          onPointerDown={handlePointerDown('TP')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ top: `${tpY - 14}px`, touchAction: 'none' }}
          className="absolute right-16 z-20 cursor-ns-resize touch-none select-none"
        >
          <div className="bg-emerald-950/90 border border-emerald-500/80 text-emerald-400 text-xs font-mono font-medium px-2 py-1 rounded shadow-lg flex items-center gap-1 active:scale-105 transition-transform">
            <span className="text-[10px] text-emerald-500">⋮⋮</span> Drag TP: ${tpPrice?.toFixed(2)}
          </div>
        </div>
      )}

      {!isAnimating && slY !== null && slY >= 0 && slY <= 550 && (
        <div
          onPointerDown={handlePointerDown('SL')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ top: `${slY - 14}px`, touchAction: 'none' }}
          className="absolute right-16 z-20 cursor-ns-resize touch-none select-none"
        >
          <div className="bg-rose-950/90 border border-rose-500/80 text-rose-400 text-xs font-mono font-medium px-2 py-1 rounded shadow-lg flex items-center gap-1 active:scale-105 transition-transform">
            <span className="text-[10px] text-rose-500">⋮⋮</span> Drag SL: ${slPrice?.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
};