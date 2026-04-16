# Contributing to SmartStadium Pulse OS

First off, thank you for considering contributing to SmartStadium! It is people like you that make it a better tool for stadium operators everywhere.

---

## 📜 Code of Conduct

As a contributor, you are expected to maintain a professional and inclusive environment. Please be respectful and focus on technical excellence.

---

## 🛠️ Development Workflow

### 1. Requirements
- Follow the guidelines in [SETUP.md](docs/SETUP.md).
- Ensure all code is linted using the project's ESLint config.

### 2. Branching Policy
- `main`: Production-ready code only.
- `feat/*`: For new features.
- `fix/*`: For bug fixes.

---

## 🎨 Coding Standards

- **JavaScript:** We use **CommonJS** for the backend and **ES Modules/JSX** for the frontend.
- **Styling:** Use Vanilla CSS tokens defined in `global.css`. Avoid inline styles or ad-hoc utility classes.
- **Naming:** CamelCase for variables/functions, PascalCase for React components, UPPER_CASE for constants.
- **Security:** Never commit secrets. Use environment variables for all sensitive configuration.

---

## 🧪 Testing Requirements

We maintain a high bar for test coverage (**170+ tests**):
1.  Every new API endpoint must have a corresponding integration test in `api.test.js`.
2.  All utility functions must be unit tested.
3.  Ensure `npm test` passes 100% before opening a Pull Request.

---

## 📝 Commit Messages

We follow a simplified Conventional Commits structure:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation updates
- `chore:` for maintenance (dependency updates, linting)

Example: `feat(api): add Gemini 2.5 flash insights endpoint`

---

## 🚀 Pull Request Process

1.  Update the documentation to reflect your changes (if applicable).
2.  Ensure your code doesn't break existing tests.
3.  Include a brief summary of what the change does and why it was needed.
