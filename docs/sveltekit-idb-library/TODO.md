# 📋 svelte-idb — Development TODO Tracking

> This document tracks the status of the library implementation against the original roadmap and specification.

---

## ✅ Phase 0: Project Setup
- [x] Scaffold project (`@sveltejs/package`)
- [x] Configure `package.json` (`exports`, `peerDependencies`, `keywords`, dual-exports)
- [x] Configure `tsconfig.json` (strict mode)
- [x] Create folder structure (`src/lib/core`, `src/lib/svelte`, `src/lib/utils`)
- [x] Add detailed `README.md` with install and usage instructions
- [x] Set up standard GitHub community files (`LICENSE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`)
- [x] Create GitHub issue/PR templates (`bug_report.yml`, `feature_request.yml`, `PULL_REQUEST_TEMPLATE.md`)
- [x] Set up Tailwind CSS for the demo playground
- [ ] Set up Vitest with Browser Mode (powered by Playwright) for testing

---

## ✅ Phase 1: Core Engine
- [x] Define all TypeScript types (`DBSchema`, `StoreConfig`, `IndexConfig`, `DatabaseConfig`, `IStore`, `ChangeEvent`, etc.)
- [x] Implement `utils/prepare-value.ts` (AutoIncrement key stripping)
- [x] Implement `utils/ssr.ts` (Framework-agnostic SSR guard and proxies)
- [x] Implement `core/store.ts` (`Store<T>` CRUD operations: `add`, `put`, `get`, `getAll`, `getAllFromIndex`, `delete`, `clear`, `count`)
- [x] Implement `core/schema-manager.ts` (IDB schema application on upgrade)
- [x] Implement `core/database.ts` (`createDB` factory)
- [x] Implement `core/errors.ts` (Typed error hierarchy: `IDBNotFoundError`, `IDBConstraintError`, etc.)
- [x] Create `src/lib/index.ts` barrel export
- [ ] Write Vitest/Browser tests for core modules

---

## ✅ Phase 2: Reactive Layer
- [x] Implement `core/change-notifier.ts` (Microtask-batched Pub/Sub system)
- [x] Implement `svelte/live-query.svelte.ts` (Reactive `$state` wrapper class)
- [x] Implement `svelte/reactive-store.svelte.ts` (`liveAll`, `liveGet`, `liveCount` methods)
- [x] Implement `svelte/create-reactive-db.svelte.ts` (`createReactiveDB` wrapper)
- [x] Wire mutations (`add`, `put`, `delete`, `clear`) to trigger change notifications
- [x] Create `src/lib/svelte/index.ts` barrel export
- [ ] Write Vitest/Svelte tests for reactive layer

---

## 🏗️ Phase 3: DX Polish & Advanced Features (PENDING)

### Query Builder
- [ ] Implement chainable query builder (`where(indexName)`)
- [ ] Implement `.equals()`, `.between()`, `.above()`, `.below()`
- [ ] Implement `.toArray()`, `.first()`, `.count()`
- [ ] Wire query builder results into `LiveQuery` for reactive `where` queries
- [ ] Write tests for the query builder

### Transactions & Bulk Operations
- [ ] Implement `db.transaction(storeNames, callback)` with auto-commit/rollback
- [ ] Implement `addMany(values)`
- [ ] Implement `putMany(values)`
- [ ] Implement `deleteMany(keys)`
- [ ] Write tests for transactions and bulk operations

### Debug Mode & Hooks
- [x] Implement debug mode (basic `console.log` working inside `Store`)
- [ ] Implement detailed debug logging with timing `console.time`
- [ ] Implement middleware hooks (`beforeAdd`, `afterAdd`, `beforePut`, `afterPut`, `beforeDelete`, `afterDelete`)
- [ ] Write tests for errors, debug mode, and hooks

---

## 🎯 Phase 4: v1.0 Release
- [x] Build interactive demo site in `src/routes/` with Tailwind + Lucide UI
- [x] Write comprehensive API reference in `README.md`
- [ ] Add `CHANGELOG.md`
- [ ] Final test sweep running cleanly in CI
- [ ] `npm publish --dry-run` to verify published files
- [ ] Tag release `git tag v1.0.0`
- [ ] Publish `npm publish --access public`
- [ ] Deploy demo site (Vercel/Netlify)
- [ ] Announce on social media / Svelte Discord

---

## 🔮 Future Roadmap (Post-Launch)
- [ ] **Cross-tab reactivity** (BroadcastChannel API integration)
- [ ] **Cursor-based pagination** (`iterate()`)
- [ ] **Export/Import** (JSON backup)
- [ ] **Migration sugar** (`addColumn`, `renameStore`)
- [ ] **Plugin system** (encryption, sync)
- [ ] **DevTools panel/extension**
