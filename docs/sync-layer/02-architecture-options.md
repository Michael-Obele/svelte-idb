# 02 — Architecture Options

> Evaluation of packaging approaches for the sync layer: integrated feature, separate npm package, or Vite plugin.

---

## Decision Summary

| Option                       | Verdict         | Rationale                                                    |
| ---------------------------- | --------------- | ------------------------------------------------------------ |
| **A. Built into svelte-idb** | ❌ Rejected     | Breaks "tiny, zero-dependency" identity; massive scope creep |
| **B. Separate npm package**  | ✅ **Selected** | Clean separation, opt-in, independent versioning             |
| **C. Vite plugin**           | ❌ Rejected     | Wrong abstraction layer — sync is runtime, not build-time    |

---

## Option A: Built into svelte-idb Core

Add sync as a configuration option within `createDB()`.

### API Example

```typescript
import { createDB } from 'svelte-idb';
import { drizzleAdapter } from 'svelte-idb/adapters/drizzle';

const db = createDB({
	name: 'myapp',
	schema: {
		/* ... */
	},
	sync: {
		adapter: drizzleAdapter({ db: drizzleInstance }),
		transport: 'http',
		endpoint: '/api/sync',
		conflictResolution: 'lww'
	}
});
```

### Pros

- Single import, single install
- Deep integration with `ChangeNotifier`, `Store<T>`, and `LiveQuery<T>`
- Mutations automatically trigger sync (zero boilerplate)
- No version compatibility issues between packages

### Cons

- **Breaks the "tiny, zero-dependency" identity** that defines svelte-idb
- **Bundle size explosion:** Sync logic, transport adapters, conflict resolution, retry queues — none of this is needed for local-only usage
- **Violates single responsibility:** Storage ≠ Synchronization
- **Scope creep:** Every svelte-idb release now carries sync-related risks
- **Tree-shaking limitation:** Even with dynamic imports, the sync infrastructure code increases the package surface
- **Feature spec contradiction:** `03-feature-spec.md` explicitly lists cloud sync as a "Non-Goal"
- Forces coupling: users who only want local IndexedDB must still carry sync-compatible code paths

### Verdict: ❌ **Rejected**

The sync layer is fundamentally a different concern (network synchronization) from svelte-idb's core domain (local IndexedDB reactivity). Bundling them together violates separation of concerns and undermines svelte-idb's identity as a lightweight wrapper.

---

## Option B: Separate npm Package (`svelte-idb-sync`)

Create a standalone package that depends on svelte-idb as a peer dependency.

### API Example

```typescript
// Install: npm install svelte-idb svelte-idb-sync
import { createDB } from 'svelte-idb';
import { createSync } from 'svelte-idb-sync';
import { drizzleAdapter } from 'svelte-idb-sync/adapters/drizzle';
import { httpTransport } from 'svelte-idb-sync/transports/http';

const db = createDB({
	name: 'myapp',
	schema: {
		/* ... */
	}
});

const sync = createSync(db, {
	serverAdapter: drizzleAdapter({
		/* ... */
	}),
	transport: httpTransport({ endpoint: '/api/sync' }),
	conflictResolution: 'lww'
});

// Start syncing
sync.start();
```

### Pros

- **Preserves svelte-idb's identity:** Core library stays tiny, zero-dependency, focused
- **Opt-in:** Users who don't need sync pay zero cost (no bundle bloat, no complexity)
- **Independent versioning:** Sync layer can iterate (breaking changes, new adapters) without affecting core
- **Clean dependency graph:**
  ```
  svelte-idb (0 deps)  ←  peer dep  ←  svelte-idb-sync
                                         ├── adapter deps (drizzle-orm, @prisma/client, etc.)
                                         └── transport deps (ws, etc.)
  ```
- **Extensible:** Third parties can create their own adapters without forking svelte-idb
- **Follows ecosystem patterns:** Dexie → Dexie Cloud, Firebase → firebase/firestore, etc.
- **Testable independently:** Sync tests don't run in svelte-idb CI; core tests don't need server setup

### Cons

- Users must install and configure two packages
- Requires svelte-idb to expose certain internals (hooks, raw DB access) — must be stable
- Version compatibility between svelte-idb and svelte-idb-sync must be maintained
- Two repos/packages to maintain (or a monorepo)

### Mitigation Strategies

| Concern                      | Solution                                                         |
| ---------------------------- | ---------------------------------------------------------------- |
| Two-package install friction | Provide a `create-svelte-idb-sync` CLI or template               |
| Internal API stability       | Define a `@svelte-idb/internals` contract with semver guarantees |
| Version compatibility        | Peer dependency declaration with compatible version ranges       |
| Maintenance burden           | Monorepo (e.g., Turborepo/pnpm workspaces) with shared CI        |

