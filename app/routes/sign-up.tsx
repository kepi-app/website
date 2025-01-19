import type { ActionFunctionArgs } from "react-router"
import { data, useFetcher, useNavigate } from "react-router"
import sodium from "libsodium-wrappers"
import { useEffect, useId, useRef } from "react"
import { Button } from "~/components/button"
import { Logo } from "~/components/logo"
import {
	type CryptInfo,
	deriveInitialKeys,
	saveSymmetricKeyInSessionStorage,
} from "~/crypt"
import { ApiError } from "~/error"
import { fetchApi } from "~/fetch-api"
import { saveEmail, saveProtectedSymmetricKey } from "~/local-storage"
import { commitSession, getSession } from "~/sessions"

interface SignUpResponse {
	accessToken: string
	refreshToken: string
	expiresAtUnixMs: number
}

export default function SignUpPage() {
	const emailInputId = useId()
	const passwordInputId = useId()
	const fetcher = useFetcher<typeof action>()
	const derivedCryptInfo = useRef<CryptInfo | null>(null)
	const submittedFormRef = useRef<FormData | null>(null)
	const navigate = useNavigate()

	useEffect(() => {
		if (fetcher.data && derivedCryptInfo.current) {
			onSignUpSuccess()
		}
	}, [fetcher.data])

	async function submitSignUpForm(event: React.FormEvent<HTMLFormElement>) {
		const formData = new FormData(event.currentTarget)

		const email = formData.get("email")
		const password = formData.get("password")
		if (
			!email ||
			!password ||
			typeof email !== "string" ||
			typeof password !== "string"
		) {
			return
		}

		const info = await deriveInitialKeys(email, password)
		console.log(info)
		derivedCryptInfo.current = info

		const signUpFormData = new FormData()
		signUpFormData.set("email", email)
		signUpFormData.set(
			"masterPasswordHash",
			sodium.to_base64(
				info.masterPasswordHash,
				sodium.base64_variants.ORIGINAL,
			),
		)
		signUpFormData.set(
			"protectedSymmetricKey",
			sodium.to_base64(
				info.protectedSymmetricKey,
				sodium.base64_variants.ORIGINAL,
			),
		)
		signUpFormData.set(
			"iv",
			sodium.to_base64(info.iv, sodium.base64_variants.ORIGINAL),
		)
		signUpFormData.set(
			"authTag",
			sodium.to_base64(info.authTag, sodium.base64_variants.ORIGINAL),
		)

		fetcher.submit(signUpFormData, {
			method: "POST",
			encType: "multipart/form-data",
		})

		submittedFormRef.current = formData
	}

	function onSignUpSuccess() {
		const submittedForm = submittedFormRef.current
		if (!submittedForm || !derivedCryptInfo.current) {
			return
		}

		const email = submittedForm.get("email") as string
		const protectedSymmetricKey = submittedForm.get(
			"protectedSymmetricKey",
		) as string
		const authTag = submittedForm.get("authTag") as string
		const iv = submittedForm.get("iv") as string

		submittedFormRef.current = null

		saveSymmetricKeyInSessionStorage(derivedCryptInfo.current.symmetricKey)
		saveEmail(email)
		saveProtectedSymmetricKey({
			text: protectedSymmetricKey,
			authTag,
			iv,
		})
		navigate("/blogs/new", {
			replace: true,
		})
	}

	return (
		<div className="w-full h-screen flex justify-center items-center">
			<main className="w-full max-w-prose flex flex-col justify-center items-center">
				<div className="flex flex-col items-center mb-12">
					<div className="w-14 h-14 mb-4">
						<Logo />
					</div>
					<h1 className="text-2xl">welcome to kepi</h1>
				</div>

				<fetcher.Form
					className="flex flex-col items-center"
					onSubmit={submitSignUpForm}
				>
					<div className="grid grid-cols-3 grid-rows-2 gap-4">
						<label htmlFor={emailInputId}>email</label>
						<input
							type="email"
							name="email"
							placeholder="sakurajima@mai.com"
							id={emailInputId}
							className="col-span-2 bg-transparent placeholder:opacity-20"
						/>
						<label htmlFor={passwordInputId}>password</label>
						<input
							type="password"
							name="password"
							id={passwordInputId}
							className="col-span-2 bg-transparent placeholder:opacity-20"
							placeholder="new password"
						/>
					</div>

					<Button type="submit" containerClassName="w-full mt-12">
						Sign up
					</Button>
				</fetcher.Form>

				<p className="text-xs text-center opacity-80 col-span-3 pt-8 my-4 leading-loose">
					your password will be used for encryption. make a note of your
					password.
					<br />
					<strong>
						if you forget your password, we cannot recover your content.
					</strong>
				</p>
			</main>
		</div>
	)
}

export async function action({ request }: ActionFunctionArgs) {
	const form = await request.formData()

	try {
		const tokens = await fetchApi<SignUpResponse>("/sign-up", {
			method: "POST",
			body: form,
		})

		const session = await getSession(request.headers.get("Cookie"))
		session.set("accessToken", tokens.accessToken)
		session.set("refreshToken", tokens.refreshToken)
		session.set("expiresAtUnixMs", tokens.expiresAtUnixMs)

		return data(
			{},
			{
				headers: {
					"Set-Cookie": await commitSession(session),
				},
			},
		)
	} catch (error) {
		throw data({ error: ApiError.Internal }, { status: 500 })
	}
}
