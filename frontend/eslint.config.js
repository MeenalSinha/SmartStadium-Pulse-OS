module.exports = [
  {
    rules: {
      "no-unused-vars": ["warn", { "varsIgnorePattern": "^React$|^App$|^ErrorBoundary$" }],
      "no-undef": "error",
      "react-hooks/exhaustive-deps": "off",
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: true,
        document: true,
        console: true,
        fetch: true,
        setTimeout: true,
        setInterval: true,
        clearInterval: true,
        clearTimeout: true,
        parseFloat: true,
        Math: true,
        Object: true,
        Date: true,
        process: true,
        requestAnimationFrame: true,
        cancelAnimationFrame: true,
      },
    },
  },
];
