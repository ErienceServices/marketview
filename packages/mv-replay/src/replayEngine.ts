import type { Bar } from "@marketview/mv-core";

export type ReplayState = "stopped" | "playing" | "paused";

export type ReplayEngineOptions = {
    msPerBar: number;
    windowSize?: number; // if set, only expose last N bars during play
};

export class ReplayEngine {
    private allBars: Bar[] = [];
    private cursor = 0;
    private timer: number | null = null;

    private state: ReplayState = "stopped";
    private opts: ReplayEngineOptions;

    constructor(opts: ReplayEngineOptions) {
        this.opts = opts;
    }

    load(bars: Bar[]) {
        this.stop();
        this.allBars = bars;
        this.cursor = 0;
    }

    getState(): ReplayState {
        return this.state;
    }

    getCursor(): number {
        return this.cursor;
    }

    setMsPerBar(msPerBar: number) {
        this.opts.msPerBar = Math.max(10, msPerBar);
        if (this.state === "playing") {
            // restart interval with new speed
            this.pause();
            this.resume();
        }
    }

    start() {
        this.stop();
        if (this.allBars.length === 0) return;
        this.cursor = 1;
        this.state = "playing";
        this.timer = window.setInterval(() => this.tick(), this.opts.msPerBar);
    }

    pause() {
        if (this.state !== "playing") return;
        if (this.timer != null) window.clearInterval(this.timer);
        this.timer = null;
        this.state = "paused";
    }

    resume() {
        if (this.state !== "paused") return;
        this.state = "playing";
        this.timer = window.setInterval(() => this.tick(), this.opts.msPerBar);
    }

    stop() {
        if (this.timer != null) window.clearInterval(this.timer);
        this.timer = null;
        this.state = "stopped";
        this.cursor = 0;
    }

    seek(index: number) {
        this.cursor = clamp(index, 0, this.allBars.length);
    }

    stepForward() {
        this.seek(this.cursor + 1);
    }

    stepBack() {
        this.seek(this.cursor - 1);
    }

    getVisibleBars(): Bar[] {
        const end = this.cursor;
        const slice = this.allBars.slice(0, end);
        const ws = this.opts.windowSize;
        if (ws && slice.length > ws) return slice.slice(slice.length - ws);
        return slice;
    }

    private tick() {
        const next = this.cursor + 1;
        if (next >= this.allBars.length) {
            this.cursor = this.allBars.length;
            this.stop();
            return;
        }
        this.cursor = next;
    }
}

function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
}
