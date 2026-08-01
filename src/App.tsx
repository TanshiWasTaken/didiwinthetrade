import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Flame,
  ShieldAlert,
  Target,
  Copy,
  Check,
} from 'lucide-react';
import { ChartCanvas } from './components/ChartCanvas';
import { generateMockCandles, type Candle, type Timeframe } from './data/mockChart';

const MIN_RR = 1.5;
const FUTURE_HORIZON_CANDLES = 80;
const ANIMATION_DURATION_MS = 5000;

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
  const [bestStreak, setBestStreak] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [roundId, setRoundId] = useState<number>(1);
  const [copied, setCopied] = useState(false);

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

    const startIndex = 1800;
    const endIndex = Math.min(baseCandles.length, startIndex + FUTURE_HORIZON_CANDLES);
    const totalSteps = endIndex - startIndex;

    const tickInterval = Math.max(20, Math.floor(ANIMATION_DURATION_MS / totalSteps));
    let currentIndex = startIndex;

    animationTimerRef.current = window.setInterval(() => {
      if (currentIndex < endIndex) {
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

        currentIndex += 1;
      } else {
        if (animationTimerRef.current) clearInterval(animationTimerRef.current);
        setAnimatedCandle(null);
        setIsAnimating(false);

        const finalPrice = baseCandles[endIndex - 1]?.close || entryPrice;
        const won = choice === 'BUY' ? finalPrice > entryPrice : finalPrice < entryPrice;
        finishGame({
          win: won,
          reason: won ? 'Time Expired — In Profit' : 'Time Expired — In Drawdown',
        });
      }
    }, tickInterval);
  };

  const finishGame = (result: { win: boolean; reason: string }) => {
    setGameResult(result);
    setGamesPlayed((prev) => prev + 1);

    if (result.win) {
      setStreak((prev) => {
        const next = prev + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
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
    setCopied(false);
  };

  const updateTpSl = (newTp: number, newSl: number) => {
    setTpPrice(newTp);
    setSlPrice(newSl);
  };

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
  }, [showModal, isAnimating, position, buyRR, sellRR]);

  const RrBadge = ({ rr, side }: { rr: number; side: 'BUY' | 'SELL' }) => {
    const isValid = rr >= MIN_RR;
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border ${
          isValid ? 'bg-[#17171a] border-emerald-700' : 'bg-[#17171a] border-zinc-800'
        }`}
      >
        <span
          className={`text-[10px] font-bold tracking-wider uppercase ${
            side === 'BUY' ? 'text-emerald-500' : 'text-rose-500'
          }`}
        >
          {side}
        </span>
        <span
          className={`font-mono font-bold tabular-nums tracking-tight text-sm ${
            isValid ? 'text-zinc-100' : 'text-zinc-500'
          }`}
        >
          {rr.toFixed(2)}
        </span>
        {!isValid && <ShieldAlert className="w-3.5 h-3.5 text-zinc-500" />}
      </div>
    );
  };

  const StatTile = ({ label, value, flame }: { label: string; value: number; flame?: boolean }) => (
    <div className="bg-[#17171a] border border-zinc-800 rounded-sm px-3 py-2.5 flex flex-col items-center">
      <div className="flex items-center gap-1">
        {flame && <Flame className="w-3.5 h-3.5 text-amber-500" />}
        <span className="font-mono text-lg font-bold text-zinc-100 tabular-nums leading-none">{value}</span>
      </div>
      <span className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase mt-1">{label}</span>
    </div>
  );

  return (
    <div className="w-full h-screen bg-[#0b0b0c] text-zinc-100 flex flex-col items-center justify-center overflow-hidden">
      <div className="w-full max-w-2xl px-4 py-4 sm:px-6 flex flex-col items-center justify-between h-full max-h-screen">
        <header className="w-full mb-3 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-6 bg-emerald-500 rounded-sm shrink-0" />
            <h1 className="text-2xl sm:text-[28px] font-black tracking-tight uppercase text-zinc-100 leading-none">
              Did I Win The Trade?
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 pl-3.5 text-[11px] text-zinc-500">
            <span className="font-mono uppercase tracking-wider">Round #{roundId}</span>
            <span className="text-zinc-700">·</span>
            <span>Drag TP/SL on the chart edge</span>
          </div>
        </header>

        <div className="w-full grid grid-cols-3 gap-2 mb-3 shrink-0">
          <StatTile label="Streak" value={streak} flame />
          <StatTile label="Best" value={bestStreak} />
          <StatTile label="Played" value={gamesPlayed} />
        </div>

        <main className="w-full flex-1 flex flex-col gap-3 min-h-0">
          <div className="rounded-sm border-2 border-zinc-800 bg-[#17171a] overflow-hidden flex-1 min-h-0">
            <ChartCanvas
              key={roundId}
              baseCandles={baseCandles}
              visibleCount={visibleCount}
              animatedCandle={animatedCandle}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              entryPrice={entryPrice}
              tpPrice={tpPrice}
              slPrice={slPrice}
              onUpdateTpSl={updateTpSl}
              isAnimating={isAnimating}
              expirationIndex={1800 + FUTURE_HORIZON_CANDLES}
            />
          </div>

          <div className="rounded-sm border-2 border-zinc-800 bg-[#17171a] p-4 shrink-0">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">Entry</span>
              </div>
              <span className="font-mono text-base font-bold text-zinc-100 tabular-nums tracking-tight">
                ${entryPrice.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <button
                  disabled={isAnimating || position !== null || buyRR < MIN_RR}
                  onClick={() => handleTrade('BUY')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wider rounded-sm border-2 border-emerald-700 flex items-center justify-center gap-2 transition-transform active:translate-y-0.5"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Buy / Long</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-black/25 text-white/80 rounded-sm border border-white/20">
                    B
                  </kbd>
                </button>
                <div className="flex items-center justify-between px-0.5">
                  <RrBadge rr={buyRR} side="BUY" />
                  <span className="text-[11px] text-zinc-500 font-mono font-bold tabular-nums">
                    TP ${tpPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  disabled={isAnimating || position !== null || sellRR < MIN_RR}
                  onClick={() => handleTrade('SELL')}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wider rounded-sm border-2 border-rose-700 flex items-center justify-center gap-2 transition-transform active:translate-y-0.5"
                >
                  <TrendingDown className="w-4 h-4" />
                  <span>Sell / Short</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-black/25 text-white/80 rounded-sm border border-white/20">
                    S
                  </kbd>
                </button>
                <div className="flex items-center justify-between px-0.5">
                  <RrBadge rr={sellRR} side="SELL" />
                  <span className="text-[11px] text-zinc-500 font-mono font-bold tabular-nums">
                    SL ${slPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {showModal &&
          gameResult &&
          (() => {
            const finalPrice = baseCandles[visibleCount]?.close || entryPrice;
            const initialRisk = Math.abs(entryPrice - slPrice);
            const plannedTargetRR = position ? calculateRR(position) : 1;

            let realizedRR = 0;

            if (gameResult.reason.startsWith('Take Profit')) {
              realizedRR = plannedTargetRR;
            } else if (gameResult.reason.startsWith('Stop Loss')) {
              realizedRR = -1.0;
            } else {
              const pnl = position === 'BUY' ? finalPrice - entryPrice : entryPrice - finalPrice;
              realizedRR = initialRisk > 0 ? pnl / initialRisk : 0;
            }

            let squareCount = 1;

            if (gameResult.win) {
              squareCount = Math.min(5, Math.max(1, Math.floor(realizedRR)));
            } else {
              const lossSeverity = Math.abs(realizedRR);
              squareCount = Math.max(1, Math.min(5, Math.round(lossSeverity * 5)));
            }

            const tiles: ('win' | 'loss' | 'empty')[] = gameResult.win
              ? Array.from({ length: 5 }, (_, i) => (i < squareCount ? 'win' : 'empty'))
              : Array.from({ length: 5 }, (_, i) => (i < squareCount ? 'loss' : 'empty'));

            const emojiRow = tiles
              .map((t) => (t === 'win' ? '🟩' : t === 'loss' ? '🟥' : '⬜'))
              .join('');

            const formattedR = realizedRR >= 0 ? `+${realizedRR.toFixed(2)}R` : `${realizedRR.toFixed(2)}R`;

            const shareText = `Did I Win The Trade? #${roundId}\n${emojiRow} ${
              gameResult.win ? 'WON' : 'LOST'
            } · ${position}\n${formattedR} · 🔥 Streak: ${streak}\ndidiwinthetrade.com`;

            const handleCopyResult = async () => {
              try {
                await navigator.clipboard.writeText(shareText);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              } catch {
                // fallback
              }
            };

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70" onClick={handleReset} />

                <div className="relative z-10 w-full max-w-sm rounded-sm border-2 border-zinc-700 bg-[#17171a] p-6 text-center space-y-5">
                  <div className="flex justify-center">
                    <div
                      className={`w-14 h-14 rounded-sm border-2 flex items-center justify-center text-2xl font-bold text-white ${
                        gameResult.win
                          ? 'bg-emerald-600 border-emerald-700'
                          : 'bg-rose-600 border-rose-700'
                      }`}
                    >
                      {gameResult.win ? '✓' : '✕'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h2
                      className={`text-xl font-extrabold tracking-wider uppercase ${
                        gameResult.win ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {gameResult.win ? 'Trade Won' : 'Trade Lost'}
                    </h2>
                    <p className="text-[13px] text-zinc-500">{gameResult.reason}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-1.5">
                      {tiles.map((t, i) => (
                        <div
                          key={i}
                          className={`w-9 h-9 rounded-sm ${
                            t === 'win'
                              ? 'bg-emerald-600'
                              : t === 'loss'
                              ? 'bg-rose-600'
                              : 'bg-[#0b0b0c] border border-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                      {position} · {formattedR}
                    </p>
                  </div>

                  <div className="bg-[#0b0b0c] border border-zinc-800 rounded-sm p-4 text-left space-y-3">
                    {[
                      { label: 'Entry', value: `$${entryPrice.toFixed(2)}`, color: 'text-zinc-100' },
                      { label: 'Take Profit', value: `$${tpPrice.toFixed(2)}`, color: 'text-emerald-500' },
                      { label: 'Stop Loss', value: `$${slPrice.toFixed(2)}`, color: 'text-rose-500' },
                      {
                        label: 'Exit Price',
                        value: `$${finalPrice.toFixed(2)}`,
                        color: gameResult.win ? 'text-emerald-400' : 'text-rose-400',
                      },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center">
                        <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                          {row.label}
                        </span>
                        <span className={`font-mono text-sm font-bold tabular-nums tracking-tight ${row.color}`}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleCopyResult}
                      className="py-3 bg-zinc-100 hover:bg-white border-2 border-zinc-100 text-zinc-950 font-bold text-sm uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 transition-transform active:translate-y-0.5"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copied' : 'Copy Result'}</span>
                    </button>
                    <button
                      onClick={handleReset}
                      className="py-3 bg-transparent hover:bg-zinc-800/60 border-2 border-zinc-700 text-zinc-100 font-bold text-sm uppercase tracking-wider rounded-sm flex items-center justify-center gap-2 transition-transform active:translate-y-0.5"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Next</span>
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-black/30 text-zinc-400 rounded-sm border border-zinc-700">
                        R
                      </kbd>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}