import {
	type ApplicationError,
	type CheckedPromise,
	ERROR_TYPE,
	applicationError,
	asInternalError,
	promiseOrThrow,
} from "~/errors"

type Endpoint =
	| "/blogs"
	| `/blogs/${string}`
	| `/blogs/${string}/posts`
	| `/blogs/${string}/posts/${string}/files/${string}`
	| `/blogs/${string}/publish`
	| "/sign-up"
	| "/auth/token"
	| "/auth/login"

async function fetchApi<T = undefined>(
	endpoint: Endpoint,
	init?: RequestInit,
): CheckedPromise<T, ApplicationError> {
	const res = await promiseOrThrow(
		fetch(`${process.env.API_URL}${endpoint}`, init),
		(error) => {
			console.error("fetchApi -> fetch error", error)
			return applicationError({ error: ERROR_TYPE.network })
		},
	)

	if (res.status === 204) {
		return undefined as T
	}

	const json = await promiseOrThrow(res.json(), asInternalError)

	switch (res.status) {
		case 200:
			return json
		case 401:
			throw applicationError({ error: ERROR_TYPE.unauthorized })
		case 409:
			throw applicationError({
				error: ERROR_TYPE.conflict,
				conflictingField: json.conflictingField,
				conflictingValue: json.conflictingValue,
			})
		default:
			throw applicationError({ error: ERROR_TYPE.internal })
	}
}

async function fetchApiRaw(
	endpoint: Endpoint,
	init?: RequestInit,
): CheckedPromise<Response, ApplicationError> {
	const res = await fetch(`${process.env.API_URL}${endpoint}`, init)
	if (res.status === 204) {
		return res
	}
	switch (res.status) {
		case 200:
			return res
		case 401:
			throw applicationError({ error: ERROR_TYPE.unauthorized })
		case 409: {
			const json = await promiseOrThrow(res.json(), asInternalError)
			throw applicationError({
				error: ERROR_TYPE.conflict,
				conflictingField: json.conflictingField,
				conflictingValue: json.conflictingValue,
			})
		}
		default:
			throw applicationError({ error: ERROR_TYPE.internal })
	}
}

async function clientFetchRaw(
	endpoint: Endpoint,
	init?: RequestInit,
): CheckedPromise<Response, ApplicationError> {
	const res = await fetch(endpoint, init)
	if (res.status === 204) {
		return res
	}
	switch (res.status) {
		case 200:
			return res
		case 401:
			throw applicationError({ error: ERROR_TYPE.unauthorized })
		case 409: {
			const json = await promiseOrThrow(res.json(), asInternalError)
			throw applicationError({
				error: ERROR_TYPE.conflict,
				conflictingField: json.conflictingField,
				conflictingValue: json.conflictingValue,
			})
		}
		default:
			throw applicationError({ error: ERROR_TYPE.internal })
	}
}

export { fetchApi, fetchApiRaw, clientFetchRaw }