### Verdict: ✅ **Selected**

This is the clear winner. It preserves svelte-idb's core value proposition while enabling powerful sync capabilities as an opt-in addon.

---

## Option C: Vite Plugin

Create a Vite plugin that adds sync capabilities at build time.

### API Example

```typescript
// vite.config.ts
import { svelteIDBSync } from 'vite-plugin-svelte-idb-sync';

export default defineConfig({
	plugins: [
		sveltekit(),
		svelteIDBSync({
			schema: './src/lib/schema.ts',
			serverAdapter: 'drizzle',
			endpoints: '/api/sync'
		})
	]
});
```

### Pros

- Could auto-generate sync server routes for SvelteKit
- Could transform imports at build time for optimal code splitting
- Could analyze schema at build time for type-safe codegen (like prisma-idb)

### Cons

- **Wrong abstraction layer.** Sync is fundamentally a **runtime concern:**
  - WebSocket connections are established at runtime
  - Conflict resolution runs during data mutations
  - Retry logic, exponential backoff, queue management are all runtime
  - Online/offline detection is runtime
- **Build tool lock-in:** Only works with Vite (excludes Webpack, Rollup-only, Parcel, etc.)
- **No precedent:** Zero, Triplit, ElectricSQL, sveltekit-sync, synceddb — **none** of them use Vite plugins for sync logic
- **Debugging nightmare:** Build-time transforms are opaque; harder to trace sync issues
- **Testing complexity:** Must test both build-time transforms AND runtime behavior
- **Configuration rigidity:** Can't change sync config at runtime (e.g., switch endpoints, enable/disable sync dynamically)

### Verdict: ❌ **Rejected**

Vite plugins are the right tool for build-time concerns (import transforms, asset processing, dev server middleware). Sync is a runtime concern. Using a Vite plugin would be fighting the abstraction.

---

## Selected Architecture: Separate npm Package

### Package Structure (Initial MVP)

```
svelte-idb-sync/
├── src/
│   ├── index.ts                    # createSync(), SyncEngine
│   ├── core/
│   │   ├── sync-engine.ts          # Core sync coordination
│   │   ├── change-log.ts           # Local change tracking
│   │   ├── sync-cursor.ts          # Sync state management
│   │   ├── outbox.ts               # Reliable push with retry
│   │   └── conflict-resolver.ts    # Pluggable conflict resolution
│   ├── adapters/
│   │   ├── types.ts                # ServerAdapter interface
│   │   ├── drizzle.ts              # Drizzle ORM adapter
│   │   ├── prisma.ts               # Prisma adapter
│   │   ├── pg.ts                   # Raw PostgreSQL adapter
│   │   └── sqlite.ts               # Raw SQLite adapter
│   ├── transports/
│   │   ├── types.ts                # Transport interface
│   │   ├── http.ts                 # HTTP/fetch transport
│   │   ├── websocket.ts            # WebSocket transport
│   │   └── sveltekit.ts            # SvelteKit server functions
│   └── svelte/
│       └── sync-status.svelte.ts   # Reactive sync status ($state)
├── package.json                     # peer: svelte-idb, svelte
└── tsconfig.json
```

### Future: Monorepo Split

If adapters grow large (e.g., Prisma adapter needs `@prisma/client` as dependency), split into scoped packages:

```
@svelte-idb-sync/core       → Sync engine + HTTP transport
@svelte-idb-sync/drizzle    → Drizzle adapter (depends on drizzle-orm)
@svelte-idb-sync/prisma     → Prisma adapter (depends on @prisma/client)
@svelte-idb-sync/pg         → Raw PostgreSQL adapter
@svelte-idb-sync/sqlite     → Raw SQLite adapter
@svelte-idb-sync/websocket  → WebSocket transport
```

Start with a single package; split only when dependency sizes warrant it.

### Required Changes to svelte-idb Core

The sync layer needs svelte-idb to expose certain capabilities. These should be added as **non-breaking minor version bumps:**

| Requirement                     | Implementation                                   | Breaking? |
| ------------------------------- | ------------------------------------------------ | --------- |
| Store lifecycle hooks           | `afterAdd`, `afterPut`, `afterDelete` callbacks  | No        |
| Raw IDB database access         | `db.rawDatabase` getter → `IDBDatabase`          | No        |
| Manual ChangeNotifier trigger   | `notifier.manualNotify(storeName)`               | No        |
| Silent writes (no hook trigger) | Direct IDB writes via raw DB, then manual notify | No        |

These are detailed further in [04-adapter-architecture.md](./04-adapter-architecture.md).

---

**[← 01 Research Landscape](./01-research-landscape.md)** | **[Next → 03 Conflict Resolution](./03-conflict-resolution.md)**
