import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to resolve paths in Node ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CONFIGURATION PARAMETERS (XAUUSD / GOLD)
// ==========================================
const ASSET = 'XAUUSD';
const MIN_GAP_SIZE = 1.25;       // Minimum FVG size in USD ($1.25)
const MAX_GAP_SIZE = 8.00;       // Maximum gap size to filter out extreme news spikes
const SWEEP_LOOKBACK = 40;       // Lookback periods for Highs/Lows
const MIN_WICK_PERCENT = 0.55;   // Wick must be at least 55% of total candle length
const EXPIRATION_OFFSET = 15;    // Round resolves 15 base candles after entry
const EMA_PERIOD = 50;           // Trend determination lookback

const candlesPath = path.join(__dirname, '../raw/xauusd-m1-bid-2020-01-01-2025-12-31.json');
const outputDir = path.join(__dirname, '../output');

if (!fs.existsSync(candlesPath)) {
  console.error(`❌ Error: Please place your raw 1m XAUUSD candles at ${candlesPath}`);
  process.exit(1);
}

const candles = JSON.parse(fs.readFileSync(candlesPath, 'utf8'));
console.log(`🔍 Scanning ${candles.length} real XAUUSD candles with quantitative filters...`);

const fvgScenarios = [];
const sweepScenarios = [];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Calculates Exponential Moving Average (EMA) for trend filtering
function calculateEMA(candleSlice, period) {
  const k = 2 / (period + 1);
  let ema = candleSlice[0].close;
  for (let i = 1; i < candleSlice.length; i++) {
    ema = (candleSlice[i].close * k) + (ema * (1 - k));
  }
  return ema;
}

// Calculates average candle body size to detect news spikes
function getAvgBodySize(candleSlice) {
  const sum = candleSlice.reduce((acc, c) => acc + Math.abs(c.close - c.open), 0);
  return sum / candleSlice.length;
}

// ==========================================
// 1. FAIR VALUE GAP SCANNER (WITH FILTERS)
// ==========================================
function scanFVGs() {
  let count = 0;

  for (let i = EMA_PERIOD; i < candles.length - EXPIRATION_OFFSET - 50; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1]; // Imbalance candle
    const c3 = candles[i];     // Gap formation candle

    // Filter 1: Check against news spike traps (Candle body anomaly check)
    const recentAvgBody = getAvgBodySize(candles.slice(i - 20, i - 2));
    const gappingBody = Math.abs(c2.close - c2.open);
    if (gappingBody > recentAvgBody * 3.5) {
      continue; // Skip extreme volatility/news spikes
    }

    // Filter 2: Calculate 50 EMA trend direction
    const currentEMA = calculateEMA(candles.slice(i - EMA_PERIOD, i), EMA_PERIOD);

    // --- BULLISH FVG ---
    if (c3.low > c1.high) {
      const gapSize = c3.low - c1.high;

      if (gapSize >= MIN_GAP_SIZE && gapSize <= MAX_GAP_SIZE) {
        // Trend Filter: Prefer setups aligning with EMA uptrend
        const isWithTrend = c3.close > currentEMA;

        // Dynamic Entry Alignment: Find exact retest candle j where price dips into gap
        const gapTop = c3.low;
        const gapBottom = c1.high;
        let retestIndex = -1;

        for (let j = i + 1; j < Math.min(i + 40, candles.length - EXPIRATION_OFFSET); j++) {
          if (candles[j].low <= gapTop && candles[j].high >= gapBottom) {
            retestIndex = j;
            break;
          }
        }

        // Only record scenario if an actual retest occurred
        if (retestIndex !== -1) {
          // Outcome Validation: Evaluate if trade won or failed to grade difficulty
          const futureCandles = candles.slice(retestIndex, retestIndex + EXPIRATION_OFFSET);
          const maxFutureHigh = Math.max(...futureCandles.map((c) => c.high));
          const entryPrice = candles[retestIndex].close;
          const isSuccessfulReversion = maxFutureHigh > entryPrice + (gapSize * 0.5);

          fvgScenarios.push({
            id: `xauusd-fvg-bullish-${retestIndex}`,
            title: `Bullish Fair Value Gap Retest`,
            asset: ASSET,
            defaultTimeframe: '5m',
            entryIndex: retestIndex, // Exact retest touch point!
            expirationOffset: EXPIRATION_OFFSET,
            category: 'Smart Money Concepts',
            difficulty: isSuccessfulReversion && isWithTrend ? 'Easy' : 'Hard',
            tags: ['fvg', 'bullish', isWithTrend ? 'trend-continuation' : 'counter-trend'],
            description: `Price retested a $${gapSize.toFixed(2)} Bullish FVG zone on Gold. ${
              isWithTrend ? 'Aligned with 50 EMA overall trend.' : 'Counter-trend scenario.'
            }`
          });

          count++;
          i = retestIndex + 15; // Jump forward to avoid duplicate scenario clusters
        }
      }
    }

    // --- BEARISH FVG ---
    if (c3.high < c1.low) {
      const gapSize = c1.low - c3.high;

      if (gapSize >= MIN_GAP_SIZE && gapSize <= MAX_GAP_SIZE) {
        const isWithTrend = c3.close < currentEMA;

        const gapTop = c1.low;
        const gapBottom = c3.high;
        let retestIndex = -1;

        for (let j = i + 1; j < Math.min(i + 40, candles.length - EXPIRATION_OFFSET); j++) {
          if (candles[j].high >= gapBottom && candles[j].low <= gapTop) {
            retestIndex = j;
            break;
          }
        }

        if (retestIndex !== -1) {
          const futureCandles = candles.slice(retestIndex, retestIndex + EXPIRATION_OFFSET);
          const minFutureLow = Math.min(...futureCandles.map((c) => c.low));
          const entryPrice = candles[retestIndex].close;
          const isSuccessfulReversion = minFutureLow < entryPrice - (gapSize * 0.5);

          fvgScenarios.push({
            id: `xauusd-fvg-bearish-${retestIndex}`,
            title: `Bearish Fair Value Gap Retest`,
            asset: ASSET,
            defaultTimeframe: '5m',
            entryIndex: retestIndex,
            expirationOffset: EXPIRATION_OFFSET,
            category: 'Smart Money Concepts',
            difficulty: isSuccessfulReversion && isWithTrend ? 'Easy' : 'Hard',
            tags: ['fvg', 'bearish', isWithTrend ? 'trend-continuation' : 'counter-trend'],
            description: `Price retested a $${gapSize.toFixed(2)} Bearish FVG zone on Gold. ${
              isWithTrend ? 'Aligned with 50 EMA overall trend.' : 'Counter-trend scenario.'
            }`
          });

          count++;
          i = retestIndex + 15;
        }
      }
    }
  }

  console.log(`  ✓ Found ${count} refined Fair Value Gap setups.`);
}

