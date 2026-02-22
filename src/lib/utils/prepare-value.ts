/**
 * svelte-idb — Value Preparation Utility
 *
 * IndexedDB's autoIncrement requires the key field to be ABSENT,
 * not `undefined`. This utility strips undefined key properties
 * before insert so autoIncrement works correctly.
 */

/**
 * Prepares a value for insertion into an autoIncrement store.
 * Clones the value and removes the key field if it's `undefined`.
 *
 * @param value  The record to prepare.
 * @param keyPath  The key property name.
 * @param autoIncrement  Whether the store uses autoIncrement.
 * @returns A shallow clone safe for IndexedDB insertion.
 */
export function prepareForInsert<T>(value: T, keyPath: string, autoIncrement: boolean): T {
	if (!autoIncrement) return value;

	const clone = { ...value } as Record<string, unknown>;

	if (clone[keyPath] === undefined) {
		delete clone[keyPath];
	}

	return clone as T;
}
