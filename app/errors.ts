import toast from "react-hot-toast"
import { data, isRouteErrorResponse, useRouteError } from "react-router"

type CheckedPromise<T, _TErr> = Promise<T>

const ERROR_TYPE = {
	internal: "INTERNAL",
	unauthorized: "UNAUTHORIZED",
	badRequest: "BAD_REQUEST",
	conflict: "CONFLICT",
	network: "NETWORK",
	decryptionFailed: "DECRYPTION_FAILED",
} as const
type ErrorType = (typeof ERROR_TYPE)[keyof typeof ERROR_TYPE]

interface InternalError {
	error: typeof ERROR_TYPE.internal
	cause?: unknown
}

interface UnauthorizedError {
	error: typeof ERROR_TYPE.unauthorized
}

interface BadRequestError {
	error: typeof ERROR_TYPE.badRequest
}

interface ConflictError {
	error: typeof ERROR_TYPE.conflict
	conflictingField: string
	conflictingValue: unknown
}

interface NetworkError {
	error: typeof ERROR_TYPE.network
}

interface DecryptionFailedError {
	error: typeof ERROR_TYPE.decryptionFailed
	cause: unknown
}

type ApplicationError =
	| InternalError
	| UnauthorizedError
	| BadRequestError
	| ConflictError
	| NetworkError
	| DecryptionFailedError
type ApplicationHttpError = Exclude<ApplicationError, DecryptionFailedError>

interface ErrorTypeMap {
	[ERROR_TYPE.internal]: InternalError
	[ERROR_TYPE.unauthorized]: UnauthorizedError
	[ERROR_TYPE.badRequest]: BadRequestError
	[ERROR_TYPE.conflict]: ConflictError
	[ERROR_TYPE.network]: NetworkError
	[ERROR_TYPE.decryptionFailed]: DecryptionFailedError
}

const HTTP_ERROR_CODE = {
	[ERROR_TYPE.internal]: 500,
	[ERROR_TYPE.unauthorized]: 401,
	[ERROR_TYPE.badRequest]: 400,
	[ERROR_TYPE.conflict]: 409,
	[ERROR_TYPE.network]: 500,
} as const

const APPLICATION_ERROR_TAG = "ApplicationError"

function isApplicationError(error: unknown): error is ApplicationError
function isApplicationError<T extends ErrorType>(
	error: unknown,
	type: T,
): error is ErrorTypeMap[T]
function isApplicationError<T extends ErrorType>(
	error: unknown,
	type?: T,
): error is ApplicationError {
	return (
		typeof error === "object" &&
		error !== null &&
		"_tag" in error &&
		"error" in error &&
		(type ? error._tag === "ApplicationError" && error.error === type : true)
	)
}

function promiseOrThrow<T, TErr extends ApplicationError>(
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

function promiseOr<T, TFallback>(
	promise: T | Promise<T>,
	orElse: () => TFallback | Promise<TFallback>,
) {
	try {
		return promise
	} catch {
		return orElse()
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

function asInternalError(error: unknown): InternalError {
	return { error: ERROR_TYPE.internal, cause: error }
}

function displayInternalErrorToast(error: unknown, source?: string) {
	// TODO: better handle internal error
	console.error(source ?? "internal error", error)
	return toast.error("An internal application error has occurred.", {
		id: "internal-error",
	})
}

function applicationHttpError(error: ApplicationHttpError) {
	return data(
		{ _tag: APPLICATION_ERROR_TAG, ...error },
		{ status: HTTP_ERROR_CODE[error.error] },
	)
}

function applicationError(error: ApplicationError): ApplicationError {
	return {
		_tag: APPLICATION_ERROR_TAG,
		...error,
	} as unknown as ApplicationError
}

/**
 * Maps the returned error {@link useRouteError} to {@link ApplicationError}.
 * If the returned error is not recognized, it is mapped to {@link InternalError}.
 */
function useRouteApplicationError() {
	const error = useRouteError()
	if (isRouteErrorResponse(error) && isApplicationError(error.data)) {
		return error.data
	}
	return asInternalError(error)
}

export {
	ERROR_TYPE,
	promiseOrThrow,
	promiseOr,
	tryOr,
	tryOrThrow,
	throws,
	displayInternalErrorToast,
	applicationError,
	applicationHttpError,
	asInternalError,
	isApplicationError,
	useRouteApplicationError,
}
export type {
	ApplicationError,
	InternalError,
	UnauthorizedError,
	ConflictError,
	NetworkError,
	BadRequestError,
	CheckedPromise,
}
