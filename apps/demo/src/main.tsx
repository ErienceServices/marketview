import * as React from "react";
import { createRoot } from "react-dom/client";

import { MarketViewChart, type MarketViewChartHandle } from "@marketview/mv-react";
import type { Bar } from "@marketview/mv-core";
import { ReplayEngine } from "@marketview/mv-replay";
import { StudyRegistry, bollingerStudy } from "@marketview/mv-studies";

function App() {
    const bars = React.useMemo(() => makeJapaneseCandles(260), []);

    const replay = React.useMemo(
        () => new ReplayEngine({ msPerBar: 120, windowSize: 160 }),
        [],
    );

    const studies = React.useMemo(() => {
        const s = new StudyRegistry();
        s.register(bollingerStudy);
        return s;
    }, []);

    const chartRef = React.useRef<MarketViewChartHandle | null>(null);

    const [symbol, setSymbol] = React.useState("AAPL");
    const [interval, setInterval] = React.useState("1D");
    const [ms, setMs] = React.useState<number>(120);
    const [selectedIndicator, setSelectedIndicator] = React.useState<string>("BBANDS");

    // ✅ Apply interval selection to the chart (TopBar + BottomBar share this)
    const applyInterval = React.useCallback(
        (key: string) => {
            setInterval(key);

            const api = chartRef.current;
            if (!api) return;

            // NOTE: Your demo data is DAILY bars (1 bar/day). Intraday (ticks/seconds/minutes/hours)
            // is UI-only until you generate intraday bars.
            const map: Record<string, number> = {
                // day ranges
                "1D": 2,
                "5D": 5,

                // week/month-ish (trading days)
                "1W": 5,
                "1M": 22,
                "3M": 66,
                "6M": 132,
                "12M": 252,

                // year-ish
                "YTD": 252,
                "1Y": 252,
                "5Y": 252 * 5,
            };

            if (key === "All") {
                api.fitContent();
                return;
            }

            const n = map[key];
            if (n) api.setVisibleRangeByBars(n);
        },
        [],
    );

    // Keep the "interval" label in sync when the user pans/zooms
    React.useEffect(() => {
        const api = chartRef.current;
        if (!api) return;

        api.onVisibleLogicalRangeChange((barsVisible) => {
            const next =
                barsVisible <= 2 ? "1D" :
                    barsVisible <= 5 ? "5D" :
                        barsVisible <= 22 ? "1M" :
                            barsVisible <= 66 ? "3M" :
                                barsVisible <= 132 ? "6M" :
                                    barsVisible <= 252 ? "1Y" :
                                        barsVisible <= 252 * 5 ? "5Y" :
                                            "All";

            setInterval((prev) => (prev === next ? prev : next));
        });

        return () => {
            try {
                api.onVisibleLogicalRangeChange(null);
            } catch {
                // ignore
            }
        };
    }, []);

    // Stop replay on unmount
    React.useEffect(() => {
        return () => {
            try {
                replay.stop();
            } catch {
                // ignore
            }
        };
    }, [replay]);

    return (
        <div style={styles.page}>
            <TopBar
                symbol={symbol}
                onSymbolChange={setSymbol}
                interval={interval}
                onIntervalChange={applyInterval} // ✅ IMPORTANT: chart zoom now happens on dropdown selection
                ms={ms}
                onMsChange={(v) => {
                    setMs(v);
                    replay.setMsPerBar(v);
                }}
                onStart={() => replay.start()}
                onPause={() => replay.pause()}
                onResume={() => replay.resume()}
                onStop={() => replay.stop()}
                onStepBack={() => replay.stepBack()}
                onStepForward={() => replay.stepForward()}
                indicator={selectedIndicator}
                onIndicatorChange={setSelectedIndicator}
            />

            <div style={styles.body}>
                <LeftTools />

                <div style={styles.center}>
                    <div style={styles.chartFrame}>
                        <div style={styles.chartHeaderRow}>
                            <div style={styles.chartTitle}>
                                <span style={styles.chartSymbol}>{symbol}</span>
                                <span style={styles.chartMeta}> • {interval} • NASDAQ</span>
                            </div>

                            {/* placeholder OHLC row (wire to hover later) */}
                            <div style={styles.ohlcRow}>
                                <span style={styles.ohlc}>O 255.17</span>
                                <span style={styles.ohlc}>H 261.90</span>
                                <span style={styles.ohlc}>L 252.18</span>
                                <span style={styles.ohlc}>C 259.48</span>
                                <span style={styles.ohlcPos}>+1.20 (+0.46%)</span>
                            </div>
                        </div>

                        <ChartViewport bars={bars} replay={replay} studies={studies} chartRef={chartRef} />
                    </div>

                    <BottomBar
                        interval={interval}
                        onIntervalChange={applyInterval} // ✅ share same logic
                        onSelectRange={applyInterval}     // ✅ share same logic
                    />
                </div>
            </div>
        </div>
    );
}

