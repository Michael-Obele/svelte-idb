# svelte-idb Metadata

- **Author**: Michael Obele
- **Package name**: svelte-idb
- **npm url**: https://www.npmjs.com/package/svelte-idb
- **GitHub url**: https://github.com/Michael-Obele/svelte-idb
- **Version**: 0.1.2
- **Keywords**: svelte, sveltekit, indexeddb, reactive, database, offline-first, svelte-5, runes, ssr-safe, zero-dependency.
- **License**: MIT
- **Size**: ~2KB minzipped (47kB unpacked)

## npm Registry Details
- **Latest Version**: 0.1.2
- **Unpacked Size**: 47.7kB
- **File Count**: 29
- **Maintainers**: admin@svelte-apps.me
- **Published**: Feb 2026

## Badge Configuration

- npm version: `https://img.shields.io/npm/v/svelte-idb?style=flat-square&color=ff3e00&label=npm`
- bundle size: `https://img.shields.io/bundlephobia/minzip/svelte-idb?style=flat-square&color=33b5e5&label=minzipped`
- downloads: `https://img.shields.io/npm/dm/svelte-idb?style=flat-square&color=cb3837&label=downloads`
- github stars: `https://img.shields.io/github/stars/Michael-Obele/svelte-idb?style=flat-square&color=ffd700`
- svelte compatibility: `https://img.shields.io/badge/svelte-%5E5.0.0-ff3e00?style=flat-square&logo=svelte`
- license: `https://img.shields.io/github/license/Michael-Obele/svelte-idb?style=flat-square&color=purple`

## Versioning Strategy

**Dynamic Version Resolution:**
- Version is read from `package.json` at build time
- Stored in `src/lib/version.ts`
- Exported from `src/lib/index.ts` as `APP_VERSION`
- Exported from `src/lib/svelte/index.ts` for Svelte components
- Used in `src/routes/+page.svelte` for the landing page version badge

**Usage in Components:**
```typescript
import { APP_VERSION } from 'svelte-idb';

// In Svelte 5 component:
<div>v{APP_VERSION}</div>
```

**Build Process:**
1. Update `package.json` with new version
2. Run `npm run build` to rebuild the app
3. Version is automatically synced across all UI components and exports
4. Publish with `npm publish`

**Advantages:**
- Single source of truth (package.json)
- No manual version updates needed in code
- Type-safe version constants
- Consistent versioning across app and npm registry
