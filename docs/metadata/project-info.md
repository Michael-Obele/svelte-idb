# svelte-idb Metadata

- **Author**: Michael Obele
- **Package name**: svelte-idb
- **npm url**: https://www.npmjs.com/package/svelte-idb
- **GitHub url**: https://github.com/Michael-Obele/svelte-idb
- **Website**: https://idb.svelte-apps.me/
- **Documentation**: https://idb.svelte-apps.me/docs/installation
- **Keywords**: svelte, sveltekit, indexeddb, reactive, database, offline-first, svelte-5, runes, ssr-safe, zero-dependency.
- **License**: MIT

## npm Registry Details
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
- Version is retrieved dynamically from npm, ensuring the most up-to-date representation on the website.
- The library itself does not bundle or export its own version number (i.e. no `APP_VERSION` from `src/lib/index.ts`).

**Build Process:**
1. Update `package.json` with new version
2. Run `npm run build` to rebuild the library package
3. Publish with `npm publish`

**Advantages:**
- Single source of truth (npm registry and `package.json`).
- Prevents redundant exports within the main library codebase.
- No manual version string updates required in UI components.
