module.exports = [
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: "commonjs",
      globals: {
        require: true,
        module: true,
        process: true,
        console: true,
        fetch: true,
        __dirname: true,
        setTimeout: true,
        setInterval: true,
        clearInterval: true,
        parseFloat: true,
        Math: true,
        Object: true,
        Date: true,
        AbortSignal: true,
        Buffer: true
      }
    }
  }
];
