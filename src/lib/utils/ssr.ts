/**
 * svelte-idb — SSR Utilities
 *
 * Framework-agnostic browser detection.
 * Does NOT depend on $app/environment.
 */

import type { SSRStrategy } from '../core/types.js';

/** Returns true if running in a browser environment. */
export function isBrowser(): boolean {
	return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined';
}

/**
 * Handles an SSR operation based on the configured strategy.
 * - 'noop': returns the provided default value silently.
 * - 'throw': throws an error.
 * - function: calls the custom handler, then returns the default.
 */
export function handleSSR<T>(
	strategy: SSRStrategy | undefined,
	operation: string,
	defaultValue: T
): T {
	const strat = strategy ?? 'noop';

	if (strat === 'throw') {
		throw new Error(`[svelte-idb] SSR: attempted "${operation}" on the server.`);
	}

	if (typeof strat === 'function') {
		strat(operation);
	}

	return defaultValue;
}
