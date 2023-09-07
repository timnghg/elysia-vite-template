import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    root: "./src/app",
    base: "/app", // change to match with your prefix
    build: {
        outDir: "../../public/dist",
        manifest: true,
    },
    plugins: [tsconfigPaths(), react()],
});
