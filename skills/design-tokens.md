# Skill: Design Tokens

- Use `styles/tokens.css` for colors, spacing, radii, font sizes, font weights, z-index, and shadows.
- Reference existing `var(--token-name)` values; avoid hardcoding design-system values.
- Follow naming patterns: `--color-*`, `--space-*`, `--font-size-*`, `--font-weight-*`, `--radius-*`, `--z-*`, `--shadow-*`, `--line-height-*`.
- Do not use legacy alias names like `--primary-color`, `--surface`, `--border`, `--text-primary`, `--text-secondary`, `--hover-bg`, `--accent`, or `--shadow`.
- Add new tokens only when existing tokens do not already cover the value.
- Use pixel values only for content-specific dimensions such as images or icon sizes.
