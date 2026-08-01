import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { TrendingUp, TrendingDown, RefreshCw, Flame, ShieldAlert, Target, BarChart3 } from 'lucide-react';
import { ChartCanvas } from './components/ChartCanvas';
import { generateMockCandles, type Candle, type Timeframe } from './data/mockChart';

const MIN_RR = 1.5;

export default function App() {
  const [baseCandles, setBaseCandles] = useState<Candle[]>(() => generateMockCandles(2500));
  const [visibleCount, setVisibleCount] = useState<number>(1800);
  const [animatedCandle, setAnimatedCandle] = useState<Candle | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');

  const [position, setPosition] = useState<'BUY' | 'SELL' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [gameResult, setGameResult] = useState<{ win: boolean; reason: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const [roundId, setRoundId] = useState<number>(1);

  const entryPrice = baseCandles[1799]?.close || 2000;
  const [tpPrice, setTpPrice] = useState<number>(() => Number((entryPrice + 12.0).toFixed(2)));
  const [slPrice, setSlPrice] = useState<number>(() => Number((entryPrice - 6.0).toFixed(2)));

  const animationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const currentEntry = baseCandles[1799]?.close || 2000;
    setTpPrice(Number((currentEntry + 12.0).toFixed(2)));
    setSlPrice(Number((currentEntry - 6.0).toFixed(2)));
  }, [baseCandles]);

  const calculateRR = (choice: 'BUY' | 'SELL') => {
    if (choice === 'BUY') {
      const reward = tpPrice - entryPrice;
      const risk = entryPrice - slPrice;
      if (risk <= 0 || reward <= 0) return 0;
      return reward / risk;
    } else {
      const reward = entryPrice - tpPrice;
      const risk = slPrice - entryPrice;
      if (risk <= 0 || reward <= 0) return 0;
      return reward / risk;
    }
  };

  const buyRR = calculateRR('BUY');
  const sellRR = calculateRR('SELL');

  const handleTrade = (choice: 'BUY' | 'SELL') => {
    const activeRR = calculateRR(choice);
    if (activeRR < MIN_RR) return;

    setPosition(choice);
    setIsAnimating(true);

    const stepSize = timeframe === '15m' ? 15 : timeframe === '5m' ? 5 : 1;
    let currentIndex = 1800;
    const intervalMs = timeframe === '1m' ? 50 : timeframe === '5m' ? 80 : 120;

    animationTimerRef.current = window.setInterval(() => {
      if (currentIndex < baseCandles.length) {
        const nextCandle = baseCandles[currentIndex];
        setAnimatedCandle(nextCandle);
        setVisibleCount(currentIndex);

        let hitResult: { win: boolean; reason: string } | null = null;

        if (choice === 'BUY') {
          if (nextCandle.high >= tpPrice) {
            hitResult = { win: true, reason: 'Take Profit Hit' };
          } else if (nextCandle.low <= slPrice) {
            hitResult = { win: false, reason: 'Stop Loss Hit' };
          }
        } else {
          if (nextCandle.low <= tpPrice) {
            hitResult = { win: true, reason: 'Take Profit Hit' };
          } else if (nextCandle.high >= slPrice) {
            hitResult = { win: false, reason: 'Stop Loss Hit' };
          }
        }

        if (hitResult) {
          if (animationTimerRef.current) clearInterval(animationTimerRef.current);
          setAnimatedCandle(null);
          setIsAnimating(false);
          finishGame(hitResult);
          return;
        }

        currentIndex += stepSize;
      } else {
        if (animationTimerRef.current) clearInterval(animationTimerRef.current);
        setAnimatedCandle(null);
        setIsAnimating(false);

        const finalPrice = baseCandles[baseCandles.length - 1].close;
        const won = choice === 'BUY' ? finalPrice > entryPrice : finalPrice < entryPrice;
        finishGame({
          win: won,
          reason: won ? 'Time Expired — In Profit' : 'Time Expired — In Drawdown',
        });
      }
    }, intervalMs);
  };

  const TIMEFRAME_STEPS: Record<Timeframe, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
  };
  
  useEffect(() => {
    if (!isAnimating) return;
  
    const totalCandles = baseCandles.length; // 👈 Get total candles count
  
    const interval = setInterval(() => {
      setVisibleCount((prev) => {
        const step = TIMEFRAME_STEPS[timeframe];
        const nextCount = prev + step;
  
        if (nextCount >= totalCandles) {
          setIsAnimating(false);
          clearInterval(interval);
          return totalCandles;
        }
        return nextCount;
      });
    }, 100);
  
    return () => clearInterval(interval);
  }, [isAnimating, timeframe, baseCandles.length]);

  const finishGame = (result: { win: boolean; reason: string }) => {
    setGameResult(result);
    if (result.win) {
      setStreak((prev) => prev + 1);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.55 },
        colors: ['#10b981', '#34d399', '#a3e635'],
      });
    } else {
      setStreak(0);
    }
    setShowModal(true);
  };

  const handleReset = () => {
    setShowModal(false);
    setPosition(null);
    setGameResult(null);
    setAnimatedCandle(null);
    setBaseCandles(generateMockCandles(2500));
    setVisibleCount(1800);
    setRoundId((prev) => prev + 1);
  };

  const updateTpSl = (newTp: number, newSl: number) => {
    setTpPrice(newTp);
    setSlPrice(newSl);
  };

  // Keyboard shortcuts — mirrors the kbd hints rendered on the buttons below
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if (showModal) {
        if (key === 'r' || e.key === 'Enter') {
          e.preventDefault();
          handleReset();
        }
        return;
      }

      if (isAnimating || position !== null) return;

      if (key === 'b' && buyRR >= MIN_RR) {
        e.preventDefault();
        handleTrade('BUY');
      } else if (key === 's' && sellRR >= MIN_RR) {
        e.preventDefault();
        handleTrade('SELL');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, isAnimating, position, buyRR, sellRR]);

  // ───────── R:R Badge ─────────
  const RrBadge = ({ rr, side }: { rr: number; side: 'BUY' | 'SELL' }) => {
    const isValid = rr >= MIN_RR;
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border ${
          isValid
            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
            : 'bg-zinc-900 text-zinc-500 border-zinc-800'
        }`}
      >
        <span className={`text-[9px] font-medium tracking-wider ${side === 'BUY' ? 'text-green-400' : 'text-red-400'} uppercase opacity-70`}>
          {side}
        </span>
        <span className="font-mono tabular-nums tracking-tight">{rr.toFixed(2)}</span>
        {!isValid && <ShieldAlert className="w-3 h-3" />}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center">
      <div className="w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center">
        
        {/* ───────── Header ───────── */}
        <header className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
                Did I Win The Trade?
              </h1>
              <p className="text-[11px] text-zinc-500">
                Drag the TP/SL labels on the right chart edge
              </p>
            </div>
          </div>
  
          {/* Streak badge */}
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-md px-2.5 py-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500/80" />
            <span className="font-mono text-xs font-semibold text-zinc-200 tabular-nums">{streak}</span>
            <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Streak</span>
          </div>
        </header>
  
        {/* ───────── Main Content ───────── */}
        <main className="w-full space-y-4">
          {/* Chart Panel */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <ChartCanvas
              key={roundId}
              baseCandles={baseCandles}
              visibleCount={visibleCount}
              animatedCandle={animatedCandle}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              tpPrice={tpPrice}
              slPrice={slPrice}
              onUpdateTpSl={updateTpSl}
              isAnimating={isAnimating}
            />
          </div>
  
          {/* ───────── Trade Panel ───────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            {/* Entry info row */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Entry</span>
              </div>
              <span className="font-mono text-sm font-semibold text-zinc-100 tabular-nums tracking-tight">
                ${entryPrice.toFixed(2)}
              </span>
            </div>
  
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              {/* ─── BUY ─── */}
              <div className="space-y-3">
                <button
                  disabled={isAnimating || position !== null || buyRR < MIN_RR}
                  onClick={() => handleTrade('BUY')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="tracking-wide">BUY / LONG</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                    B
                  </kbd>
                </button>
                <div className="flex items-center justify-between px-0.5">
                  <RrBadge rr={buyRR} side="BUY" />
                  <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                    TP ${tpPrice.toFixed(2)}
                  </span>
                </div>
              </div>
  
              {/* ─── SELL ─── */}
              <div className="space-y-3">
                <button
                  disabled={isAnimating || position !== null || sellRR < MIN_RR}
                  onClick={() => handleTrade('SELL')}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                >
                  <TrendingDown className="w-4 h-4" />
                  <span className="tracking-wide">SELL / SHORT</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
                    S
                  </kbd>
                </button>
                <div className="flex items-center justify-between px-0.5">
                  <RrBadge rr={sellRR} side="SELL" />
                  <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                    SL ${slPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
  
        {/* ───────── Outcome Modal ───────── */}
        {showModal && gameResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60" onClick={handleReset} />
  
            {/* Modal card */}
            <div className="relative z-10 w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center space-y-6">
              {/* Result icon */}
              <div className="flex justify-center">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl border ${
                    gameResult.win
                      ? 'bg-emerald-950/40 border-emerald-800/50'
                      : 'bg-rose-950/40 border-rose-800/50'
                  }`}
                >
                  {gameResult.win ? '🎯' : '✕'}
                </div>
              </div>
  
              <div className="space-y-1">
                <h2
                  className={`text-lg font-semibold tracking-tight ${
                    gameResult.win ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {gameResult.win ? 'TRADE WON' : 'TRADE LOST'}
                </h2>
                <p className="text-[13px] text-zinc-500">{gameResult.reason}</p>
              </div>
  
              {/* Stats card */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-left space-y-3">
                {[
                  { label: 'Entry', value: `$${entryPrice.toFixed(2)}`, color: 'text-zinc-300' },
                  { label: 'Take Profit', value: `$${tpPrice.toFixed(2)}`, color: 'text-emerald-400' },
                  { label: 'Stop Loss', value: `$${slPrice.toFixed(2)}`, color: 'text-rose-400' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                      {row.label}
                    </span>
                    <span className={`font-mono text-sm font-semibold tabular-nums tracking-tight ${row.color}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
  
              <button
                onClick={handleReset}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="tracking-wide">Next Mystery Chart</span>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-900 text-zinc-500 rounded border border-zinc-700">
                  R
                </kbd>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}