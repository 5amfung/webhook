import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [
    react(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      // nitro/h3 is a re-export of h3; alias it so handler imports resolve outside Nitro runtime.
      "nitro/h3": "h3",
    },
  },
})
