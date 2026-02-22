/**
 * svelte-idb — Typed Error Classes
 *
 * Wraps raw DOMException errors from IndexedDB into
 * semantically meaningful, catchable error types.
 */

/** Base error class for all svelte-idb errors. */
export class IDBError extends Error {
	readonly cause?: DOMException;

	constructor(message: string, cause?: DOMException) {
		super(message);
		this.name = 'IDBError';
		this.cause = cause;
	}
}

/** Thrown when a store or index doesn't exist. */
export class IDBNotFoundError extends IDBError {
	readonly storeName: string;

	constructor(storeName: string, cause?: DOMException) {
		super(`Store or index "${storeName}" not found.`, cause);
		this.name = 'IDBNotFoundError';
		this.storeName = storeName;
	}
}

/** Thrown on unique constraint violation (duplicate key). */
export class IDBConstraintError extends IDBError {
	readonly key?: IDBValidKey;

	constructor(key?: IDBValidKey, cause?: DOMException) {
		super(
			`Unique constraint violated${key !== undefined ? ` for key: ${String(key)}` : ''}.`,
			cause
		);
		this.name = 'IDBConstraintError';
		this.key = key;
	}
}

/** Thrown on version mismatch during upgrade. */
export class IDBVersionError extends IDBError {
	constructor(message: string, cause?: DOMException) {
		super(message, cause);
		this.name = 'IDBVersionError';
	}
}

/** Thrown when a transaction is aborted. */
export class IDBAbortError extends IDBError {
	constructor(message: string, cause?: DOMException) {
		super(message, cause);
		this.name = 'IDBAbortError';
	}
}

/** Thrown when an operation times out. */
export class IDBTimeoutError extends IDBError {
	constructor(message: string, cause?: DOMException) {
		super(message, cause);
		this.name = 'IDBTimeoutError';
	}
}

/**
 * Wraps a DOMException from IndexedDB into the appropriate typed error.
 */
export function wrapIDBError(error: unknown, context?: string): IDBError {
	if (error instanceof IDBError) return error;

	const domEx = error instanceof DOMException ? error : undefined;
	const message = domEx?.message ?? String(error);
	const prefix = context ? `[${context}] ` : '';

	if (domEx) {
		switch (domEx.name) {
			case 'NotFoundError':
				return new IDBNotFoundError(prefix + message, domEx);
			case 'ConstraintError':
				return new IDBConstraintError(undefined, domEx);
			case 'VersionError':
				return new IDBVersionError(prefix + message, domEx);
			case 'AbortError':
				return new IDBAbortError(prefix + message, domEx);
			case 'TimeoutError':
				return new IDBTimeoutError(prefix + message, domEx);
		}
	}

	return new IDBError(prefix + message, domEx);
}
