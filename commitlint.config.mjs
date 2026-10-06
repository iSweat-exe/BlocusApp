const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allowed commit types (see .dev/checklist-v1.0.0-organisation.md, O-020).
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "refactor",
        "test",
        "chore",
        "perf",
        "ci",
        "build",
        "revert",
        "style",
      ],
    ],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "header-max-length": [2, "always", 100],
  },
};

export default config;
