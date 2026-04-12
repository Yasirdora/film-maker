import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        coverage: {
            provider: "v8",
            include: ["lib/**/*.ts"],
            exclude: ["lib/db.ts", "lib/auth.ts", "lib/auth-client.ts"],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname),
        },
    },
});
