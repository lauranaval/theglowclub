import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ACCESS_TEAM_DOMAIN: "glow-prova.cloudflareaccess.com",
            ACCESS_AUD: "aud-de-prova",
            USUARIES: "laura@example.test,elena@example.test,sandra@example.test",
          },
        },
      }),
    ],
    test: {
      include: ["test/**/*.test.ts"],
      setupFiles: ["./test/aplica-migracions.ts"],
      outputFile: { json: "tauler/.resultats/vitest.json" },
      reporters: ["default", "json"],
    },
  };
});
