import { redirect } from "@remix-run/node"
import { type Result, err, ok } from "trycat"
import { type CheckedPromise, promiseOrThrow } from "~/errors"
import { ApiError } from "./error"

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
): CheckedPromise<T, ApiError> {
	const res = await promiseOrThrow(
		fetch(`${process.env.API_URL}${endpoint}`, init),
		(error) => {
			console.error(error)
			return ApiError.Network
		},
	)
	switch (res.status) {
		case 401:
			throw ApiError.Unauthorized
		case 409:
			throw ApiError.Conflict
		case 200: {
			return promiseOrThrow(res.json(), (error) => {
				console.error(error)
				return ApiError.Internal
			})
		}
		default:
			throw ApiError.Internal
	}
}

async function fetchApiRaw(
	endpoint: Endpoint,
	init?: RequestInit & { redirectToLogin?: boolean },
): Promise<Result<Response, ApiError>> {
	const res = await fetch(`${process.env.API_URL}${endpoint}`, init)
	console.log(res.status)
	switch (res.status) {
		case 401:
			if (init?.redirectToLogin ?? true) {
				throw redirect("/login")
			}
			return err(ApiError.Unauthorized)
		case 409:
			return err(ApiError.Conflict)
		case 200: {
			return ok(res)
		}
		default:
			return err(ApiError.Internal)
	}
}

export { fetchApi, fetchApiRaw }
