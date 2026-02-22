# 08 — Implementation Roadmap

> Phased milestones from MVP to v1.0 with clear deliverables.

**← [07 Architecture](./07-architecture.md)** | **[Back to README →](./README.md)**

---

## Timeline Overview

```
Phase 0 ──── Phase 1 ──── Phase 2 ──── Phase 3 ──── Phase 4
 Setup        Core          Reactive      DX Polish     v1.0
 ~1 day       ~3 days       ~3 days       ~3 days       ~2 days
              ▲                            ▲
              │                            │
         First usable                 Publishable
           release                     to npm
```

---

## Phase 0: Project Setup (~1 day)

**Goal:** Scaffolded SvelteKit library project with tooling configured.

### Tasks

- [ ] Scaffold project: `npx sv create svelte-idb --template library --types ts`
- [ ] Configure `package.json` with correct `exports`, `peerDependencies`, `keywords`
- [ ] Set up Vitest with Browser Mode (powered by Playwright) for testing in real browsers
- [ ] Configure `tsconfig.json` with strict mode
- [ ] Create folder structure (`src/lib/core/`, `src/lib/svelte/`, `src/lib/utils/`)
- [ ] Add `README.md` with project vision and install instructions
- [ ] Set up `LICENSE` (MIT)
- [ ] Initialize git repo with `.gitignore`

### Deliverables

```
svelte-idb/
├── src/lib/core/          (empty, ready for implementation)
├── src/lib/svelte/        (empty, ready for implementation)
├── package.json           (configured)
├── vite.config.ts         (vitest browser mode setup)
├── tsconfig.json          (strict)
└── README.md              (basic)
```

### Definition of Done

- `bun run check` passes
- `bun run test` runs (no tests yet, but no errors)
- `bun run package` produces a `dist/` directory

---

## Phase 1: Core Engine — MVP (~3 days)

**Goal:** Fully working CRUD with typed schema, SSR safety, and tests.

### Day 1: Types & Schema

- [ ] Define all TypeScript types in `types.ts`:
  - `DBSchema`, `StoreConfig`, `IndexConfig`
  - `DatabaseConfig<TSchema>`
  - `Database<TSchema>`, `Store<T>`
  - `WithId<T>`, `WithoutId<T>`
- [ ] Implement `prepare-value.ts` — autoIncrement key stripping
- [ ] Implement `ssr-guard.ts` — browser detection + SSR proxy
- [ ] Write tests for `prepare-value` and `ssr-guard`

### Day 2: Store & Database

- [ ] Implement `store.ts` — `Store<T>` class:
  - `add()`, `put()`, `get()`, `getAll()`, `getAllFromIndex()`
  - `delete()`, `clear()`, `count()`
  - Promise wrapping of IDB requests
- [ ] Implement `schema-manager.ts`:
  - Parse `StoreConfig` objects
  - Create stores and indexes in `onupgradeneeded`
  - Handle existing store detection
- [ ] Implement `database.ts` — `createDB()` factory:
  - Open IDB connection
  - Apply schema via SchemaManager
  - Create `Store<T>` instances
  - Return typed `Database<TSchema>` object
- [ ] Write CRUD tests: add, put, get, getAll, delete, clear, count

### Day 3: Errors, SSR Integration & Polish

- [ ] Implement `errors.ts` — typed error hierarchy
- [ ] Wire SSR guard into `createDB()` and `Store`
- [ ] Implement `change-notifier.ts` (no reactive consumers yet, but the pub/sub is ready)
- [ ] Create `index.ts` barrel export
- [ ] Write integration tests (full flow: create DB → add → get → delete)
- [ ] Write SSR tests (operations return safe defaults)
- [ ] Run `bun run check` + `bun run package` — verify clean output

### Deliverables

```typescript
// This should work after Phase 1:
import { createDB } from 'svelte-idb';

const db = createDB({
	name: 'test',
	version: 1,
	stores: {
		users: { keyPath: 'id', autoIncrement: true }
	}
});

const id = await db.users.add({ name: 'Alice' });
const user = await db.users.get(id);
const all = await db.users.getAll();
await db.users.delete(id);
```

### Definition of Done

- Full CRUD operations work with typed schema
- SSR returns safe defaults without errors
- 90%+ test coverage on core module
- `bun run check` + `bun run package` pass

---

## Phase 2: Reactive Layer (~3 days)

**Goal:** Live queries that automatically update when data changes.

### Day 4: LiveQuery Foundation

- [ ] Implement `live-query.svelte.ts` — `LiveQuery<T>` class:
  - `$state`-backed `current`, `loading`, `error`
  - Subscribe to `ChangeNotifier`
  - Re-query on notification
  - `destroy()` cleanup
- [ ] Wire mutation notifications into `Store<T>`:
  - `add()` → notify
  - `put()` → notify
  - `delete()` → notify
  - `clear()` → notify
- [ ] Implement microtask batching in `ChangeNotifier`
- [ ] Write tests for `LiveQuery` (using Vitest Browser Mode + Svelte testing)

### Day 5: Convenience Methods

- [ ] Add `store.liveAll()` method (returns `LiveQuery<T[]>`)
- [ ] Add `store.liveGet(key)` method (returns `LiveQuery<T | undefined>`)
- [ ] Add `store.liveCount()` method (returns `LiveQuery<number>`)
- [ ] Add `db.liveQuery(fn, storeNames)` method (custom queries)
- [ ] Add `LiveQuery.refresh()` for manual re-query
- [ ] Write tests for each convenience method

### Day 6: SSR + Edge Cases

