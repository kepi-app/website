import clsx from "clsx"
import _sodium from "libsodium-wrappers-sumo"
import { memo, useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	data,
	redirect,
} from "react-router"
import { useFetcher, useNavigate } from "react-router"
import { Anchor } from "~/components/anchor"
import { Button } from "~/components/button"
import { Logo } from "~/components/logo"
import {
	type Base64EncodedCipher,
	type HashResult,
	SymmetricKey,
	decrypt,
	deriveStretchedMasterKey,
	hashMasterPassword,
	saveSymmetricKeyInSessionStorage,
} from "~/crypt"
import {
	ERROR_TYPE,
	applicationHttpError,
	displayInternalErrorToast,
	isApplicationError,
	useRouteApplicationError,
} from "~/errors"
import { fetchApi } from "~/fetch-api"
import { saveEmail, saveProtectedSymmetricKey } from "~/local-storage"
import { commitSession, getSession } from "~/sessions"

interface LoginResponse {
	email: string
	accessToken: string
	refreshToken: string
	expiresAtUnixMs: number
	protectedSymmetricKey: string
	authTag: string
	iv: string
}

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get("Cookie"))
	const refreshToken = session.get("refreshToken")
	if (refreshToken) {
		return redirect("/blogs")
	}
	return null
}

export function shouldRevalidate() {
	return false
}

const LoginPage = memo(() => {
	const emailInputId = useId()
	const passwordInputId = useId()
	const fetcher = useFetcher<typeof action>()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const stretchedMasterKey = useRef<SymmetricKey | null>(null)
	const navigate = useNavigate()

	useEffect(() => {
		if (fetcher.data && isSubmitting) {
			onLoginSuccessful(fetcher.data)
			setIsSubmitting(false)
		}
	}, [isSubmitting, fetcher.data])

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		setIsSubmitting(true)

		try {
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

			// HACK: wrapping the call to hashMasterPassword in setTimeout to prevent it from freezing the ui
			const hashResult = await new Promise<HashResult>((resolve, reject) => {
				setTimeout(() => {
					hashMasterPassword(email, password).then(resolve).catch(reject)
				}, 0)
			})
			stretchedMasterKey.current = await deriveStretchedMasterKey(
				hashResult.masterKey.hash,
			)

			form.set(
				"passwordHash",
				sodium.to_base64(
					hashResult.masterPasswordHash.hash,
					sodium.base64_variants.ORIGINAL,
				),
			)
			form.delete("password")

			fetcher.submit(form, { method: "POST" })

			navigate("/blogs", { replace: true })
		} catch (e) {
			console.error(e)
			toast.error("an error occurred on our end. please try again later.")
			setIsSubmitting(false)
		}
	}

	async function onLoginSuccessful(loginResponse: LoginResponse) {
		const stretchedMasterKeyBytes = stretchedMasterKey.current
		if (!stretchedMasterKeyBytes) {
			setIsSubmitting(false)
			toast.error("an error occurred on our end. please try again later.")
			return
		}

		try {
			const protectedSymmetricKey: Base64EncodedCipher = {
				text: loginResponse.protectedSymmetricKey,
				authTag: loginResponse.authTag,
				iv: loginResponse.iv,
			}
			const symmetricKey = await decrypt(
				protectedSymmetricKey,
				stretchedMasterKeyBytes,
			)
			saveSymmetricKeyInSessionStorage(new SymmetricKey(symmetricKey))
			saveEmail(loginResponse.email)
			saveProtectedSymmetricKey(protectedSymmetricKey)

			navigate("/blogs", { replace: true })
		} catch (e) {
			console.error(e)
			toast.error("an error occurred on our end. please try again later.")
		}
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

					<Button
						type="submit"
						containerClassName="mt-12 w-full"
						disabled={isSubmitting}
					>
						Login
					</Button>
				</fetcher.Form>

				<p className="text-xs text-center opacity-80 col-span-3 pt-8 my-4 leading-loose">
					don't have an account?{" "}
					<Anchor to="/sign-up" className="font-bold">
						click here to sign up
					</Anchor>
				</p>
			</main>
		</div>
	)
})
export default LoginPage

export function ErrorBoundary() {
	const error = useRouteApplicationError()

	useEffect(() => {
		let toastId: string
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			toastId = toast.error("incorrect email or password")
		} else {
			toastId = displayInternalErrorToast(error, "login.tsx -> clientAction")
		}
		return () => {
			toast.remove(toastId)
		}
	}, [error])

	return <LoginPage />
}

export async function action({ request }: ActionFunctionArgs) {
	const form = await request.formData()

	try {
		const response = await fetchApi<LoginResponse>("/auth/login", {
			method: "POST",
			body: form,
		})

		const session = await getSession(request.headers.get("Cookie"))
		session.set("accessToken", response.accessToken)
		session.set("refreshToken", response.refreshToken)
		session.set("expiresAtUnixMs", response.expiresAtUnixMs)

		return data(response, {
			headers: {
				"Set-Cookie": await commitSession(session),
			},
		})
	} catch (error) {
		if (isApplicationError(error, ERROR_TYPE.unauthorized)) {
			throw applicationHttpError({ error: ERROR_TYPE.unauthorized })
		}
		throw applicationHttpError({ error: ERROR_TYPE.internal })
	}
}
