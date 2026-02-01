import type { Bar } from "@marketview/mv-core";
import type { IChartApi, ISeriesApi } from "@marketview/mv-core";

export type StudyOutputPoint = { time: number; value: number };
export type StudyOutput = {
    id: string;
    kind: "line";
    points: StudyOutputPoint[];
};

export type StudyDefinition<TParams> = {
    id: string;
    name: string;
    defaults: TParams;
    compute: (bars: Bar[], params: TParams) => StudyOutput[];
    render: (chart: IChartApi, outputs: StudyOutput[]) => StudyInstance;
};

export type StudyInstance = {
    id: string;
    remove: () => void;
};

export type LineStudyInstance = StudyInstance & {
    series: ISeriesApi<"Line">[];
};
