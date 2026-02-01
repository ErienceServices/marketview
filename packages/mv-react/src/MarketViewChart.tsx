import * as React from "react";
import type { Bar } from "@marketview/mv-core";
import type { ReplayEngine } from "@marketview/mv-replay";
import type { StudyRegistry } from "@marketview/mv-studies";

import {
    createChart,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    type IChartApi,
} from "lightweight-charts";

export type MarketViewChartProps = {
    width: number;
    height: number;
    bars: Bar[];
    replay: ReplayEngine;
    studies: StudyRegistry;
    initialStudies?: Array<{ id: string; params?: any }>;

    background?: string; // default white
    textColor?: string; // default slate-900
    gridColor?: string; // default very light gray

    seriesType?: "candles" | "line"; // default candles
    showVolume?: boolean; // default true
};

export type MarketViewChartHandle = {
    fitContent: () => void;
    setVisibleRangeByBars: (barCount: number) => void;

    /** Subscribe to visible logical range changes (zoom/pan). Pass null to unsubscribe. */
    onVisibleLogicalRangeChange: (cb: ((barsVisible: number) => void) | null) => void;
};

type AnySeries = any;

function chartBackground(color: string): any {
    return { type: "solid", color };
}

export const MarketViewChart = React.forwardRef<MarketViewChartHandle, MarketViewChartProps>(
    function MarketViewChart(props, ref) {
        const containerRef = React.useRef<HTMLDivElement | null>(null);

        const chartRef = React.useRef<IChartApi | null>(null);
        const priceSeriesRef = React.useRef<AnySeries | null>(null);
        const volumeSeriesRef = React.useRef<AnySeries | null>(null);

        const onRangeRef = React.useRef<((barsVisible: number) => void) | null>(null);

        const bg = props.background ?? "#ffffff";
        const text = props.textColor ?? "#0f172a";
        const grid = props.gridColor ?? "#eef2f7";

        const seriesType = props.seriesType ?? "candles";
        const showVolume = props.showVolume ?? true;

        React.useImperativeHandle(
            ref,
            () => ({
                fitContent: () => {
                    try {
                        chartRef.current?.timeScale().fitContent();
                    } catch {
                        // ignore
                    }
                },

                setVisibleRangeByBars: (barCount: number) => {
                    const chart = chartRef.current as any;
                    const bars = props.bars;
                    if (!chart || !bars || bars.length === 0) return;

                    const n = Math.max(1, Math.min(barCount, bars.length));

                    try {
                        const to = bars.length - 1;
                        const from = Math.max(0, bars.length - n);
                        chart.timeScale().setVisibleLogicalRange({ from, to });
                        return;
                    } catch {
                        // fallback below
                    }

                    // fallback: time range
                    const fromTime = bars[bars.length - n]?.time;
                    const toTime = bars[bars.length - 1]?.time;
                    if (!fromTime || !toTime) return;

                    try {
                        chart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
                    } catch {
                        // ignore
                    }
                },

                onVisibleLogicalRangeChange: (cb) => {
                    onRangeRef.current = cb;
                },
            }),
            [props.bars],
        );

        // -----------------------------
        // create chart once
        // -----------------------------
        React.useEffect(() => {
            const el = containerRef.current;
            if (!el) return;

            const chart = createChart(el, {
                width: props.width,
                height: props.height,
                layout: {
                    background: chartBackground(bg),
                    textColor: text,
                },
                grid: {
                    vertLines: { color: grid },
                    horzLines: { color: grid },
                },
                rightPriceScale: {
                    borderColor: "#e5e7eb",
                },
                timeScale: {
                    borderColor: "#e5e7eb",
                    timeVisible: true,
                    secondsVisible: false,
                },
                crosshair: {
                    vertLine: { color: "#94a3b8", width: 1, style: 0 },
                    horzLine: { color: "#94a3b8", width: 1, style: 0 },
                },
            });

            chartRef.current = chart;

            const timeScale = (chart as any).timeScale?.();
            const handler = (range: any) => {
                const cb = onRangeRef.current;
                if (!cb || !range) return;

                // range.from / range.to are "logical indexes"
                const barsVisible = Math.max(0, Math.floor(range.to - range.from + 1));
                cb(barsVisible);
            };

            try {
                timeScale?.subscribeVisibleLogicalRangeChange?.(handler);
            } catch {
                // ignore
            }

            const anyChart = chart as any;

            if (seriesType === "candles") {
                const candleOpts = {
                    upColor: "#16a34a",
                    downColor: "#ef4444",
                    wickUpColor: "#16a34a",
                    wickDownColor: "#ef4444",
                    borderUpColor: "#16a34a",
                    borderDownColor: "#ef4444",
                };

                priceSeriesRef.current =
                    typeof anyChart.addCandlestickSeries === "function"
                        ? anyChart.addCandlestickSeries(candleOpts)
                        : anyChart.addSeries(CandlestickSeries, candleOpts);
            } else {
                const lineOpts = { lineWidth: 2 };
                priceSeriesRef.current =
                    typeof anyChart.addLineSeries === "function"
                        ? anyChart.addLineSeries(lineOpts)
                        : anyChart.addSeries(LineSeries, lineOpts);
            }

            if (showVolume) {
                const volOpts = {
                    priceScaleId: "vol",
                    priceFormat: { type: "volume" },
                };

                volumeSeriesRef.current =
                    typeof anyChart.addHistogramSeries === "function"
                        ? anyChart.addHistogramSeries(volOpts)
                        : anyChart.addSeries(HistogramSeries, volOpts);

                try {
                    (chart as any).priceScale("vol").applyOptions({
                        scaleMargins: { top: 0.82, bottom: 0.0 },
                        borderVisible: false,
                    });
                } catch {
                    // ignore
                }
            }

            try {
                chart.timeScale().fitContent();
            } catch {
                // ignore
            }

            return () => {
                // ✅ Unsubscribe
                try {
                    timeScale?.unsubscribeVisibleLogicalRangeChange?.(handler);
                } catch {
                    // ignore
                }

                try {
                    chart.remove();
                } catch {
                    // ignore
                }

                chartRef.current = null;
                priceSeriesRef.current = null;
                volumeSeriesRef.current = null;
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // -----------------------------
        // Resize
        // -----------------------------
        React.useEffect(() => {
            const chart = chartRef.current;
            if (!chart) return;

            (chart as any).applyOptions?.({ width: props.width, height: props.height });
        }, [props.width, props.height]);

        // -----------------------------
        // Theme
        // -----------------------------
        React.useEffect(() => {
            const chart = chartRef.current;
            if (!chart) return;

            (chart as any).applyOptions?.({
                layout: {
                    background: chartBackground(bg),
                    textColor: text,
                },
                grid: {
                    vertLines: { color: grid },
                    horzLines: { color: grid },
                },
                rightPriceScale: { borderColor: "#e5e7eb" },
                timeScale: { borderColor: "#e5e7eb" },
            });
        }, [bg, text, grid]);

        React.useEffect(() => {
            const priceSeries = priceSeriesRef.current;
            if (!priceSeries) return;

            if (seriesType === "candles") {
                priceSeries.setData(
                    props.bars.map((b) => ({
                        time: b.time as any,
                        open: b.open,
                        high: b.high,
                        low: b.low,
                        close: b.close,
                    })),
                );
            } else {
                priceSeries.setData(
                    props.bars.map((b) => ({
                        time: b.time as any,
                        value: b.close,
                    })),
                );
            }

            const vol = volumeSeriesRef.current;
            if (vol && showVolume) {
                vol.setData(
                    props.bars.map((b) => ({
                        time: b.time as any,
                        value: (b as any).volume ?? 0,
                        color: b.close >= b.open ? "rgba(22,163,74,0.35)" : "rgba(239,68,68,0.35)",
                    })),
                );
            }

            // keep newest bars visible by default after data load
            try {
                chartRef.current?.timeScale().fitContent();
            } catch {
                // ignore
            }
        }, [props.bars, seriesType, showVolume]);

        return <div ref={containerRef} style={{ width: "100%", height: "100%", background: bg }} />;
    },
);