// ==========================================
// 2. LIQUIDITY SWEEP SCANNER
// ==========================================
function scanLiquiditySweeps() {
  let count = 0;

  for (let i = SWEEP_LOOKBACK; i < candles.length - EXPIRATION_OFFSET - 5; i++) {
    const current = candles[i];
    const range = candles.slice(i - SWEEP_LOOKBACK, i);
    const highestHigh = Math.max(...range.map((c) => c.high));
    const lowestLow = Math.min(...range.map((c) => c.low));

    const totalRange = current.high - current.low;
    if (totalRange === 0) continue;

    const upperWick = current.high - Math.max(current.open, current.close);
    const lowerWick = Math.min(current.open, current.close) - current.low;

    // Bearish Sweep (Swept Highs then rejected back inside)
    if (current.high > highestHigh && current.close < highestHigh) {
      if ((upperWick / totalRange) >= MIN_WICK_PERCENT) {
        sweepScenarios.push({
          id: `xauusd-sweep-bearish-${i}`,
          title: `Liquidity Sweep (Highs Swept)`,
          asset: ASSET,
          defaultTimeframe: '1m',
          entryIndex: i, // Entry point set at the close of the rejection candle
          expirationOffset: EXPIRATION_OFFSET,
          category: 'Market Structure',
          difficulty: 'Medium',
          tags: ['liquidity-sweep', 'rejection', 'stop-hunt'],
          description: `Price swept the ${SWEEP_LOOKBACK}-period high at $${highestHigh.toFixed(2)} with a heavy rejection wick.`
        });

        count++;
        i += 25;
      }
    }

    // Bullish Sweep (Swept Lows then rejected back inside)
    if (current.low < lowestLow && current.close > lowestLow) {
      if ((lowerWick / totalRange) >= MIN_WICK_PERCENT) {
        sweepScenarios.push({
          id: `xauusd-sweep-bullish-${i}`,
          title: `Liquidity Sweep (Lows Swept)`,
          asset: ASSET,
          defaultTimeframe: '1m',
          entryIndex: i,
          expirationOffset: EXPIRATION_OFFSET,
          category: 'Market Structure',
          difficulty: 'Medium',
          tags: ['liquidity-sweep', 'rejection', 'stop-hunt'],
          description: `Price broke under the ${SWEEP_LOOKBACK}-period low at $${lowestLow.toFixed(2)} before springing back up.`
        });

        count++;
        i += 25;
      }
    }
  }

  console.log(`  ✓ Found ${count} Liquidity Sweep setups.`);
}

// Execute Scans
scanFVGs();
scanLiquiditySweeps();

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Export separate JSON files
fs.writeFileSync(path.join(outputDir, 'fvg.json'), JSON.stringify(fvgScenarios, null, 2));
fs.writeFileSync(path.join(outputDir, 'liquidity_sweep.json'), JSON.stringify(sweepScenarios, null, 2));

console.log(`\n✅ Generated output files in ${outputDir}:`);
console.log(`   - fvg.json (${fvgScenarios.length} scenarios)`);
console.log(`   - liquidity_sweep.json (${sweepScenarios.length} scenarios)`);