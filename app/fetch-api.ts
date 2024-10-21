import { err, ok, type Result } from "trycat"
import { ApiError } from "./error"
import { redirect } from "@remix-run/node"

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
	init?: RequestInit & { redirectToLogin?: boolean },
): Promise<Result<T, ApiError>> {
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
			const json: T = await res.json()
			return ok(json)
		}

		default:
			return err(ApiError.Internal)
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
