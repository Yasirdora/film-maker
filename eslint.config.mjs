import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
    {
        extends: [...next],
    },
    {
        ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**"],
    },
]);
