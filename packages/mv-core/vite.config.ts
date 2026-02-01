import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: {
            entry: "src/index.ts",
            name: "mvCore",
            fileName: "index",
            formats: ["es"]
        },
        rollupOptions: {
            external: ["lightweight-charts"]
        }
    }
});
