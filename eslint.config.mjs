import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
    {
        extends: [...next],
    },
    {
        ignores: [".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "coverage/**"],
    },
    {
        plugins: { "react-hooks": reactHooks },
        rules: {
            "react-hooks/set-state-in-effect": "warn",
            "react-hooks/refs": "warn",
            "react-hooks/immutability": "warn",
        },
    },
]);
