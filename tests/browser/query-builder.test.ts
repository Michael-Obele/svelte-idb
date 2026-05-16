import { afterEach, describe, expect, test } from 'vitest';

import { createDB } from '../../src/lib/index.ts';

function createQueryDB(name: string) {
	return createDB({
		name,
		version: 1,
		stores: {
			users: {
				keyPath: 'id',
				autoIncrement: true,
				indexes: {
					byAge: { keyPath: 'age' }
				}
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

describe('query builder', () => {
	let dbName = '';
	let db: ReturnType<typeof createQueryDB> | undefined;

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

	test('filters index values with equals and returns ordered results', async () => {
		dbName = `svelte-idb-query-builder-${crypto.randomUUID()}`;
		db = createQueryDB(dbName);

		await db.users.add({ name: 'Ada', age: 30 });
		await db.users.add({ name: 'Grace', age: 40 });
		await db.users.add({ name: 'Linus', age: 30 });

		const matches = await db.users.where('byAge').equals(30).toArray();

		expect(matches).toHaveLength(2);
		expect(matches.map((user) => user.name)).toEqual(['Ada', 'Linus']);
	});

	test('supports range operators and count', async () => {
		dbName = `svelte-idb-query-builder-${crypto.randomUUID()}`;
		db = createQueryDB(dbName);

		await db.users.add({ name: 'Ada', age: 30 });
		await db.users.add({ name: 'Grace', age: 40 });
		await db.users.add({ name: 'Linus', age: 50 });
		await db.users.add({ name: 'Margaret', age: 60 });

		await expect(db.users.where('byAge').above(40).count()).resolves.toBe(2);
		await expect(db.users.where('byAge').aboveOrEqual(40).count()).resolves.toBe(3);
		await expect(db.users.where('byAge').below(50).count()).resolves.toBe(2);
		await expect(db.users.where('byAge').belowOrEqual(50).count()).resolves.toBe(3);
		await expect(db.users.where('byAge').between(40, 60, false, true).count()).resolves.toBe(2);
	});

	test('returns the first record in index order', async () => {
		dbName = `svelte-idb-query-builder-${crypto.randomUUID()}`;
		db = createQueryDB(dbName);

		await db.users.add({ name: 'Ada', age: 30 });
		await db.users.add({ name: 'Grace', age: 40 });
		await db.users.add({ name: 'Linus', age: 50 });

		await expect(db.users.where('byAge').first()).resolves.toMatchObject({ name: 'Ada', age: 30 });
		await expect(db.users.where('byAge').aboveOrEqual(40).first()).resolves.toMatchObject({
			name: 'Grace',
			age: 40
		});
	});
});