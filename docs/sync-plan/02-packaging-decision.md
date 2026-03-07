# 02 — Packaging Decision

> Should sync be built into `svelte-idb`, a separate npm package, or a Vite plugin? Analysis and verdict.

**← [01 Landscape](./01-landscape-and-inspiration.md)** | **[Next → 03 Conflict Resolution](./03-conflict-resolution.md)**

---

## Options Under Consideration

| Option                         | Description                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| **A. Built into `svelte-idb`** | Add sync directly to the existing library                   |
| **B. Separate npm package**    | Publish as `svelte-idb-sync` (or scoped `@svelte-idb/sync`) |
| **C. Vite plugin**             | Publish as `vite-plugin-svelte-idb-sync`                    |

---

## Option A: Built Into `svelte-idb`

### How It Would Work
Sync code would live inside `src/lib/sync/` and be exported from `svelte-idb/sync`.

```typescript
import { createDB } from 'svelte-idb';
import { enableSync } from 'svelte-idb/sync'; // same package

const db = createDB({ ... });
enableSync(db, { adapter: prismaAdapter(), endpoint: '/api/sync' });
```

### Gains
| Gain                              | Impact                                |
| --------------------------------- | ------------------------------------- |
| Single `npm install`              | Simpler onboarding                    |
| Shared types, no version mismatch | Type safety guaranteed                |
| Access to internal APIs           | Can hook into ChangeNotifier directly |

### Drawbacks
| Drawback                             | Severity                                                            |
| ------------------------------------ | ------------------------------------------------------------------- |
| **Breaks "zero-dependency" promise** | 🔴 Critical — sync needs HTTP/WebSocket utilities                    |
| **Bloats bundle for non-sync users** | 🔴 Critical — from ~4KB to ~14KB+ even with tree-shaking             |
| **Slower release cycles**            | 🟡 Medium — sync changes would block core releases                   |
| **Scope creep**                      | 🟡 Medium — core team must maintain sync logic too                   |
| **Violates current architecture**    | 🔴 Critical — feature spec explicitly lists cloud sync as a non-goal |

### Verdict: ❌ Rejected

The `svelte-idb` feature spec (03-feature-spec.md) explicitly lists "CouchDB/Cloud sync" as a non-goal with the note: *"Massive scope — use PouchDB or Dexie Cloud"*. Building sync in would contradict our own design philosophy and break the zero-dependency guarantee.

---

## Option B: Separate npm Package

### How It Would Work
A new package (`svelte-idb-sync`) with `svelte-idb` as a peer dependency.

```typescript
import { createDB } from 'svelte-idb';
import { createSync, prismaAdapter } from 'svelte-idb-sync';

const db = createDB({ ... });
const sync = createSync(db, {
  adapter: prismaAdapter({
    pushEndpoint: '/api/sync/push',
    pullEndpoint: '/api/sync/pull',
  }),
  conflict: 'server-wins',
});
```

### Repository Structure

Two options for repository organization:

#### Option B1: Monorepo (Recommended)
```
svelte-idb/                      ← existing repo
├── packages/
│   ├── svelte-idb/              ← move existing lib here
│   │   ├── src/lib/
│   │   └── package.json
│   └── svelte-idb-sync/         ← new sync package
│       ├── src/
│       │   ├── core/            ← sync engine (pure TS)
│       │   ├── adapters/        ← prisma, drizzle, raw
│       │   ├── transport/       ← http, websocket
│       │   ├── conflict/        ← resolution strategies
│       │   └── svelte/          ← reactive sync hooks
│       └── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

#### Option B2: Separate Repository
```
svelte-idb-sync/                 ← new repo
├── src/
│   ├── core/
│   ├── adapters/
│   ├── transport/
│   ├── conflict/
│   └── svelte/
├── package.json                 ← peerDependency: "svelte-idb"
└── README.md
```

### Gains
| Gain                                        | Impact                                                                |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `svelte-idb` stays zero-dependency and tiny | 🟢 Critical — preserves core identity                                  |
| Independent versioning                      | 🟢 High — sync can evolve at its own pace                              |
| Opt-in complexity                           | 🟢 High — users who don't need sync don't pay for it                   |
| Clear separation of concerns                | 🟢 High — easier to maintain, test, document                           |
| Can have its own dependencies               | 🟢 High — HTTP clients, CRDT libs, etc. without polluting core         |
| Tree-shakeable adapter imports              | 🟢 Medium — `import { drizzleAdapter } from 'svelte-idb-sync/drizzle'` |
| Monorepo still allows shared dev workflow   | 🟢 Medium — single `bun install`, shared CI                            |

### Drawbacks
| Drawback                             | Severity                                  |
| ------------------------------------ | ----------------------------------------- |
| Two packages to install              | 🟡 Low — standard pattern, well understood |
| Peer dependency version coordination | 🟡 Low — semver handles this               |
| Can't access private internals       | 🟡 Low — ChangeNotifier is already public  |
| Monorepo migration effort (B1)       | 🟡 Medium — one-time setup cost            |

### Verdict: ✅ Recommended

This is the standard pattern used by:
- `@tanstack/query-core` + `@tanstack/svelte-query`
- `@trpc/server` + `@trpc/client`
- `drizzle-orm` + `drizzle-kit`
- `@powersync/common` + `@powersync/drizzle-driver`

---

## Option C: Vite Plugin

### How It Would Work
A Vite plugin that auto-injects sync configuration and generates server-side API routes.

```typescript
// vite.config.ts
import { svelteIDBSync } from 'vite-plugin-svelte-idb-sync';

