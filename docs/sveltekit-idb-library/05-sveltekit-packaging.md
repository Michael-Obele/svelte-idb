# 05 — SvelteKit Packaging

> How to scaffold, build, and publish a SvelteKit library via `@sveltejs/package`.

**← [04 Svelte 5 Reactivity](./04-svelte5-reactivity.md)** | **[Next → 06 API Design](./06-api-design.md)**

---

## Overview

SvelteKit has first-class support for building and publishing npm packages via `@sveltejs/package`. The library template uses `src/lib` as the public-facing source and `src/routes` as a demo/docs site.

---

## Scaffolding

### Using `sv create`

```bash
npx sv create svelte-idb --template library --types ts
cd svelte-idb
bun install
```

The `--template library` flag sets up:

- `@sveltejs/package` as a dev dependency
- A `package` script in `package.json`
- `src/lib/` as the library root
- `src/routes/` as a demo/documentation site

### Key CLI Options

| Flag           | Value     | Purpose                                            |
| -------------- | --------- | -------------------------------------------------- |
| `--template`   | `library` | Sets up `svelte-package` for library mode          |
| `--types`      | `ts`      | TypeScript with `.ts` files and `lang="ts"`        |
| `--no-add-ons` | —         | Skip add-ons (tailwind, etc.) — we don't need them |

---

## Project Structure

```
svelte-idb/
├── src/
│   ├── lib/                          ← Published to npm
│   │   ├── index.ts                  ← Main entry point
│   │   ├── core/
│   │   │   ├── database.ts           ← createDB() factory
│   │   │   ├── store.ts              ← Store<T> class
│   │   │   ├── schema.ts             ← Schema types & validation
│   │   │   ├── change-notifier.ts    ← Pub/sub for mutations
│   │   │   ├── errors.ts             ← Typed error classes
│   │   │   └── types.ts              ← Shared type definitions
│   │   ├── svelte/
│   │   │   ├── index.ts              ← Svelte-specific exports
│   │   │   ├── live-query.svelte.ts  ← LiveQuery with $state
│   │   │   ├── live-get.svelte.ts    ← LiveGet with $state
│   │   │   └── live-count.svelte.ts  ← LiveCount with $state
│   │   └── utils/
│   │       ├── ssr.ts                ← SSR detection helpers
│   │       └── prepare-value.ts      ← AutoIncrement key handling
│   ├── routes/                       ← Demo / docs site
│   │   ├── +page.svelte              ← Landing page
│   │   └── demo/
│   │       └── +page.svelte          ← Interactive demo
│   └── app.html
├── package.json
├── svelte.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## `package.json` Configuration

This is the most critical file for a published library. Here's the annotated version:

```json
{
	"name": "svelte-idb",
	"version": "0.1.0",
	"description": "Zero-dependency, SSR-safe, Svelte 5 runes-native IndexedDB wrapper",
	"license": "MIT",
	"type": "module",

	"svelte": "./dist/index.js",

	"exports": {
		".": {
			"types": "./dist/index.d.ts",
			"svelte": "./dist/index.js",
			"default": "./dist/index.js"
		},
		"./svelte": {
			"types": "./dist/svelte/index.d.ts",
			"svelte": "./dist/svelte/index.js",
			"default": "./dist/svelte/index.js"
		}
	},

	"files": ["dist", "!dist/**/*.test.*", "!dist/**/*.spec.*"],

	"scripts": {
		"dev": "vite dev",
		"build": "vite build && bun run package",
		"package": "svelte-kit sync && svelte-package --input src/lib",
		"prepublishOnly": "bun run package",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"test": "vitest",
		"test:unit": "vitest run"
	},

	"peerDependencies": {
		"svelte": "^5.0.0"
	},

	"devDependencies": {
		"@sveltejs/adapter-auto": "^3.0.0",
		"@sveltejs/kit": "^2.0.0",
		"@sveltejs/package": "^2.3.0",
		"@sveltejs/vite-plugin-svelte": "^4.0.0",
		"svelte": "^5.0.0",
		"svelte-check": "^4.0.0",
		"typescript": "^5.0.0",
		"vite": "^6.0.0",
		"vitest": "^2.0.0"
	},

	"keywords": [
		"svelte",
		"sveltekit",
		"indexeddb",
		"reactive",
		"database",
		"offline-first",
		"svelte-5",
		"runes",
		"ssr-safe",
		"zero-dependency"
	]
}
```

### Key Points

| Field                | Purpose                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| `"type": "module"`   | ESM-only; no CommonJS                                                    |
| `"svelte"`           | Top-level hint for Svelte-aware bundlers                                 |
| `"exports"`          | Defines two entry points: core (`.`) and svelte integration (`./svelte`) |
| `"files"`            | Only ship `dist/` to npm — exclude tests                                 |
| `"peerDependencies"` | Svelte 5+ is required but not bundled                                    |
| `"prepublishOnly"`   | Automatically runs `svelte-package` before `npm publish`                 |

### The `exports` Map Explained

```
import { createDB } from 'svelte-idb';           → dist/index.js
import { liveQuery } from 'svelte-idb/svelte';   → dist/svelte/index.js
```

This separation allows:

- **Core usage** without Svelte (vanilla JS/TS projects)
- **Full Svelte integration** with runes-based reactivity
- **Tree-shaking** — unused exports are eliminated

---

## The Build Pipeline

```
src/lib/  ──→  svelte-package  ──→  dist/
                    │
                    ├── Transpiles .ts → .js
                    ├── Preprocesses .svelte files
                    ├── Generates .d.ts type definitions
                    └── Copies static assets
