import { useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { TrendingUp, TrendingDown, RefreshCw, Flame } from 'lucide-react';
import { ChartCanvas } from './components/ChartCanvas';
import { generateMockCandles, type Candle, type Timeframe } from './data/mockChart';

export default function App() {
  const [baseCandles, setBaseCandles] = useState<Candle[]>(() => generateMockCandles());
  const [visibleCount, setVisibleCount] = useState<number>(180); // Setup phase: first 180 candles
  const [animatedCandle, setAnimatedCandle] = useState<Candle | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  
  const [position, setPosition] = useState<'BUY' | 'SELL' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [streak, setStreak] = useState(0);

  const animationTimerRef = useRef<number | null>(null);

  // Trigger high-speed tick-by-tick live chart outcome animation
  const handleTrade = (choice: 'BUY' | 'SELL') => {
    setPosition(choice);
    setIsAnimating(true);

    let currentIndex = 180;
    const totalCandles = baseCandles.length;

    animationTimerRef.current = window.setInterval(() => {
      if (currentIndex < totalCandles) {
        const nextCandle = baseCandles[currentIndex];
        
        // Simulating sub-candle tick movement
        setAnimatedCandle(nextCandle);
        setVisibleCount((prev) => prev + 1);
        currentIndex++;
      } else {
        // Animation finished
        if (animationTimerRef.current) clearInterval(animationTimerRef.current);
        setAnimatedCandle(null);
        setIsAnimating(false);
        evaluateResult(choice);
      }
    }, 40); // 40ms interval for realistic fast-forward effect
  };

  const evaluateResult = (choice: 'BUY' | 'SELL') => {
    const entryPrice = baseCandles[179].close;
    const finalPrice = baseCandles[baseCandles.length - 1].close;

    const isWin = (choice === 'BUY' && finalPrice > entryPrice) || (choice === 'SELL' && finalPrice < entryPrice);

    if (isWin) {
      setStreak((prev) => prev + 1);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
      setStreak(0);
    }

    setShowModal(true);
  };

  const handleReset = () => {
    setShowModal(false);
    setPosition(null);
    setAnimatedCandle(null);
    setBaseCandles(generateMockCandles());
    setVisibleCount(180);
  };

  const entryPrice = baseCandles[179]?.close;
  const finalPrice = baseCandles[baseCandles.length - 1]?.close;
  const pnlPercent = entryPrice ? (((finalPrice - entryPrice) / entryPrice) * 100).toFixed(2) : "0.00";
  const isWin = position === 'BUY' ? finalPrice > entryPrice : finalPrice < entryPrice;

  return (
    <div className="min-h-screen flex flex-col items-center p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header Bar */}
      <header className="w-full flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Did I Win The Trade?
          </h1>
          <p className="text-xs text-slate-400">Read market structure. Predict the breakout.</p>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-slate-200">Streak: {streak}</span>
          </div>
        </div>
      </header>

      {/* Main Chart Area */}
      <main className="w-full space-y-4">
        <ChartCanvas
          baseCandles={baseCandles}
          visibleCount={visibleCount}
          animatedCandle={animatedCandle}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
        />

        {/* Action Controls */}
        <div className="flex justify-center items-center space-x-4">
          <button
            disabled={isAnimating || position !== null}
            onClick={() => handleTrade('BUY')}
            className="flex-1 max-w-xs py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-lg rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 transition-all active:scale-95"
          >
            <TrendingUp className="w-6 h-6" />
            <span>BUY / LONG</span>
          </button>

          <button
            disabled={isAnimating || position !== null}
            onClick={() => handleTrade('SELL')}
            className="flex-1 max-w-xs py-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-lg rounded-xl shadow-lg shadow-rose-950/40 flex items-center justify-center space-x-2 transition-all active:scale-95"
          >
            <TrendingDown className="w-6 h-6" />
            <span>SELL / SHORT</span>
          </button>
        </div>
      </main>

      {/* Outcome Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="space-y-2">
              <span className="text-4xl">{isWin ? '🎯' : '❌'}</span>
              <h2 className="text-2xl font-black text-white">
                {isWin ? 'TRADE WON!' : 'TRADE LOST'}
              </h2>
              <p className="text-slate-400 text-sm">
                Position: <span className="font-bold text-slate-200">{position}</span> | Result: {' '}
                <span className={`font-bold ${Number(pnlPercent) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {pnlPercent}%
                </span>
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-left space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Entry Price (Candle 180):</span>
                <span className="text-slate-200 font-mono">${entryPrice}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Exit Price (Candle 250):</span>
                <span className="text-slate-200 font-mono">${finalPrice}</span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center space-x-2 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Next Mystery Chart</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}