import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: { entry: "src/index.ts", name: "mvReact", fileName: "index", formats: ["es"] },
        rollupOptions: {
            external: [
                "react",
                "react-dom",
                "@marketview/mv-core",
                "@marketview/mv-replay",
                "@marketview/mv-studies",
                "lightweight-charts"
            ]
        }
    }
});