```

### What `svelte-package` Does

1. **TypeScript → JavaScript**: All `.ts` files are transpiled
2. **Type Definitions**: `.d.ts` files are generated automatically
3. **Svelte Preprocessing**: `.svelte` files are preprocessed (but not compiled — consumers compile them)
4. **`.svelte.ts` Support**: Runes-compiled files (`.svelte.ts`) are handled correctly

### Running the Build

```bash
# Build the library for distribution
bun run package

# Output:
# dist/
# ├── index.js          ← Main entry
# ├── index.d.ts        ← Type definitions
# ├── core/
# │   ├── database.js
# │   ├── database.d.ts
# │   ├── store.js
# │   ├── store.d.ts
# │   └── ...
# └── svelte/
#     ├── index.js
#     ├── index.d.ts
#     ├── live-query.svelte.js
#     └── ...
```

---

## Publishing to npm

### First-Time Setup

```bash
# Login to npm
npm login

# Verify package name is available
npm view svelte-idb
```

### Publishing

```bash
# Dry run — see what would be published
npm publish --dry-run

# Publish for real
npm publish --access public
```

### Version Bumping

```bash
# Patch: 0.1.0 → 0.1.1 (bug fixes)
npm version patch

# Minor: 0.1.0 → 0.2.0 (new features)
npm version minor

# Major: 0.1.0 → 1.0.0 (breaking changes)
npm version major
```

---

## Testing Strategy

### Testing Strategy: "Testing it Actually Works" (Vitest Browser Mode)

Since this library revolves entirely around IndexedDB—a native browser API—testing it in a simulated environment like Node.js + `jsdom` + `fake-indexeddb` is inherently flawed if your philosophy is "test that it actually works."

Instead, we use **Vitest Browser Mode** powered by **Playwright**. This allows us to write fast unit/integration tests using Vitest, but runs them in _actual_ headless browsers (Chromium, WebKit, Firefox) using real native IndexedDB APIs.

#### Setup

```bash
# Initialize Vitest browser mode
bunx vitest init browser
# Select playwright when prompted to install the provider
```

#### Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		browser: {
			enabled: true,
			provider: 'playwright',
			instances: [{ browser: 'chromium' }]
		}
	}
});
```

### Example Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createDB } from '$lib/index.js';

describe('createDB', () => {
	let db: ReturnType<typeof createDB>;

	beforeEach(async () => {
		db = createDB({
			name: 'test-db',
			version: 1,
			stores: {
				users: { keyPath: 'id', autoIncrement: true }
			}
		});
	});

	it('should add and retrieve a record', async () => {
		const id = await db.users.add({ name: 'Alice', age: 30 });
		const user = await db.users.get(id);
		expect(user).toEqual({ id, name: 'Alice', age: 30 });
	});

	it('should return all records', async () => {
		await db.users.add({ name: 'Alice' });
		await db.users.add({ name: 'Bob' });
		const all = await db.users.getAll();
		expect(all).toHaveLength(2);
	});
});
```

---

## Documentation Site

The `src/routes/` directory serves as both documentation and a live demo. When published, it can be deployed to Vercel/Netlify as the library's homepage.

```
src/routes/
├── +page.svelte           ← Landing: quick start, install, features
├── +layout.svelte         ← Navigation wrapper
├── docs/
│   ├── +page.svelte       ← API documentation
│   ├── getting-started/
│   │   └── +page.svelte
│   └── examples/
│       └── +page.svelte   ← Interactive examples
└── demo/
    └── +page.svelte       ← Live CRUD demo using the library
```

---

## Checklist Before Publishing

- [ ] `bun run check` passes with zero errors
- [ ] `bun run test` passes with full coverage on core CRUD
- [ ] `bun run package` builds cleanly to `dist/`
- [ ] `npm publish --dry-run` shows only intended files
- [ ] `README.md` has install instructions, quick start, and API overview
- [ ] `LICENSE` file exists (MIT)
- [ ] `CHANGELOG.md` documents changes
- [ ] `package.json` has correct `exports`, `peerDependencies`, `keywords`
- [ ] Types resolve correctly when imported in a consumer project

---

**← [04 Svelte 5 Reactivity](./04-svelte5-reactivity.md)** | **[Next → 06 API Design](./06-api-design.md)**
