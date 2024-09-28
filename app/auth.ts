import { redirect, type Session } from "@remix-run/node"
import { commitSession, type SessionData } from "./sessions"
import dayjs from "dayjs"
import { err, ok, tryp, type Result } from "trycat"
import { ApiError } from "./error"

interface TokenResponse {
	accessToken: string
	refreshToken: string
	expiresAtUnixMs: number
}

async function authenticate(
	request: Request,
	session: Session<SessionData>,
	headers = new Headers(),
) {
	let accessToken = session.get("accessToken")
	if (!accessToken) {
		throw redirect("/login")
	}

	if (
		dayjs().isAfter(
			dayjs(session.get("expiresAtUnixMs")).subtract(5, "minutes"),
		)
	) {
		const refreshToken = session.get("refreshToken")
		if (!refreshToken) {
			throw redirect("/login")
		}

		const result = await fetchNewTokens(refreshToken)
		if (result.isErr()) {
			switch (result.error) {
				case ApiError.Unauthorized:
					throw redirect("/login")
				default:
					throw redirect("/internal-error")
			}
		}

		const tokens = result.value
		session.set("accessToken", tokens.accessToken)
		session.set("refreshToken", tokens.refreshToken)
		session.set("expiresAtUnixMs", tokens.expiresAtUnixMs)

		headers.append("Set-Cookie", await commitSession(session))

		if (request.method === "GET") {
			throw redirect(request.url, { headers })
		}

		accessToken = tokens.accessToken
	}

	return accessToken
}

async function fetchNewTokens(
	refreshToken: string,
): Promise<Result<TokenResponse, ApiError>> {
	const form = new FormData()
	form.set("refreshToken", refreshToken)

	const result = (
		await tryp(
			fetch(`${process.env.API_URL}/auth/token`, {
				method: "POST",
				body: form,
			}),
		)
	).mapErr(() => ApiError.Internal)
	if (result.isErr()) {
		return result
	}

	const res = result.value
	switch (res.status) {
		case 401:
			return err(ApiError.Unauthorized)
		case 500:
			return err(ApiError.Internal)
	}

	const json = (await tryp(result.value.json())).mapErr(() => ApiError.Internal)
	if (json.isErr()) {
		return json
	}

	const tokenResponse: TokenResponse = json.value

	return ok(tokenResponse)
}

export { authenticate }
