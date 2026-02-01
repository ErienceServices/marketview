import type { IChartApi } from "lightweight-charts";
import type { Bar } from "@marketview/mv-core";
import type { StudyDefinition, StudyInstance } from "./studyTypes";

export class StudyRegistry {
    private defs = new Map<string, StudyDefinition<any>>();

    register<T>(def: StudyDefinition<T>) {
        if (this.defs.has(def.id)) throw new Error(`Study already registered: ${def.id}`);
        this.defs.set(def.id, def);
        return () => this.defs.delete(def.id);
    }

    get(id: string) {
        return this.defs.get(id);
    }

    list() {
        return [...this.defs.values()];
    }

    attach(chart: IChartApi, bars: Bar[], studyId: string, params?: any): StudyInstance {
        const def = this.defs.get(studyId);
        if (!def) throw new Error(`Unknown study: ${studyId}`);

        const merged = { ...def.defaults, ...(params ?? {}) };
        const outputs = def.compute(bars, merged);
        const instance = def.render(chart, outputs);
        return instance;
    }
}
