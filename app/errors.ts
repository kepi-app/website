import toast from "react-hot-toast"

type CheckedPromise<T, _TErr> = Promise<T>

class InternalError extends Error {
	constructor(public readonly cause?: unknown) {
		super(`Internal error: ${cause ?? "unknown"}`)
	}
}

class NotLoggedInError extends Error {
	constructor() {
		super("user is not logged in")
	}
}

function promiseOrThrow<T, TErr>(
	promise: T | Promise<T>,
	mapException?: (error: unknown) => TErr,
): T | CheckedPromise<T, TErr> {
	try {
		return promise
	} catch (e) {
		if (mapException) {
			throw mapException(e)
		}
		throw e
	}
}

function tryOrThrow<T, TErr>(
	cb: () => T,
	mapException?: (error: unknown) => TErr,
): T {
	try {
		return cb()
	} catch (e) {
		if (mapException) {
			throw mapException(e)
		}
		throw e
	}
}

function tryOr<T, TFallback>(
	cb: () => T,
	orElse: () => TFallback,
): T | TFallback {
	try {
		return cb()
	} catch {
		return orElse()
	}
}

function throws(ex: unknown): never {
	throw ex
}

function internalError(error: unknown, source?: string) {
	// TODO: better handle internal error
	console.error(source ?? "internal error", error)
	toast.error("An internal application error has occurred.")
}

export {
	InternalError,
	NotLoggedInError,
	promiseOrThrow,
	tryOr,
	tryOrThrow,
	throws,
	internalError,
}
export type { CheckedPromise }
