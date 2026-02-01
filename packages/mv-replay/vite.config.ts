import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: { entry: "src/index.ts", name: "mvReplay", fileName: "index", formats: ["es"] },
        rollupOptions: { external: ["@marketview/mv-core"] }
    }
});
