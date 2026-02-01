export type Ohlc = {
    time: number; // unix seconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
};

export function generateOhlcSeries(params?: {
    points?: number;
    startPrice?: number;
    startTimeSec?: number; // unix seconds
    stepSec?: number;      // e.g. 60 for 1m, 300 for 5m, 86400 for 1d
    volatility?: number;   // bigger = more movement
}): Ohlc[] {
    const points = params?.points ?? 200;
    const startPrice = params?.startPrice ?? 100;
    const stepSec = params?.stepSec ?? 60;
    const volatility = params?.volatility ?? 1.2;

    const nowSec = Math.floor(Date.now() / 1000);
    const startTimeSec = params?.startTimeSec ?? (nowSec - points * stepSec);

    const out: Ohlc[] = [];

    let lastClose = startPrice;

    for (let i = 0; i < points; i++) {
        const time = startTimeSec + i * stepSec;

        // random walk close
        const drift = (Math.random() - 0.5) * volatility;
        const close = Math.max(0.01, lastClose + drift);

        // open near prev close
        const open = Math.max(0.01, lastClose + (Math.random() - 0.5) * (volatility * 0.4));

        // high/low around open/close
        const hiBase = Math.max(open, close);
        const loBase = Math.min(open, close);
        const high = hiBase + Math.random() * (volatility * 0.8);
        const low = Math.max(0.01, loBase - Math.random() * (volatility * 0.8));

        out.push({
            time,
            open: round2(open),
            high: round2(high),
            low: round2(low),
            close: round2(close),
            volume: Math.floor(100 + Math.random() * 500),
        });

        lastClose = close;
    }

    return out;
}

function round2(n: number) {
    return Math.round(n * 100) / 100;
}
