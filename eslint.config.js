import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      globals: {
        process: "readonly",
        console: "readonly",
        NodeJS: "readonly",
        Buffer: "readonly",
        Uint8Array: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "warn",
      "prefer-const": "error"
    }
  }
];