/* ----------------------------- Chart viewport (robust sizing) ----------------------------- */

function ChartViewport(props: {
    bars: Bar[];
    replay: ReplayEngine;
    studies: StudyRegistry;
    chartRef: React.RefObject<MarketViewChartHandle | null>;
}) {
    const { ref, width, height } = useSize<HTMLDivElement>();
    const ready = width >= 50 && height >= 50;

    return (
        <div ref={ref} style={styles.chartViewport}>
            {!ready ? (
                <div style={styles.chartSkeleton}>Loading chart…</div>
            ) : (
                <MarketViewChart
                    ref={props.chartRef}
                    width={width}
                    height={height}
                    bars={props.bars}
                    replay={props.replay}
                    studies={props.studies}
                    initialStudies={[{ id: "bollinger", params: { period: 20, stdDev: 2 } }]}
                    background="#ffffff"
                    textColor="#0f172a"
                    seriesType="candles"
                    showVolume={true}
                />
            )}
        </div>
    );
}

/* ----------------------------- Top toolbar ----------------------------- */

function TopBar(props: {
    symbol: string;
    onSymbolChange: (v: string) => void;
    interval: string;
    onIntervalChange: (v: string) => void;

    ms: number;
    onMsChange: (v: number) => void;

    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    onStepBack: () => void;
    onStepForward: () => void;

    indicator: string;
    onIndicatorChange: (v: string) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [customOpen, setCustomOpen] = React.useState(false);

    // Custom interval inputs (simple, but enough to start)
    const [customValue, setCustomValue] = React.useState<number>(5);
    const [customUnit, setCustomUnit] = React.useState<IntervalUnit>("minute");

    const label = intervalLabel(props.interval);

    return (
        <div style={styles.topBar}>
            <div style={styles.topLeft}>
                <IconBtn title="Menu">≡</IconBtn>

                <div style={styles.symbolWrap}>
                    <input
                        value={props.symbol}
                        onChange={(e) => props.onSymbolChange(e.target.value.toUpperCase())}
                        spellCheck={false}
                        style={styles.symbolInput}
                    />
                    <span style={styles.badge}>NASDAQ</span>
                </div>

                {/* ✅ TradingView-like interval dropdown */}
                <div style={{ position: "relative" }}>
                    <button
                        type="button"
                        style={styles.intervalBtn}
                        onClick={() => setOpen((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={open}
                        title="Interval"
                    >
                        <span style={{ fontWeight: 700 }}>{label}</span>
                        <span style={{ opacity: 0.6, marginLeft: 6 }}>▾</span>
                    </button>

                    {open && (
                        <div
                            style={styles.intervalMenu}
                            role="menu"
                            onMouseLeave={() => setOpen(false)}
                        >
                            <MenuRow
                                kind="action"
                                label="＋ Add custom interval…"
                                onClick={() => {
                                    setOpen(false);
                                    setCustomOpen(true);
                                }}
                            />

                            <MenuSection title="TICKS">
                                {["1t", "10t", "100t", "1000t"].map((key) => (
                                    <MenuRow
                                        key={key}
                                        kind="item"
                                        label={intervalLabel(key)}
                                        active={props.interval === key}
                                        onClick={() => {
                                            props.onIntervalChange(key);
                                            setOpen(false);
                                        }}
                                    />
                                ))}
                            </MenuSection>

                            <MenuSection title="SECONDS">
                                {["1s", "5s", "10s", "15s", "30s", "45s"].map((key) => (
                                    <MenuRow
                                        key={key}
                                        kind="item"
                                        label={intervalLabel(key)}
                                        active={props.interval === key}
                                        onClick={() => {
                                            props.onIntervalChange(key);
                                            setOpen(false);
                                        }}
                                    />
                                ))}
                            </MenuSection>

                            <MenuSection title="MINUTES">
                                {["1m", "2m", "3m", "5m", "10m", "15m", "30m", "45m"].map(
                                    (key) => (
                                        <MenuRow
                                            key={key}
                                            kind="item"
                                            label={intervalLabel(key)}
                                            active={props.interval === key}
                                            onClick={() => {
                                                props.onIntervalChange(key);
                                                setOpen(false);
                                            }}
                                        />
                                    ),
                                )}
                            </MenuSection>

                            <MenuSection title="HOURS">
                                {["1h", "2h", "3h", "4h"].map((key) => (
                                    <MenuRow
                                        key={key}
                                        kind="item"
                                        label={intervalLabel(key)}
                                        active={props.interval === key}
                                        onClick={() => {
                                            props.onIntervalChange(key);
                                            setOpen(false);
                                        }}
                                    />
                                ))}
                            </MenuSection>

                            <MenuSection title="DAYS">
                                {["1D", "1W", "1M", "3M", "6M", "12M"].map((key) => (
                                    <MenuRow
                                        key={key}
                                        kind="item"
                                        label={intervalLabel(key)}
                                        active={props.interval === key}
                                        onClick={() => {
                                            props.onIntervalChange(key);
                                            setOpen(false);
                                        }}
                                    />
                                ))}
                            </MenuSection>

                            <MenuSection title="RANGES">
                                {["1r", "10r", "100r", "1000r"].map((key) => (
                                    <MenuRow
                                        key={key}
                                        kind="item"
                                        label={intervalLabel(key)}
                                        active={props.interval === key}
                                        onClick={() => {
                                            props.onIntervalChange(key);
                                            setOpen(false);
                                        }}
                                    />
                                ))}
                            </MenuSection>
                        </div>
                    )}
                </div>

                <div style={styles.divider} />

                <label style={styles.inlineLabel}>
                    <span style={styles.inlineLabelText}>Indicators</span>
                    <select
                        value={props.indicator}
                        onChange={(e) => props.onIndicatorChange(e.target.value)}
                        style={{ ...styles.select, minWidth: 260 }}
                        aria-label="Indicator"
                    >
                        <option value="BBANDS">BBANDS — Bollinger Bands</option>
                        <option value="RSI">RSI — Relative Strength Index</option>
                        <option value="MACD">MACD — Moving Average Convergence/Divergence</option>
                        <option value="ATR">ATR — Average True Range</option>
                    </select>
                </label>

                <div style={styles.divider} />

                <IconBtn title="Alert">⏰</IconBtn>
            </div>

            <div style={styles.topRight}>
                <div style={styles.replayGroup}>
                    <span style={styles.replayLabel}>Replay</span>
                    <IconBtn title="Start" onClick={props.onStart}>
                        ▶
                    </IconBtn>
                    <IconBtn title="Pause" onClick={props.onPause}>
                        ⏸
                    </IconBtn>
                    <IconBtn title="Resume" onClick={props.onResume}>
                        ⏵
                    </IconBtn>
                    <IconBtn title="Stop" onClick={props.onStop}>
                        ■
                    </IconBtn>
                    <IconBtn title="Step -" onClick={props.onStepBack}>
                        ⟲
                    </IconBtn>
                    <IconBtn title="Step +" onClick={props.onStepForward}>
                        ⟳
                    </IconBtn>

                    <label style={styles.msLabel}>
                        <span style={styles.msText}>ms/bar</span>
                        <input
                            value={msClamp(props.ms)}
                            inputMode="numeric"
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isFinite(v) || v <= 0) return;
                                props.onMsChange(v);
                            }}
                            style={styles.msInput}
                        />
                    </label>
                </div>

                <button type="button" style={styles.saveBtn}>
                    Save
                </button>
            </div>

            {/* ✅ Custom interval modal */}
            {customOpen && (
                <div style={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div style={styles.modal}>
                        <div style={styles.modalTitle}>Add custom interval</div>

                        <div style={styles.modalRow}>
                            <input
                                type="number"
                                min={1}
                                value={customValue}
                                onChange={(e) =>
                                    setCustomValue(Math.max(1, Number(e.target.value) || 1))
                                }
                                style={styles.modalInput}
                            />
                            <select
                                value={customUnit}
                                onChange={(e) => setCustomUnit(e.target.value as IntervalUnit)}
                                style={styles.modalSelect}
                            >
                                <option value="tick">tick(s)</option>
                                <option value="second">second(s)</option>
                                <option value="minute">minute(s)</option>
                                <option value="hour">hour(s)</option>
                                <option value="day">day(s)</option>
                                <option value="week">week(s)</option>
                                <option value="month">month(s)</option>
                                <option value="range">range(s)</option>
                            </select>
                        </div>

                        <div style={styles.modalActions}>
                            <button
                                type="button"
                                style={styles.modalBtn}
                                onClick={() => setCustomOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                style={styles.modalBtnPrimary}
                                onClick={() => {
                                    const key = customIntervalKey(customValue, customUnit);
                                    props.onIntervalChange(key);
                                    setCustomOpen(false);
                                }}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function msClamp(v: number) {
    return Number.isFinite(v) && v > 0 ? v : 120;
}

function IconBtn(props: { title: string; children: React.ReactNode; onClick?: () => void }) {
    return (
        <button type="button" title={props.title} onClick={props.onClick} style={styles.iconBtn}>
            {props.children}
        </button>
    );
}

function MenuSection(props: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ padding: "8px 0" }}>
            <div style={styles.menuSectionTitle}>{props.title}</div>
            <div>{props.children}</div>
        </div>
    );
}

function MenuRow(props: {
    kind: "item" | "action";
    label: string;
    active?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={props.onClick}
            style={{
                ...styles.menuRow,
                ...(props.kind === "action" ? styles.menuRowAction : null),
                ...(props.active ? styles.menuRowActive : null),
            }}
        >
            <span>{props.label}</span>
            {props.active ? <span style={{ opacity: 0.7 }}>✓</span> : <span />}
        </button>
    );
}

type IntervalUnit = "tick" | "second" | "minute" | "hour" | "day" | "week" | "month" | "range";

function customIntervalKey(value: number, unit: IntervalUnit): string {
    const v = Math.max(1, Math.floor(value));
    const u =
        unit === "tick" ? "t" :
            unit === "second" ? "s" :
                unit === "minute" ? "m" :
                    unit === "hour" ? "h" :
                        unit === "range" ? "r" :
                            unit === "day" ? "D" :
                                unit === "week" ? "W" :
                                    "M";

    return `${v}${u}`;
}

function intervalLabel(key: string): string {
    const m = /^(\d+)([a-zA-Z])$/.exec(key);
    if (!m) return key;

    const n = Number(m[1]);
    const u = m[2];

    const plural = (word: string) => (n === 1 ? word : `${word}s`);

    switch (u) {
        case "t": return `${n} ${plural("tick")}`;
        case "s": return `${n} ${plural("second")}`;
        case "m": return `${n} ${plural("minute")}`;
        case "h": return `${n} ${plural("hour")}`;
        case "r": return `${n} ${plural("range")}`;
        case "D": return n === 1 ? "1 day" : `${n} days`;
        case "W": return n === 1 ? "1 week" : `${n} weeks`;
        case "M": return n === 1 ? "1 month" : `${n} months`;
        default: return key;
    }
}

/* ----------------------------- Left tools rail ----------------------------- */

function LeftTools() {
    const tools = ["＋", "╱", "⌖", "↕", "✎", "T", "☺", "⌂", "⦿", "🗑"];
    return (
        <div style={styles.leftRail}>
            {tools.map((t, i) => (
                <button key={i} type="button" style={styles.leftToolBtn} title={`Tool ${i + 1}`}>
                    {t}
                </button>
            ))}
        </div>
    );
}

/* ----------------------------- Bottom timeframe bar ----------------------------- */

function BottomBar(props: {
    interval: string;
    onIntervalChange: (v: string) => void;
    onSelectRange: (key: string) => void;
}) {
    const items = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];

    return (
        <div style={styles.bottomBar}>
            <div style={styles.bottomLeft}>
                {items.map((x) => {
                    const active = props.interval === x;
                    return (
                        <button
                            key={x}
                            type="button"
                            onClick={() => {
                                props.onIntervalChange(x);
                                props.onSelectRange(x);
                            }}
                            style={{ ...styles.timeBtn, ...(active ? styles.timeBtnActive : null) }}
                        >
                            {x}
                        </button>
                    );
                })}
            </div>

            <div style={styles.bottomRight}>
                <span style={styles.clockText}>{new Date().toUTCString().slice(17, 25)} UTC</span>
            </div>
        </div>
    );
}

/* ----------------------------- Utilities ----------------------------- */

function useSize<T extends HTMLElement>() {
    const ref = React.useRef<T | null>(null);
    const [size, setSize] = React.useState({ width: 0, height: 0 });

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const ro = new ResizeObserver((entries) => {
            const cr = entries[0]?.contentRect;
            if (!cr) return;
            setSize({ width: Math.floor(cr.width), height: Math.floor(cr.height) });
        });

        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return { ref, width: size.width, height: size.height };
}

function makeJapaneseCandles(n: number): Bar[] {
    const out: Bar[] = [];

    let t = Math.floor(Date.now() / 1000) - n * 60 * 60 * 24;
    let price = 220;

    for (let i = 0; i < n; i++) {
        const gap = Math.random() < 0.06 ? (Math.random() - 0.5) * 8 : 0;
        const open = Math.max(10, price + gap);

        const body = (Math.random() - 0.5) * 6.5;
        const close = Math.max(10, open + body);

        const upperWick = Math.random() * 2.8;
        const lowerWick = Math.random() * 2.8;

        const high = Math.max(open, close) + upperWick;
        const low = Math.min(open, close) - lowerWick;

        const range = high - low;

        const baseVol = 8_000_000 + Math.random() * 20_000_000;
        const rangeBoost = 1 + Math.min(2.5, range / 6);
        const spike = Math.random() < 0.05 ? (20_000_000 + Math.random() * 60_000_000) : 0;
        const volume = Math.floor(baseVol * rangeBoost + spike);

        out.push({
            time: t as Bar["time"],
            open,
            high,
            low,
            close,
            volume,
        });

        price = close;
        t += 60 * 60 * 24;
    }

    return out;
}

/* ----------------------------- Mount ----------------------------- */

createRoot(document.getElementById("root")!).render(<App />);

/* ----------------------------- Styles ----------------------------- */

const styles: Record<string, React.CSSProperties> = {
    page: {
        fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"',
        background: "#ffffff",
        color: "#0f172a",
        minHeight: "100vh",
        margin: 0,
    },

    topBar: {
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px",
        borderBottom: "1px solid #e5e7eb",
        background: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 10,
    },

    topLeft: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
    },

    topRight: {
        display: "flex",
        alignItems: "center",
        gap: 10,
    },

    replayGroup: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 8px",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        background: "#ffffff",
    },

    replayLabel: { fontSize: 12, color: "#475569", marginRight: 4 },

    symbolWrap: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },

    symbolInput: {
        width: 84,
        height: 30,
        padding: "0 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        color: "#0f172a",
        fontWeight: 600,
        letterSpacing: 0.5,
        outline: "none",
    },

    badge: {
        fontSize: 11,
        color: "#64748b",
        border: "1px solid #e5e7eb",
        padding: "2px 6px",
        borderRadius: 999,
        background: "#ffffff",
        whiteSpace: "nowrap",
    },

    select: {
        height: 30,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        color: "#0f172a",
        padding: "0 10px",
        outline: "none",
        fontSize: 13,
    },

    inlineLabel: { display: "inline-flex", alignItems: "center", gap: 8 },
    inlineLabelText: { fontSize: 12, color: "#475569" },

    divider: { width: 1, height: 22, background: "#e5e7eb", margin: "0 4px" },

    iconBtn: {
        height: 30,
        minWidth: 30,
        padding: "0 8px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        color: "#0f172a",
        cursor: "pointer",
    },

    msLabel: { display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 6 },
    msText: { fontSize: 12, color: "#475569" },

    msInput: {
        width: 72,
        height: 26,
        padding: "0 8px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        color: "#0f172a",
        outline: "none",
    },

    saveBtn: {
        height: 32,
        padding: "0 12px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        color: "#0f172a",
        cursor: "pointer",
        fontWeight: 600,
    },

    body: { display: "flex", minHeight: "calc(100vh - 48px)" },

    leftRail: {
        width: 44,
        borderRight: "1px solid #e5e7eb",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 6px",
    },

    leftToolBtn: {
        height: 32,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        cursor: "pointer",
        color: "#0f172a",
        fontSize: 14,
    },

    center: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },

    chartFrame: {
        flex: 1,
        minHeight: 0,
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
    },

    chartHeaderRow: {
        padding: "10px 14px",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
    },

    chartTitle: { display: "flex", alignItems: "baseline", gap: 6, minWidth: 260 },
    chartSymbol: { fontWeight: 700 },
    chartMeta: { color: "#64748b", fontSize: 12 },

    ohlcRow: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
    ohlc: { fontSize: 12, color: "#475569" },
    ohlcPos: { fontSize: 12, color: "#16a34a", fontWeight: 600 },

    chartViewport: {
        flex: 1,
        minHeight: 0,
        width: "100%",
        background: "#ffffff",
    },

    chartSkeleton: {
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        fontSize: 13,
    },

    bottomBar: {
        height: 40,
        borderTop: "1px solid #e5e7eb",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px",
    },

    bottomLeft: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        justifyContent: "flex-start",
    },

    timeBtn: {
        height: 26,
        padding: "0 10px",
        borderRadius: 10,
        border: "1px solid transparent",
        background: "transparent",
        color: "#0f172a",
        cursor: "pointer",
        fontSize: 12,
    },

    timeBtnActive: { border: "1px solid #e5e7eb", background: "#f8fafc", fontWeight: 700 },

    bottomRight: { display: "flex", alignItems: "center", gap: 10 },
    clockText: { fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" },

    intervalBtn: {
        height: 30,
        padding: "0 10px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        color: "#0f172a",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
    },

    intervalMenu: {
        position: "absolute",
        top: 36,
        left: 0,
        width: 260,
        maxHeight: 520,
        overflow: "auto",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
        padding: 8,
        zIndex: 50,
    },

    menuSectionTitle: {
        fontSize: 11,
        fontWeight: 700,
        color: "#94a3b8",
        padding: "6px 10px",
        letterSpacing: 0.6,
    },

    menuRow: {
        width: "100%",
        height: 34,
        padding: "0 10px",
        borderRadius: 10,
        border: "1px solid transparent",
        background: "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        color: "#0f172a",
        textAlign: "left",
    },

    menuRowAction: {
        fontWeight: 700,
    },

    menuRowActive: {
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
    },

    modalOverlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
    },

    modal: {
        width: 360,
        background: "#ffffff",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        boxShadow: "0 18px 60px rgba(15, 23, 42, 0.18)",
        padding: 14,
    },

    modalTitle: {
        fontSize: 14,
        fontWeight: 800,
        marginBottom: 10,
        color: "#0f172a",
    },

    modalRow: {
        display: "flex",
        gap: 10,
        alignItems: "center",
    },

    modalInput: {
        width: 110,
        height: 34,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        padding: "0 10px",
        outline: "none",
    },

    modalSelect: {
        flex: 1,
        height: 34,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        padding: "0 10px",
        outline: "none",
        background: "#ffffff",
    },

    modalActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        marginTop: 14,
    },

    modalBtn: {
        height: 34,
        padding: "0 12px",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        cursor: "pointer",
        fontWeight: 700,
    },

    modalBtnPrimary: {
        height: 34,
        padding: "0 12px",
        borderRadius: 10,
        border: "1px solid #0f172a",
        background: "#0f172a",
        color: "#ffffff",
        cursor: "pointer",
        fontWeight: 800,
    },
};
