# Testing Guide

This repository uses `Vitest` with a `jsdom` browser-like environment to test browser scripts in the `modules/` folder.

## What Is Used

- `vitest`: test runner and assertion/mocking framework
- `jsdom`: DOM environment for browser-facing scripts
- `@vitest/coverage-v8`: coverage provider for coverage reports

The current test suite lives under `tests/`.

## Fresh Clone Setup

From a fresh clone, run these steps from the repository root.

### 1. Verify prerequisites

Required:

- Node.js 20+ recommended
- npm 10+ recommended

Check versions:

```powershell
node --version
npm --version
```

### 2. Install dependencies

```powershell
npm install
```

This installs the test harness declared in [package.json](package.json).

## Running Tests

### Run the full suite once

```powershell
npm run test:run
```

### Run tests in watch mode

```powershell
npm test
```

### Run tests with coverage

```powershell
npm run test:coverage
```

Coverage output is written to `coverage/`.

## Current Test Structure

- `tests/helpers/script-loader.js`: loads browser-global scripts into the jsdom environment
- `tests/utils.test.js`: tests shared utility behavior from `modules/utils.js`
- `tests/custom-select.test.js`: tests the dropdown UI helper from `modules/custom-select.js`
- `tests/stats-data.test.js`: tests shared stats fetch/normalization helpers from `modules/stats-data.js`
- `tests/navigation.test.js`: tests navigation behaviors from `modules/navigation.js`
- `tests/pagination.test.js`: tests pagination state, navigation, and HTML generation helpers
- `tests/template-helper.test.js`: tests loading/error/no-results rendering and table/pagination helpers
- `tests/flag-helper.test.js`: tests country mapping and flag HTML rendering behavior
- `tests/data-normalizer.test.js`: tests row normalization and extract helper functions
- `tests/status-display.test.js`: tests status counters, timestamps, and LED state logic
- `tests/tab-manager.test.js`: tests tab switching and tab event behavior
- `tests/hall-of-fame.test.js`: tests Hall of Fame render and search-based visibility
- `tests/driver-search.test.js`: integration tests for search input and result flow
- `tests/detail.test.js`: integration tests for detail page data load and error rendering
- `tests/track-info.test.js`: integration tests for track combinations rendering and empty-state handling
- `tests/car-info.test.js`: integration tests for cars table rendering and empty-state behavior

Current total: 29 test files and 231 tests.

## How Browser Scripts Are Tested Here

Most code in this repo is written as browser-global scripts instead of ES modules. That has consequences:

- many files attach objects directly to `window`
- many files access `document` immediately
- some files auto-run on load through IIFEs
- some files depend on global helpers like `R3EUtils`, `TemplateLoader`, `dataService`, or `FlagHelper`

Because of that, tests use jsdom plus the helper in `tests/helpers/script-loader.js` to execute scripts in a controlled environment.

## Adding New Tests

When adding tests, prefer these rules.

### Prefer stable units first

Good first targets:

- pure helpers
- formatting logic
- data transformation logic
- DOM widgets with contained behavior

Harder targets:

- large page controllers
- modules with remote fetches and many globals
- scripts that auto-run immediately when loaded

### Mock globals explicitly

If a module expects globals, define them in the test before loading the script.

Common examples:

- `window.R3EUtils`
- `window.TemplateLoader`
- `window.dataService`
- `window.FlagHelper`
- `window.getCarClassId`

### Load class-declaring scripts once per suite

Some scripts declare top-level classes like `class CustomSelect` or `class Navigation`.

Do this:

- load them in `beforeAll`
- reset DOM state in `beforeEach`

Avoid loading those same files repeatedly in `beforeEach`, because top-level class declarations will throw redeclaration errors.

### Use relative URLs in jsdom history

When changing location state in tests, use relative paths.

Good:

```js
window.history.replaceState({}, '', '/?driver=Alex');
```

Avoid absolute origins unless the environment was initialized with the same origin.

## Suggested Testing Strategy For Remaining Modules

Work in layers.

### Layer 1: pure/shared logic

- `modules/pagination.js`
- `modules/template-helper.js`
- `modules/flag-helper.js`
- selected functions from `modules/data-normalizer.js`

### Layer 2: isolated DOM helpers

- `modules/status-display.js`
- `modules/tab-manager.js`
- `modules/hall-of-fame.js`

### Layer 3: controller/integration-heavy modules

- `modules/pages/driver-search.js`
- `modules/pages/detail.js`
- `modules/pages/track-info.js`
- `modules/pages/car-info.js`

For those, prefer integration-style tests with mocked globals and DOM fixtures instead of pretending they are small isolated units.

## Things To Watch Out For

- If a module fetches data, mock `fetch`.
- If a module depends on compressed payloads, mock `DecompressionStream` and `Response` as needed.
- If a module mutates `window`, reset or overwrite those globals between tests.
- If a module auto-initializes on `DOMContentLoaded`, control `document.readyState` carefully in the test.
- If you move scripts that are loaded by HTML, update cache-busting query strings in HTML references.

## Commands Summary

Install dependencies:

```powershell
npm install
```

Run tests once:

```powershell
npm run test:run
```

Run tests in watch mode:

```powershell
npm test
```

Run coverage:

```powershell
npm run test:coverage
```

## Troubleshooting

If tests fail after changing the harness:

1. Run `npm run test:run` first, not coverage.
2. Check whether a script is being loaded more than once in the same suite.
3. Check whether required globals were mocked before loading the script.
4. Check whether jsdom URL/history state is being changed using safe relative paths.
5. Check whether a module is really a unit-test target or should be tested as a broader integration case.

## About stderr Messages During Tests

You may see `stderr` lines in successful runs. Some tests intentionally exercise warning/error paths and the modules log to console as part of normal behavior.

Example:

```text
stderr | tests/hall-of-fame.test.js > hall-of-fame – missing StatsData > does not throw and leaves the container empty when StatsData is absent
StatsData module is not available for Hall of Fame.
```

This is expected for that specific negative-path test:

- the test intentionally runs Hall of Fame without `window.StatsData`
- the module logs a warning (`console.warn`) by design
- the test passes because it verifies graceful handling (no crash, safe empty state)

If all tests pass, these messages are informational and not a failure by themselves.