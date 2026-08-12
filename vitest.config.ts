import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    env: {
      TOKEN_ENCRYPTION_KEY: "unit-test-encryption-key-abc123",
      GOOGLE_CLIENT_SECRET: "unit-test-google-secret",
      WHATSAPP_VERIFY_TOKEN: "verify-token-test",
      // The assistant tests exercise the seeded demo dataset.
      DEMO_MODE: "true",
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
