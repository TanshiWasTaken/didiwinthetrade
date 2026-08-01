export interface Candle {
    time: number; // Unix timestamp in seconds
    open: number;
    high: number;
    low: number;
    close: number;
  }
  
  export type Timeframe = '1m' | '5m' | '15m';
  
  // Helper to aggregate 1-minute base candles into higher timeframes (5m, 15m)
  export function aggregateCandles(candles: Candle[], timeframe: Timeframe): Candle[] {
    if (timeframe === '1m') return candles;
  
    const intervalMinutes = timeframe === '5m' ? 5 : 15;
    const intervalSeconds = intervalMinutes * 60;
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
  
  // Generates 250 base 1-minute candles
  export function generateMockCandles(count = 2500): Candle[] {
    const candles: Candle[] = [];
    let currentPrice = 2035.50; // Gold (XAUUSD) style price
    let startTime = Math.floor(Date.now() / 1000) - (count * 60);
  
    for (let i = 0; i < count; i++) {
      const volatility = (Math.random() - 0.49) * 2.5;
      const open = currentPrice;
      const close = open + volatility;
      const high = Math.max(open, close) + Math.random() * 1.2;
      const low = Math.min(open, close) - Math.random() * 1.2;
  
      candles.push({
        time: startTime + (i * 60),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
      });
  
      currentPrice = close;
    }
  
    return candles;
  }