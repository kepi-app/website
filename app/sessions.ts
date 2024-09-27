import {
	createCookieSessionStorage,
	createMemorySessionStorage,
} from "@remix-run/node"

interface SessionData {
	refreshToken: string
	accessToken: string
	expiresAtUnixMs: number
}

console.log(process.env.NODE_ENV)

const { getSession, commitSession, destroySession } =
	process.env.NODE_ENV === "development"
		? createMemorySessionStorage({
				cookie: {
					name: "__session",
					httpOnly: true,
					path: "/",
					maxAge: 604_800,
					secrets: [process.env.COOKIE_SECRET ?? ""],
				},
			})
		: createCookieSessionStorage<SessionData>({
				cookie: {
					name: "__session",
					domain: "kepi.blog",
					httpOnly: true,
					secure: true,
					path: "/",
					maxAge: 604_800,
					secrets: [process.env.COOKIE_SECRET ?? ""],
				},
			})

export { getSession, commitSession, destroySession }
export type { SessionData }
