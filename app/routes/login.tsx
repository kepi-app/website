import {
	type ActionFunctionArgs,
	json,
	redirect,
	type LoaderFunctionArgs,
} from "@remix-run/node"
import { useFetcher, useNavigate } from "@remix-run/react"
import clsx from "clsx"
import { useEffect, useId, useRef, useState } from "react"
import _sodium from "libsodium-wrappers-sumo"
import { Button } from "~/components/button"
import { Logo } from "~/components/logo"
import {
	SymmetricKey,
	deriveStretchedMasterKey,
	hashMasterPassword,
	saveSymmetricKeyInSessionStorage,
} from "~/crypt"
import { fetchApi } from "~/fetch-api"
import { ApiError } from "~/error"
import { commitSession, getSession } from "~/sessions"
import toast from "react-hot-toast"
import { trys } from "trycat"

interface LoginResponse {
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
	console.log(session.get("isLoggingIn"))
	if (refreshToken && !session.get("isLoggingIn")) {
		return redirect("/blogs")
	}
	return null
}

export default function LoginPage() {
	const emailInputId = useId()
	const passwordInputId = useId()
	const fetcher = useFetcher<typeof action>()
	const [isSubmitting, setIsSubmitting] = useState(false)
	const stretchedMasterKey = useRef<SymmetricKey | null>(null)
	const navigate = useNavigate()

	useEffect(() => {
		if (fetcher.data) {
			if ("error" in fetcher.data) {
				setIsSubmitting(false)
				switch (fetcher.data.error) {
					case ApiError.Unauthorized:
						toast.error("incorrect email or password")
						break
					default:
						toast.error("an issue happened on our end. please try again later.")
						break
				}
			} else {
				decryptSymmetricKey(
					fetcher.data.protectedSymmetricKey,
					fetcher.data.authTag,
					fetcher.data.iv,
				)
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

		const stretchedMasterKeyResult = await deriveStretchedMasterKey(
			hashResult.value.masterKey.hash,
		)
		if (stretchedMasterKeyResult.isErr()) {
			toast.error("an error occurred on our end. please try again later.")
			setIsSubmitting(false)
			return
		}

		stretchedMasterKey.current = stretchedMasterKeyResult.value

		form.set(
			"passwordHash",
			sodium.to_base64(
				hashResult.value.masterPasswordHash.hash,
				sodium.base64_variants.ORIGINAL,
			),
		)
		form.delete("password")

		fetcher.submit(form, { method: "POST" })
	}

	async function decryptSymmetricKey(
		protectedSymmetricKey: string,
		authTag: string,
		iv: string,
	) {
		await _sodium.ready
		const sodium = _sodium

		const stretchedMasterKeyBytes = stretchedMasterKey.current
		if (!stretchedMasterKeyBytes) {
			setIsSubmitting(false)
			toast.error("an error occurred on our end. please try again later.")
			return
		}

		const protectedSymmetricKeyBytes = sodium.from_base64(
			protectedSymmetricKey,
			sodium.base64_variants.ORIGINAL,
		)
		const authTagBytes = sodium.from_base64(
			authTag,
			sodium.base64_variants.ORIGINAL,
		)
		const ivBytes = sodium.from_base64(iv, sodium.base64_variants.ORIGINAL)

		const symmetricKeyBytes = trys(() =>
			sodium.crypto_aead_xchacha20poly1305_ietf_decrypt_detached(
				null,
				protectedSymmetricKeyBytes,
				authTagBytes,
				"",
				ivBytes,
				stretchedMasterKeyBytes.encryptionKey,
				"uint8array",
			),
		)
		if (symmetricKeyBytes.isErr()) {
			setIsSubmitting(false)
			toast.error("an error occured on our end. please try again later.")
		} else {
			saveSymmetricKeyInSessionStorage(
				new SymmetricKey(symmetricKeyBytes.value),
			)
			navigate("/blogs", { replace: true })
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

	const response = result.value
	const session = await getSession(request.headers.get("Cookie"))
	session.set("accessToken", response.accessToken)
	session.set("refreshToken", response.refreshToken)
	session.set("expiresAtUnixMs", response.expiresAtUnixMs)
	session.flash("isLoggingIn", true)

	return json(
		{
			protectedSymmetricKey: response.protectedSymmetricKey,
			authTag: response.authTag,
			iv: response.iv,
		},
		{
			headers: {
				"Set-Cookie": await commitSession(session),
			},
		},
	)
}
