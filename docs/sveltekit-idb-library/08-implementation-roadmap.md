# 08 — Implementation Roadmap

> Phased milestones from MVP to v1.0 with clear deliverables.
> **Note:** For granular task tracking, please refer to the [TODO.md](./TODO.md).

**← [07 Architecture](./07-architecture.md)** | **[Back to README →](./README.md)**

---

## Timeline Overview

```text
Phase 0 ──── Phase 1 ──── Phase 2 ──── Phase 3 ──── Phase 4
 Setup        Core          Reactive      DX Polish     v1.0
              ▲                            ▲
              │                            │
         First usable                 Publishable
           release                     to npm
```

---

## Phase 0: Project Setup

**Goal:** Scaffolded SvelteKit library project with tooling configured.

> **Tasks Status:** Tracked in [TODO.md](./TODO.md#phase-0-project-setup)

### Deliverables

```text
svelte-idb/
├── src/lib/core/          
├── src/lib/svelte/        
├── package.json           (configured)
├── vite.config.ts         (vitest browser mode setup)
├── tsconfig.json          (strict)
└── README.md              
```

### Definition of Done

- `bun run check` passes
- `bun run package` produces a `dist/` directory
- Core repository config and standard community files are in place

---

## Phase 1: Core Engine — MVP

**Goal:** Fully working CRUD with typed schema, SSR safety, and tests.

> **Tasks Status:** Tracked in [TODO.md](./TODO.md#phase-1-core-engine)

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
- Core module logic works under strict TypeScript checks
- `bun run check` + `bun run package` pass

---

## Phase 2: Reactive Layer

**Goal:** Live queries that automatically update when data changes.

> **Tasks Status:** Tracked in [TODO.md](./TODO.md#phase-2-reactive-layer)

### Deliverables

```html
<!-- This should work after Phase 2: -->
<script lang="ts">
  import { createReactiveDB } from 'svelte-idb/svelte';

  const db = createReactiveDB({ name: 'test', version: 1, stores: { /* ... */ } });
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

---

## Phase 3: DX Polish

**Goal:** Query builder, transactions, better errors, debug mode.

> **Tasks Status:** Tracked in [TODO.md](./TODO.md#phase-3-dx-polish--advanced-features-pending)

### Deliverables

- Chainable query builder works (`where().equals().toArray()`)
- Multi-store transactions with auto-commit/rollback
- Bulk operations in single transaction (`addMany`, etc.)
- Debug mode with console logging
- Middleware hooks for lifecycle events

### Definition of Done

- All Phase 3 features implemented and tested
- `bun run check` passes

---

## Phase 4: v1.0 Release

**Goal:** Production-ready library published to npm.

> **Tasks Status:** Tracked in [TODO.md](./TODO.md#phase-4-v10-release)

### Deliverables

- Comprehensive `README.md`
- Interactive demo/playground in `src/routes/`
- `CHANGELOG.md`
- Successfully published to npm

### Definition of Done

- Published on npm as `svelte-idb`
- Demo site live and accessible
- All tests pass

---

## Post-Launch: Future Roadmap

| Version | Feature                                      | Priority |
| ------- | -------------------------------------------- | -------- |
| v1.1    | Cross-tab reactivity via BroadcastChannel    | High     |
| v1.2    | Cursor-based pagination (`iterate()`)        | Medium   |
| v1.3    | Export/Import (JSON backup)                  | Medium   |
| v1.4    | Migration sugar (`addColumn`, `renameStore`) | Low      |
| v2.0    | Plugin system (encryption, sync)             | Low      |

---

## Risk Assessment

| Risk                               | Likelihood | Impact | Mitigation                                          |
| ---------------------------------- | ---------- | ------ | --------------------------------------------------- |
| Svelte 5 runes API changes         | Low        | High   | Pin to Svelte 5.x, follow RC                        |
| `.svelte.ts` compilation issues    | Medium     | Medium | Test with latest `@sveltejs/package`                |
| `vitest/browser` incompatibilities | Low        | Medium | Ensure headless Playwright instance runs fine in CI |

---

## Success Metrics

| Metric                     | Target at 3 months            |
| -------------------------- | ----------------------------- |
| Bundle size                | < 5KB min+gz                  |
| Documentation completeness | Full API reference + examples |

---

**← [07 Architecture](./07-architecture.md)** | **[Back to README →](./README.md)**
