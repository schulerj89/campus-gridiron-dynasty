import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const base = process.env.GITHUB_PAGES === "true" ? "/campus-gridiron-dynasty/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
});
