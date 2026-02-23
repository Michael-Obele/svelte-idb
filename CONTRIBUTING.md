# Contributing to svelte-idb

First off, thank you for considering contributing to `svelte-idb`! It's people like you that make the open source community such an amazing and thriving place.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/Michael-Obele/svelte-idb/issues) first to see if someone else has already created it. 
If not, feel free to open a new issue!

## Development Setup

`svelte-idb` uses `bun` as its package manager, and it's built using SvelteKit's library packager (`@sveltejs/package`).

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Michael-Obele/svelte-idb.git
   cd svelte-idb
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Start the development server:**
   ```bash
   bun dev
   ```
   This will start a local server at `http://localhost:5173` running the demo playground. 

## Project Architecture

- `src/lib/` - The source code for the package itself
  - `core/` - The core engine that runs everywhere (browser/SSR). Contains zero Svelte-specific code.
  - `svelte/` - The Svelte reactive layer. Uses Svelte 5 `$state` runes.
  - `utils/` - Utility functions like SSR detection.
- `src/routes/` - The demo playground application that consumes `src/lib`. Any changes made in the library can be tested here live.

## Pull Request Guidelines

When submitting a pull request, please make sure your changes align with the following guidelines:

1. **Run the Checks**: Before submitting, ensure that formatting and type-checking pass:
   ```bash
   bun run check
   bun run lint
   ```
   If needed, fix formatting with `bun run format`.

2. **Commit Messages**: We recommend using the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard. Examples:
   - `feat: add where clause querying`
   - `fix: resolve SSR throw error`
   - `docs: update API examples`

3. **Test Your Changes**: Use `src/routes/` to verify that your changes work. Make sure both read and write queries behave as expected.

4. **Zero Dependencies**: `svelte-idb`'s main philosophy is to remain lightweight with *zero* external runtime dependencies (except Svelte itself).

## Releasing (For Maintainers)

The project uses SvelteKit's package tool to prep publishable code to the `dist` directory:
```bash
bun run build
cd dist
npm publish
```

Thank you!
