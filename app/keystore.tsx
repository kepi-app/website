import { useNavigate } from "react-router"
import clsx from "clsx"
import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { type CheckedPromise, NotLoggedInError, throws } from "~/errors"
import { Button } from "./components/button"
import {
	type Base64EncodedCipher,
	SymmetricKey,
	decrypt,
	deriveMasterKey,
	deriveStretchedMasterKey,
} from "./crypt"

interface KeyStore {
	getKey(): CheckedPromise<SymmetricKey, NotLoggedInError | KeyUnavailableError>
}

interface PasswordInputProps {
	email: string
	protectedSymmetricKey: Base64EncodedCipher
	onUnlock: (symmetricKey: SymmetricKey) => void
}

class KeyUnavailableError extends Error {
	constructor() {
		super("symmetric key not available.")
	}
}

function PasswordInput({
	email,
	protectedSymmetricKey,
	onUnlock,
}: PasswordInputProps) {
	const [password, setPassword] = useState("")
	const [isDecrypting, setIsDecrypting] = useState(false)
	const [shouldShowErrorColor, setShouldShowErrorColor] = useState(false)

	async function decryptKey() {
		setIsDecrypting(true)

		try {
			const masterKey = await deriveMasterKey(email, password)
			const stretchedMasterKey = await deriveStretchedMasterKey(masterKey.hash)
			const symmetricKey = await decrypt(
				protectedSymmetricKey,
				stretchedMasterKey,
			)
			onUnlock(new SymmetricKey(symmetricKey))
		} catch {
			showErrorMessage()
		} finally {
			setIsDecrypting(false)
		}
	}

	async function showErrorMessage() {
		setShouldShowErrorColor(true)
	}

	return (
		<div className="flex flex-row w-full space-x-4 items-center">
			<div className="flex flex-1 flex-col items-start">
				<input
					required
					placeholder="Enter your password"
					type="password"
					className={clsx("bg-transparent focus:outline-none", {
						"text-rose-500 placeholder-rose-500 dark:text-rose-200 dark:placeholder-rose-500":
							shouldShowErrorColor,
					})}
					value={password}
					onChange={(e) => {
						setShouldShowErrorColor(false)
						setPassword(e.currentTarget.value)
					}}
					onKeyUp={(e) => {
						if (e.key === "Enter") {
							decryptKey()
						}
					}}
				/>
			</div>
			<Button disabled={isDecrypting} onClick={decryptKey}>
				{isDecrypting ? "Unlocking" : "Unlock"}
			</Button>
		</div>
	)
}

function useKeyStore(): KeyStore {
	const keyRef = useRef<SymmetricKey | null>(null)
	const email = useRef<string | null>("")
	const protectedSymmetricKey = useRef<Base64EncodedCipher | null>(null)
	const pendingKeyPromise = useRef<Promise<SymmetricKey> | null>(null)
	const navigate = useNavigate()

	useEffect(() => {
		const protectedSymKeyJson = localStorage.getItem("protectedSymmetricKey")
		const _email = localStorage.getItem("email")
		if (!protectedSymKeyJson || !_email) {
			navigate("/login", { replace: true })
			return
		}
		protectedSymmetricKey.current = JSON.parse(protectedSymKeyJson)
		email.current = _email

		const keyBase64 = sessionStorage.getItem("symmetricKey")
		if (keyBase64) {
			pendingKeyPromise.current = SymmetricKey.fromBase64(keyBase64).then(
				(key) => {
					keyRef.current = key
					return key
				},
			)
		} else {
			getKey()
		}
	}, [navigate])

	const getKey = useCallback(() => {
		if (keyRef.current) {
			return Promise.resolve(keyRef.current)
		}
		if (pendingKeyPromise.current) {
			return pendingKeyPromise.current
		}

		const _protectedSymmetricKey =
			protectedSymmetricKey.current ?? throws(new KeyUnavailableError())
		const _email = email.current || throws(new NotLoggedInError())

		const p = new Promise<SymmetricKey>((resolve) => {
			const toastId = toast.custom(
				(t) => (
					<div
						className={`${
							t.visible ? "animate-enter" : "animate-leave"
						} max-w-md w-full bg-zinc-50 dark:bg-zinc-800 shadow-lg rounded-full pointer-events-auto flex ring-1 ring-black ring-opacity-5 pl-6 pr-2 py-2`}
					>
						<PasswordInput
							email={_email}
							protectedSymmetricKey={_protectedSymmetricKey}
							onUnlock={(key) => {
								keyRef.current = key
								toast.dismiss(toastId)
								pendingKeyPromise.current = null
								resolve(key)
							}}
						/>
					</div>
				),
				{
					duration: Number.POSITIVE_INFINITY,
					position: "top-center",
				},
			)
		})
		pendingKeyPromise.current = p
		return p
	}, [])

	return { getKey }
}

export { useKeyStore }
