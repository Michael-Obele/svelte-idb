/**
 * svelte-idb — LiveQuery<T>
 *
 * The core reactive primitive. Wraps an async query function
 * and keeps its result up to date via Svelte 5 $state runes.
 *
 * Must live in a .svelte.ts file to get runes compilation.
 */

import type { ChangeNotifier } from '../core/change-notifier.js';
import type { ILiveQuery } from '../core/types.js';
import { isBrowser } from '../utils/ssr.js';

export class LiveQuery<T> implements ILiveQuery<T> {
	current = $state<T>() as T;
	loading = $state(true);
	error = $state<Error | null>(null);

	private queryFn: () => Promise<T>;
	private unsubscribers: (() => void)[] = [];
	private destroyed = false;

	constructor(
		queryFn: () => Promise<T>,
		storeNames: string[],
		notifier: ChangeNotifier,
		initialValue: T
	) {
		this.queryFn = queryFn;
		this.current = initialValue;

		// SSR: return initial value, no subscription
		if (!isBrowser()) {
			this.loading = false;
			return;
		}

		// Subscribe to change notifications for each store
		for (const storeName of storeNames) {
			const unsub = notifier.subscribe(storeName, () => {
				this.requery();
			});
			this.unsubscribers.push(unsub);
		}

		// Initial query
		this.requery();
	}

	private async requery(): Promise<void> {
		if (this.destroyed) return;

		try {
			this.loading = true;
			const result = await this.queryFn();
			if (!this.destroyed) {
				this.current = result;
				this.error = null;
			}
		} catch (e) {
			if (!this.destroyed) {
				this.error = e instanceof Error ? e : new Error(String(e));
			}
		} finally {
			if (!this.destroyed) {
				this.loading = false;
			}
		}
	}

	async refresh(): Promise<void> {
		await this.requery();
	}

	destroy(): void {
		this.destroyed = true;
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}
}
