import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: { entry: "src/index.ts", name: "mvStudies", fileName: "index", formats: ["es"] },
        rollupOptions: { external: ["@marketview/mv-core", "lightweight-charts"] }
    }
});
