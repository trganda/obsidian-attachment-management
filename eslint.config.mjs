import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  {
    ignores: ["main.js", "node_modules/**", "data.json", "**/*.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      sourceType: "module",
      globals: {
        process: "readonly",
        window: "readonly",
        document: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      import: importPlugin,
      "unused-imports": unusedImports,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "unused-imports/no-unused-imports": "error",
      "no-prototype-builtins": "off",
      "no-useless-escape": "off",
      "no-useless-assignment": "off",
      "no-duplicate-imports": "error",
      "@typescript-eslint/no-var-requires": "error",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-empty-function": "error",
      "@typescript-eslint/no-misused-new": "error",
      quotes: ["error", "double"],
    },
  },
];
