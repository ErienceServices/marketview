import {
    createChart,
    CandlestickSeries,
    type CandlestickData,
    type IChartApi,
    type ISeriesApi,
    type MouseEventParams,
    type Time,
    type UTCTimestamp,
    type WhitespaceData,
} from "lightweight-charts";

import type { Bar, ThemeTokens } from "./types";
import { CommandRegistry, type CommandContext } from "./commands";
import { buildContextMenuModel, type ContextMenuModel } from "./contextMenu";

export type ChartHostOptions = {
    width: number;
    height: number;
    theme?: Partial<ThemeTokens>;
};

export type ChartHostEvents = {
    onContextMenu?: (model: ContextMenuModel) => void;
    onCrosshairMove?: (ctx: { time?: number; price?: number }) => void;
};

const DEFAULT_THEME: ThemeTokens = {
    background: "#0b1220",
    grid: "rgba(255,255,255,0.06)",
    text: "rgba(255,255,255,0.85)",
    crosshair: "rgba(255,255,255,0.20)",
    upCandle: "#2ecc71",
    downCandle: "#e74c3c",
};

// lightweight-charts v5 brands UTCTimestamp; your Bar.time is UnixSec.
// Convert at the chart boundary (keep domain types independent).
const toUtcTimestamp = (t: Bar["time"]): UTCTimestamp => t as unknown as UTCTimestamp;

function timeToNumber(t: Time | undefined): number | undefined {
    if (t == null) return undefined;

    // UTCTimestamp is a branded number type; runtime is still number.
    if (typeof t === "number") return t;

    // BusinessDay: { year, month, day } -> UTC seconds at midnight
    if (typeof t === "object" && "year" in t && "month" in t && "day" in t) {
        const ms = Date.UTC(t.year, t.month - 1, t.day, 0, 0, 0, 0);
        return Math.floor(ms / 1000);
    }

    // String time (depending on configuration)
    if (typeof t === "string") {
        const ms = Date.parse(t);
        return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
    }

    return undefined;
}

export class ChartHost {
    readonly chart: IChartApi;
    readonly candles: ISeriesApi<"Candlestick">;
    readonly commands = new CommandRegistry();

    private container: HTMLElement;
    private events: ChartHostEvents;

    constructor(container: HTMLElement, opts: ChartHostOptions, events: ChartHostEvents = {}) {
        this.container = container;
        this.events = events;

        const theme: ThemeTokens = { ...DEFAULT_THEME, ...(opts.theme ?? {}) };

        this.chart = createChart(container, {
            width: opts.width,
            height: opts.height,
            layout: { background: { color: theme.background }, textColor: theme.text },
            grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
            crosshair: {
                vertLine: { color: theme.crosshair },
                horzLine: { color: theme.crosshair },
            },
        });

        // v5: addSeries(CandlestickSeries, options)
        this.candles = this.chart.addSeries(CandlestickSeries, {
            upColor: theme.upCandle,
            downColor: theme.downCandle,
            wickUpColor: theme.upCandle,
            wickDownColor: theme.downCandle,
            borderVisible: false,
        });

        this.chart.subscribeCrosshairMove((p) => this.handleCrosshair(p));
        this.container.addEventListener("contextmenu", this.handleContextMenu, { passive: false });
    }

    destroy() {
        this.container.removeEventListener("contextmenu", this.handleContextMenu);
        this.chart.remove();
    }

    resize(width: number, height: number) {
        this.chart.applyOptions({ width, height });
    }

    setBars(bars: Bar[]) {
        const data: Array<CandlestickData<UTCTimestamp> | WhitespaceData<UTCTimestamp>> = bars.map(
            (b) => ({
                time: toUtcTimestamp(b.time),
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close,
            }),
        );

        this.candles.setData(data);
    }

    updateBar(bar: Bar) {
        const point: CandlestickData<UTCTimestamp> = {
            time: toUtcTimestamp(bar.time),
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
        };

        this.candles.update(point);
    }

    private handleCrosshair(p: MouseEventParams) {
        const time = timeToNumber(p.time);

        const sd = p.seriesData.get(this.candles) as
            | CandlestickData<Time>
            | WhitespaceData<Time>
            | undefined;

        const price =
            sd && "close" in sd && typeof sd.close === "number" ? sd.close : undefined;

        this.events.onCrosshairMove?.({ time, price });
    }

    private handleContextMenu = (ev: MouseEvent) => {
        ev.preventDefault();

        const rect = this.container.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;

        const timeScale = this.chart.timeScale();
        const time = timeToNumber(timeScale.coordinateToTime(x) ?? undefined);

        // v5: price conversion should be done on the series (not on the price scale)
        const price = this.candles.coordinateToPrice(y) ?? undefined;

        const logicalIndex = timeScale.coordinateToLogical(x) ?? undefined;

        const ctx: CommandContext = {
            time,
            price: typeof price === "number" ? price : undefined,
            logicalIndex: typeof logicalIndex === "number" ? logicalIndex : undefined,
        };

        const model = buildContextMenuModel(this.commands, ctx, ev.clientX, ev.clientY);
        this.events.onContextMenu?.(model);
    };
}
