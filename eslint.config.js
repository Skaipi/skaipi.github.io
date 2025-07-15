import eslintPluginPrettier from "eslint-plugin-prettier";

export default [
  {
    files: ["**/*.{js,ts,jsx,tsx}"],
    languageOptions: {
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { prettier: eslintPluginPrettier },
    rules: {
      "prettier/prettier": "error",
      // place your code‑quality rules here
    },
  },
];
