import { afterEach, describe, expect, test } from 'vitest';

import { createDB } from '../../src/lib/index.ts';

function createSmokeDB(name: string) {
	return createDB({
		name,
		version: 1,
		stores: {
			todos: {
				keyPath: 'id',
				autoIncrement: true
			}
		}
	});
}

function deleteDatabase(name: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => resolve();
	});
}

describe('createDB browser smoke test', () => {
	let dbName = '';
	let db: ReturnType<typeof createSmokeDB> | undefined;

	afterEach(async () => {
		if (db) {
			await db.close();
			db = undefined;
		}

		if (dbName) {
			await deleteDatabase(dbName);
			dbName = '';
		}
	});

	test('opens IndexedDB and performs a basic read/write cycle', async () => {
		dbName = `svelte-idb-browser-smoke-${crypto.randomUUID()}`;
		db = createSmokeDB(dbName);

		expect(indexedDB).toBeDefined();

		const key = await db.todos.add({ text: 'Ship tests', done: false });
		expect(key).toBe(1);

		const record = await db.todos.get(key);
		expect(record).toEqual({ id: 1, text: 'Ship tests', done: false });

		const count = await db.todos.count();
		expect(count).toBe(1);
	});
});