- [ ] SSR behavior for LiveQuery (return initial value, no subscription)
- [ ] Handle component unmount (auto-cleanup of subscriptions)
- [ ] Handle rapid mutations (verify batching works correctly)
- [ ] Handle concurrent queries (no race conditions)
- [ ] Handle DB connection loss (error propagation)
- [ ] Create `svelte/index.ts` barrel export
- [ ] Integration test: component → liveQuery → mutation → re-render

### Deliverables

```svelte
<!-- This should work after Phase 2: -->
<script lang="ts">
  import { createDB } from 'svelte-idb';

  const db = createDB({ name: 'test', version: 1, stores: { ... } });
  const users = db.users.liveAll();
</script>

{#each users.current as user}
	<p>{user.name}</p>
{/each}

<button onclick={() => db.users.add({ name: 'New User' })}>
	Add User (list updates automatically)
</button>
```

### Definition of Done

- Live queries react to mutations without manual re-fetching
- Microtask batching prevents excessive re-queries
- SSR returns safe defaults for LiveQuery
- Component cleanup properly unsubscribes
- Tests cover all reactive scenarios

---

## Phase 3: DX Polish (~3 days)

**Goal:** Query builder, transactions, better errors, debug mode.

### Day 7: Query Builder

- [ ] Implement chainable query builder:
  - `where(indexName)` → `WhereClause`
  - `.equals(value)` → `QueryBuilder`
  - `.between(lower, upper)` → `QueryBuilder`
  - `.above(value)` / `.below(value)` → `QueryBuilder`
  - `.toArray()` → `Promise<T[]>`
  - `.first()` → `Promise<T | undefined>`
  - `.count()` → `Promise<number>`
- [ ] Wire query builder results into LiveQuery (reactive where queries)
- [ ] Write tests for query builder

### Day 8: Transactions & Bulk

- [ ] Implement `db.transaction(storeNames, callback)`:
  - Multi-store transactions
  - Auto-commit on success
  - Auto-rollback on error
- [ ] Implement bulk operations:
  - `addMany(values)` — single transaction
  - `putMany(values)` — single transaction
  - `deleteMany(keys)` — single transaction
- [ ] Write tests for transactions and bulk operations

### Day 9: Errors, Debug Mode & Hooks

- [ ] Implement typed error wrapping (catch DOMException → typed error)
- [ ] Implement debug mode:
  - `[svelte-idb]` console prefix
  - Log all operations with timing
  - Toggleable via `debug: true` in config
- [ ] Implement middleware hooks:
  - `beforeAdd`, `afterAdd`
  - `beforePut`, `afterPut`
  - `beforeDelete`, `afterDelete`
- [ ] Write tests for errors, debug mode, hooks

### Deliverables

- Chainable query builder works
- Multi-store transactions with auto-commit/rollback
- Bulk operations in single transaction
- Debug mode with console logging
- Middleware hooks for lifecycle events

### Definition of Done

- All Tier 3 features implemented and tested
- `bun run check` passes
- `bun run package` produces clean output

---

## Phase 4: v1.0 Release (~2 days)

**Goal:** Production-ready library published to npm.

### Day 10: Documentation & Demo

- [ ] Write comprehensive `README.md`:
  - Installation
  - Quick start (5-line example)
  - Full API reference
  - Comparison with alternatives
  - Contributing guide
- [ ] Build demo site in `src/routes/`:
  - Interactive CRUD demo
  - Live query visualization
  - Code examples
- [ ] Add `CHANGELOG.md`
- [ ] Add `CONTRIBUTING.md`

### Day 11: Publish

- [ ] Final test sweep: `bun run check && bun run test`
- [ ] `bun run package` → verify `dist/` contents
- [ ] `npm publish --dry-run` → verify published files
- [ ] Tag release: `git tag v1.0.0`
- [ ] Publish: `npm publish --access public`
- [ ] Deploy demo site to Vercel/Netlify
- [ ] Announce on social media / Svelte Discord

### Definition of Done

- Published on npm as `svelte-idb`
- Demo site live and accessible
- README has clear install + usage instructions
- All tests pass, types resolve correctly in consumer projects

---

## Post-Launch: Future Roadmap

| Version | Feature                                      | Priority |
| ------- | -------------------------------------------- | -------- |
| v1.1    | Cross-tab reactivity via BroadcastChannel    | High     |
| v1.2    | Cursor-based pagination (`iterate()`)        | Medium   |
| v1.3    | Export/Import (JSON backup)                  | Medium   |
| v1.4    | Migration sugar (`addColumn`, `renameStore`) | Low      |
| v2.0    | Plugin system (encryption, sync)             | Low      |
| v2.x    | DevTools panel/extension                     | Low      |

---

## Risk Assessment

| Risk                                       | Likelihood | Impact | Mitigation                                                               |
| ------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------ |
| Svelte 5 runes API changes                 | Low        | High   | Pin to Svelte 5.x, follow RC                                             |
| `.svelte.ts` compilation issues            | Medium     | Medium | Test with latest `@sveltejs/package`                                     |
| `vitest/browser` incompatibilities         | Low        | Medium | Ensure headless Playwright instance runs fine in CI                      |
| Name collision (`svelte-idb` taken on npm) | Medium     | Low    | Check availability; have fallbacks (`svelte-indexeddb`, `sveltekit-idb`) |
| Performance with large datasets            | Medium     | Medium | Benchmark early; add pagination in v1.2                                  |

---

## Success Metrics

| Metric                     | Target at 3 months            |
| -------------------------- | ----------------------------- |
| npm weekly downloads       | 500+                          |
| GitHub stars               | 100+                          |
| Bundle size                | < 5KB min+gz                  |
| Test coverage              | > 90% on core                 |
| Open issues                | < 10                          |
| Documentation completeness | Full API reference + examples |

---

**← [07 Architecture](./07-architecture.md)** | **[Back to README →](./README.md)**
