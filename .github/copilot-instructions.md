# svelte-idb — AI Coding Instructions

You are working on **svelte-idb**, a tiny, zero-dependency, SSR-safe IndexedDB wrapper designed specifically for **Svelte 5 runes**.

## 🏗️ Architecture & Boundaries

The project follows a tiered architecture to ensure framework-agnostic core logic and Svelte-specific reactivity.

- **Layer 1: Native IndexedDB** — Pure browser API. Never expose `IDBOpenDBRequest` directly; wrap in Promises.
- **Layer 2: Core Engine (`src/lib/core/`)** — Framework-agnostic TypeScript. **No Svelte imports/runes**.
  - `database.ts`: `createDB()` factory (using factory pattern for better tree-shaking).
  - `store.ts`: `Store<T>` CRUD operations.
  - `ssr-guard.ts`: Detects server environment and returns "noop" implementations.
- **Layer 3: Svelte Layer (`src/lib/svelte/`)** — Uses Svelte 5 runes.
  - Files MUST end in `.svelte.ts`.
  - Use `$state`, `$derived`, and `$effect` for "live queries" (`liveAll`, `liveGet`).
  - No legacy Svelte stores (`writable`, `readable`).

## 🛠️ Key Conventions

- **Reactivity Model**: Mutations in `Store<T>` (e.g., `add()`, `put()`, `delete()`) MUST trigger a `ChangeNotifier`. Reactive hooks/classes in `src/lib/svelte/` subscribe to this notifier to trigger `$state` updates in `LiveQuery<T>`.
- **Cross-Tab Support**: Plan for cross-tab reactivity via `BroadcastChannel` in `ChangeNotifier` (can be enabled via `DatabaseConfig`).
- **TypeScript**: Use `DBSchema` pattern (inspired by `idb` library) for full generic type inference.
- **SSR Safety**: Always wrap IndexedDB calls through `ssr-guard.ts`. Use `esm-env`'s `BROWSER` constant instead of `$app/environment` to keep the core library framework-agnostic. Operations on the server should return safe defaults (e.g., empty arrays) rather than throwing.
- **Classes & Runes**: When using `$state` in class fields (in `.svelte.ts` files), prefer arrow functions for methods that will be passed as callbacks (like `reset = () => { ... }`) to maintain `this` context.
- **File Naming**:
  - Pure TS logic: `.ts` (No Svelte imports/runes)
  - Svelte Runes logic: `.svelte.ts` (Required for `$state` in classes)
  - Showcase/Examples: `src/routes/`

## 🚀 Core Implementation Roadmap

The project aims for a fast-paced implementation of the following phases. Do not limit work to a single phase; move to the next as soon as prerequisites are met.

- **Phase 0: Tooling & Setup** — Scaffold project, Vitest Browser Mode (Playwright), ESM exports.
- **Phase 1: Core Engine (MVP)** — `Database`, `Store<T>`, `DBSchema`, `ssr-guard`, `prepare-value`, `ChangeNotifier`.
- **Phase 2: Reactive Layer** — `LiveQuery<T>` ($state), `liveAll`, `liveGet`, `liveCount`, microtask batching.
- **Phase 3: DX Polish** — Query builder (`where().equals()`), transactions, bulk operations, debug mode, lifecycle hooks.
- **Phase 4: v1.0 Release** — Documentation, demo site, npm publishing, cleanup.

_Refer to `docs/sveltekit-idb-library/08-implementation-roadmap.md` for the granular task list._

## 🧪 Testing

- **Vitest Browser Mode**: Use for all tests (powered by Playwright).
- **Real Browsers**: Test in actual Chromium/Firefox instead of mocks (like `fake-indexeddb`) to ensure native IndexedDB compliance and SSR safety.
- **Integration**: Validate the full flow from `createDB()` through `Store<T>` operations using real browser storage.
- **SSR Testing**: Use Vitest to verify that code runs on the server without accessing `window` or `indexedDB` directly, relying on `ssr-guard.ts`.

## 📦 Packaging

- Use `npm run build` to package the library via `@sveltejs/package`.
- Exports are defined in `package.json`. Sub-path exports should be configured for both `.` (core) and `./svelte` (reactive) to support clean imports.
- **Source Maps**: The `files` array in `package.json` should include `"src/lib"` (alongside `"dist"`) to support "Go to Definition" in consumers' editors.
