import { err, ok, type Result } from "trycat"
import { ApiError } from "./error"
import { redirect } from "@remix-run/node"

type Endpoint =
	| "/blogs"
	| `/blogs/${string}`
	| `/blogs/${string}/posts`
	| `/blogs/${string}`
	| "/sign-up"
	| "/auth/token"
	| "/auth/login"

async function fetchApi<T = undefined>(
	endpoint: Endpoint,
	init?: RequestInit,
): Promise<Result<T, ApiError>> {
	try {
		const res = await fetch(`${process.env.API_URL}${endpoint}`, init)
		switch (res.status) {
			case 401:
				throw redirect("/login")
			case 409:
				return err(ApiError.Conflict)
			case 200: {
				const json: T = await res.json()
				console.log("json", json)
				return ok(json)
			}

			default:
				return err(ApiError.Internal)
		}
	} catch {
		return err(ApiError.Internal)
	}
}

export { fetchApi }
