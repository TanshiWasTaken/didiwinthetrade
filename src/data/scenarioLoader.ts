export interface Candle {
    time: number; // UNIX timestamp in SECONDS
    open: number;
    high: number;
    low: number;
    close: number;
  }
  
  export type Timeframe = '1m' | '5m' | '15m';
  
  export interface Scenario {
    id: string;
    title: string;
    asset: string;
    defaultTimeframe: Timeframe;
    entryIndex: number;
    expirationOffset: number;
    category: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    tags: string[];
    description: string;
    candles: Candle[]; // Pre-parsed/pre-sliced candles included in scenario payload
  }
  
  // Lightweight converter: converts millisecond timestamps to UNIX seconds on-the-fly
  export function parseToUnixSeconds(rawTime: any): number {
    if (typeof rawTime === 'number') {
      return rawTime > 20000000000 ? Math.floor(rawTime / 1000) : rawTime;
    }
    if (typeof rawTime === 'string') {
      const parsed = new Date(rawTime).getTime();
      return isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
    }
    return 0;
  }
  
  /**
   * Parses raw JSON candles on demand for lightweight rendering.
   * Does NOT store or cache anything in browser memory.
   */
  export function formatCandles(rawCandles: any[]): Candle[] {
    if (!Array.isArray(rawCandles)) return [];
    
    return rawCandles
      .map((c) => ({
        time: parseToUnixSeconds(c.timestamp ?? c.time),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }))
      .filter((c) => c.time > 0 && !isNaN(c.close))
      .sort((a, b) => a.time - b.time);
  }
  
  /**
   * Fetch ONLY scenario metadata / parsed scenario JSON files.
   * Zero caching. Direct network request per interaction.
   */
  export async function fetchScenarios(category: 'fvg' | 'liquidity_sweep'): Promise<Scenario[]> {
    const response = await fetch(`/data/XAUUSD/output/${category}.json`, {
      cache: 'no-store' // Enforce no browser caching
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load ${category} scenarios.`);
    }
  
    const scenarios: Scenario[] = await response.json();
    
    // Format timestamps on the fly without caching globally
    return scenarios.map((scenario) => ({
      ...scenario,
      candles: scenario.candles ? formatCandles(scenario.candles) : [],
    }));
  }
  
  /**
   * Aggregates 1m candles into higher timeframes on the fly
   */
  export function aggregateCandles(candles: Candle[], timeframe: Timeframe): Candle[] {
    if (!candles || candles.length === 0) return [];
    if (timeframe === '1m') return candles;
  
    const intervalSeconds = (timeframe === '5m' ? 5 : 15) * 60;
    const aggregated: Candle[] = [];
    let currentBucket: Candle | null = null;
  
    for (const candle of candles) {
      const bucketTime = Math.floor(candle.time / intervalSeconds) * intervalSeconds;
  
      if (!currentBucket || currentBucket.time !== bucketTime) {
        if (currentBucket) aggregated.push(currentBucket);
        currentBucket = {
          time: bucketTime,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        };
      } else {
        currentBucket.high = Math.max(currentBucket.high, candle.high);
        currentBucket.low = Math.min(currentBucket.low, candle.low);
        currentBucket.close = candle.close;
      }
    }
  
    if (currentBucket) aggregated.push(currentBucket);
    return aggregated;
  }