export default defineConfig({
  plugins: [
    svelteIDBSync({
      schema: './src/lib/db/schema.ts',
      adapter: 'prisma',
      generateRoutes: true, // creates /api/sync/push, /api/sync/pull
    })
  ]
});
```

### Gains
| Gain                            | Impact                            |
| ------------------------------- | --------------------------------- |
| Auto-generates server routes    | 🟡 Medium — less boilerplate       |
| Build-time schema validation    | 🟡 Medium — catch mismatches early |
| Can inject `.env` configuration | 🟡 Low — nice but not essential    |

### Drawbacks
| Drawback                         | Severity                                                   |
| -------------------------------- | ---------------------------------------------------------- |
| **Vite-only**                    | 🔴 Critical — excludes non-Vite users                       |
| **Opinionated route generation** | 🔴 Critical — conflicts with custom server setups           |
| **Debugging is harder**          | 🟡 Medium — generated code is harder to reason about        |
| **Not the right tool**           | 🔴 Critical — sync is runtime, not build-time               |
| **Framework coupling**           | 🔴 Critical — SvelteKit route conventions are not universal |

### Verdict: ❌ Rejected

A Vite plugin is appropriate when you need to transform files at build time (e.g., icon imports, CSS processing, route generation). Sync is fundamentally a **runtime** concern. The sync engine needs to run in the browser, make network requests, handle conflicts — none of which are build-time operations.

However, we may offer a **companion Vite plugin** in the future for DX sugar (auto-generating server route stubs, schema validation), but the core sync logic should be a standalone npm package.

---

## Final Decision

### ✅ Option B: Separate npm Package (Monorepo)

**Package name:** `svelte-idb-sync`
**Repository:** Monorepo within the existing `svelte-idb` repo (B1)

```
npm install svelte-idb svelte-idb-sync
```

### Why Monorepo Over Separate Repo?

| Factor                | Monorepo                             | Separate Repo          |
| --------------------- | ------------------------------------ | ---------------------- |
| Shared CI/CD          | ✅ Single pipeline                    | ❌ Duplicate config     |
| Cross-package testing | ✅ Easy integration tests             | ❌ Complex mocking      |
| Coordinated releases  | ✅ Changesets or Turborepo            | ❌ Manual coordination  |
| Developer experience  | ✅ Single clone, single `bun install` | ❌ Two repos to manage  |
| Type sharing          | ✅ Workspace references               | ❌ Published types only |

### Migration Path

1. **Phase 0:** Restructure existing repo into monorepo (move `svelte-idb` into `packages/`)
2. **Phase 1:** Create `packages/svelte-idb-sync/` with core sync engine
3. **Phase 2+:** Build adapters, transport layers, conflict strategies

> **Note:** The monorepo migration is optional and can be deferred. We can start `svelte-idb-sync` as a separate package in the same repo using a workspace-based approach without fully restructuring.

---

### Future Consideration: Vite Plugin Companion

```
npm install svelte-idb svelte-idb-sync vite-plugin-svelte-idb-sync
```

The Vite plugin would be a thin DX layer:
- Auto-generate SvelteKit server route stubs for sync endpoints
- Validate schema compatibility at build time
- Inject sync configuration from `.env`

This is a **post-v1** consideration.

---

**← [01 Landscape](./01-landscape-and-inspiration.md)** | **[Next → 03 Conflict Resolution](./03-conflict-resolution.md)**
