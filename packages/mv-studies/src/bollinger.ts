import type { Bar } from "@marketview/mv-core";
import { LineSeries } from "lightweight-charts";
import type { IChartApi } from "lightweight-charts";
import type { StudyDefinition, StudyOutput, LineStudyInstance } from "./studyTypes";

export type BollingerParams = { period: number; stdDev: number };

export const bollingerStudy: StudyDefinition<BollingerParams> = {
    id: "bollinger",
    name: "Bollinger Bands",
    defaults: { period: 20, stdDev: 2 },

    compute: (bars, params) => computeBollinger(bars, params),

    render: (chart: IChartApi, outputs) => {
        // lightweight-charts v5: addLineSeries() was removed; use addSeries(LineSeries, ...)
        const series = outputs.map(() => chart.addSeries(LineSeries));

        outputs.forEach((o, i) => {
            // Assuming o.points is compatible with LineData (time/value)
            series[i].setData(o.points as any);
        });

        const inst: LineStudyInstance = {
            id: "bollinger",
            series,
            remove: () => series.forEach((s) => chart.removeSeries(s)),
        };

        return inst;
    },
};

function computeBollinger(bars: Bar[], params: BollingerParams): StudyOutput[] {
    const { period, stdDev } = params;
    const closes = bars.map((b) => b.close);

    const upper: { time: number; value: number }[] = [];
    const middle: { time: number; value: number }[] = [];
    const lower: { time: number; value: number }[] = [];

    for (let i = 0; i < bars.length; i++) {
        if (i + 1 < period) continue;

        const window = closes.slice(i + 1 - period, i + 1);
        const mean = window.reduce((a, v) => a + v, 0) / period;
        const variance = window.reduce((a, v) => a + (v - mean) ** 2, 0) / period;
        const sd = Math.sqrt(variance);

        const t = bars[i].time;
        middle.push({ time: t, value: mean });
        upper.push({ time: t, value: mean + stdDev * sd });
        lower.push({ time: t, value: mean - stdDev * sd });
    }

    return [
        { id: "bb.upper", kind: "line", points: upper },
        { id: "bb.middle", kind: "line", points: middle },
        { id: "bb.lower", kind: "line", points: lower },
    ];
}
