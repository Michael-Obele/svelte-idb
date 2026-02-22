/**
 * svelte-idb — Change Notifier
 *
 * Pub/sub system for mutation events with microtask batching.
 * When a store is mutated, subscribers are notified on the next microtask,
 * preventing excessive re-queries during batch operations.
 */

import type { ChangeEvent, ChangeSubscriber } from './types.js';

export class ChangeNotifier {
	private subscribers = new Map<string, Set<ChangeSubscriber>>();
	private pendingStores = new Set<string>();
	private scheduled = false;

	/**
	 * Subscribe to change events for a specific store.
	 * @returns An unsubscribe function.
	 */
	subscribe(storeName: string, callback: ChangeSubscriber): () => void {
		if (!this.subscribers.has(storeName)) {
			this.subscribers.set(storeName, new Set());
		}

		const subs = this.subscribers.get(storeName)!;
		subs.add(callback);

		return () => {
			subs.delete(callback);
			if (subs.size === 0) {
				this.subscribers.delete(storeName);
			}
		};
	}

	/**
	 * Notify that a store was mutated.
	 * Notifications are batched via microtask to coalesce rapid mutations.
	 */
	notify(storeName: string, _event: ChangeEvent): void {
		this.pendingStores.add(storeName);

		if (!this.scheduled) {
			this.scheduled = true;
			queueMicrotask(() => this.flush());
		}
	}

	/**
	 * Flush pending notifications — fires all subscribers once per affected store.
	 */
	private flush(): void {
		const stores = new Set(this.pendingStores);
		this.pendingStores.clear();
		this.scheduled = false;

		for (const storeName of stores) {
			const subs = this.subscribers.get(storeName);
			if (subs) {
				const batchEvent: ChangeEvent = { type: 'batch' };
				for (const callback of subs) {
					try {
						callback(batchEvent);
					} catch {
						// Subscriber errors should never break the notification loop
					}
				}
			}
		}
	}

	/** Returns the number of active subscribers for a store (for testing). */
	subscriberCount(storeName: string): number {
		return this.subscribers.get(storeName)?.size ?? 0;
	}
}
