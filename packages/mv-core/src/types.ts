export type UnixSec = number;

export type Bar = {
    time: UnixSec;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
};

export type Interval =
    | "1m" | "5m" | "15m" | "30m"
    | "1h" | "4h"
    | "1d" | "1w" | "1M";

export type ThemeTokens = {
    background: string;
    grid: string;
    text: string;
    crosshair: string;
    upCandle: string;
    downCandle: string;
};
