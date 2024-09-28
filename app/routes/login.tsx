import {
	type ActionFunctionArgs,
	json,
	redirect,
	type LoaderFunctionArgs,
} from "@remix-run/node"
import { useFetcher } from "@remix-run/react"
import clsx from "clsx"
import { useEffect, useId, useState } from "react"
import _sodium from "libsodium-wrappers-sumo"
import { Button } from "~/components/button"
import { Logo } from "~/components/logo"
import { hashMasterPassword } from "~/crypt"
import { fetchApi } from "~/fetch-api"
import { ApiError } from "~/error"
import { commitSession, getSession } from "~/sessions"
import toast from "react-hot-toast"
import { authenticate } from "~/auth"

interface LoginResponse {
	accessToken: string
	refreshToken: string
	expiresAtUnixMs: number
}

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const refreshToken = session.get("refreshToken")
	if (refreshToken) {
		return redirect("/blogs")
	}
	return null
}

export default function LoginPage() {
	const emailInputId = useId()
	const passwordInputId = useId()
	const fetcher = useFetcher<typeof action>()
	const [isSubmitting, setIsSubmitting] = useState(false)

	useEffect(() => {
		if (fetcher.data?.error) {
			setIsSubmitting(false)
			switch (fetcher.data.error) {
				case ApiError.Unauthorized:
					toast.error("incorrect email or password")
					break
				default:
					toast.error("an issue happened on our end. please try again later.")
					break
			}
		}
	}, [fetcher.data])

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		setIsSubmitting(true)

		const form = new FormData(event.currentTarget)
		const email = form.get("email")
		const password = form.get("password")
		if (
			!email ||
			!password ||
			typeof email !== "string" ||
			typeof password !== "string"
		) {
			toast("incorrect email or password")
			setIsSubmitting(false)
			return
		}

		await _sodium.ready
		const sodium = _sodium

		const hashResult = await hashMasterPassword(email, password)
		if (hashResult.isErr()) {
			toast("incorrect email or password")
			setIsSubmitting(false)
			return
		}

		form.set(
			"passwordHash",
			sodium.to_base64(hashResult.value.hash, sodium.base64_variants.ORIGINAL),
		)
		form.delete("password")

		fetcher.submit(form, { method: "POST" })
	}

	return (
		<div className="w-full h-screen flex justify-center items-center">
			<main className="w-full lg:max-w-prose flex flex-col justify-center items-center">
				<div
					className={clsx("w-14 h-14 mb-12", {
						"animate-bounce": isSubmitting,
					})}
				>
					<Logo />
				</div>

				<fetcher.Form
					className="flex flex-col items-center"
					onSubmit={onSubmit}
				>
					<div className="grid grid-cols-3 grid-rows-2 gap-4">
						<label htmlFor={emailInputId}>email</label>
						<input
							required
							name="email"
							type="email"
							placeholder="sakurajima@mai.com"
							id={emailInputId}
							className="col-span-2 bg-transparent placeholder:opacity-50 focus:outline-0"
						/>
						<label htmlFor={passwordInputId}>password</label>
						<input
							required
							name="password"
							type="password"
							id={passwordInputId}
							className="col-span-2 bg-transparent placeholder:opacity-50 focus:outline-0"
							placeholder="your password"
						/>
					</div>

					<Button type="submit" containerClassName="mt-12 w-full">
						Login
					</Button>
				</fetcher.Form>
			</main>
		</div>
	)
}

export async function action({ request }: ActionFunctionArgs) {
	const form = await request.formData()

	const result = await fetchApi<LoginResponse>("/auth/login", {
		method: "POST",
		body: form,
	})
	if (result.isErr()) {
		switch (result.error) {
			case ApiError.Unauthorized:
				return json({ error: ApiError.Unauthorized }, { status: 401 })
			default:
				return json({ error: ApiError.Internal }, { status: 500 })
		}
	}

	const tokens = result.value
	const session = await getSession(request.headers.get("Cookie"))
	session.set("accessToken", tokens.accessToken)
	session.set("refreshToken", tokens.refreshToken)
	session.set("expiresAtUnixMs", tokens.expiresAtUnixMs)

	return redirect("/blogs", {
		headers: {
			"Set-Cookie": await commitSession(session),
		},
	})
}
