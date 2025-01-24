import clsx from "clsx"
import React, {
	type PropsWithChildren,
	type ReactElement,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router"
import { ClientOnly } from "remix-utils/client-only"
import { Logo } from "~/components/logo"
import { Deferred } from "~/deferred"
import { type CheckedPromise, NotLoggedInError, throws } from "~/errors"
import { Button } from "./components/button"
import {
	type Base64EncodedCipher,
	SymmetricKey,
	base64EncodedCipherFromJson,
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

const KeyStoreContext = React.createContext<KeyStore>(
	null as unknown as KeyStore,
)

function KeyStoreProvider({ children }: PropsWithChildren) {
	const [isPasswordInputVisible, setIsPasswordInputVisible] = useState(false)
	const email = useRef<string | null>(null)
	const protectedSymmetricKey = useRef<Base64EncodedCipher | null>(null)
	const pendingKeyPromise = useRef<Promise<SymmetricKey> | null>(null)
	const initDeferral = useRef(new Deferred<void>())
	const keyRef = useRef<SymmetricKey | null>(null)
	const passwordOverlayRef = useRef<ReactElement | null>(null)
	const navigate = useNavigate()

	useEffect(() => {
		const protectedSymKeyJson = localStorage.getItem("protectedSymmetricKey")
		const _email = localStorage.getItem("email")
		if (!protectedSymKeyJson || !_email) {
			navigate("/login", { replace: true })
			initDeferral.current.reject(new NotLoggedInError())
			return
		}

		const _protectedSymmetricKey =
			base64EncodedCipherFromJson(protectedSymKeyJson)
		if (!_protectedSymmetricKey) {
			navigate("/login", { replace: true })
			initDeferral.current.reject(new NotLoggedInError())
			return
		}

		protectedSymmetricKey.current = _protectedSymmetricKey
		email.current = _email

		const keyBase64 = sessionStorage.getItem("symmetricKey")
		if (keyBase64) {
			SymmetricKey.fromBase64(keyBase64).then((key) => {
				keyRef.current = key
				initDeferral.current.resolve()
			})
		} else {
			initDeferral.current.resolve()
		}
	}, [navigate])

	const getKey = useCallback(async () => {
		if (initDeferral.current) {
			await initDeferral.current.promise
		}

		if (keyRef.current) {
			return Promise.resolve(keyRef.current)
		}

		if (pendingKeyPromise.current) {
			return pendingKeyPromise.current
		}

		const keyBase64 = sessionStorage.getItem("keyBase64")
		if (keyBase64) {
			const p = SymmetricKey.fromBase64(keyBase64).then((key) => {
				keyRef.current = key
				return key
			})
			pendingKeyPromise.current = p
			return p
		}

		const _protectedSymmetricKey =
			protectedSymmetricKey.current ?? throws(new KeyUnavailableError())
		const _email = email.current || throws(new NotLoggedInError())

		const p = new Promise<SymmetricKey>((resolve) => {
			setIsPasswordInputVisible(true)
			passwordOverlayRef.current = (
				<PasswordOverlay
					email={_email}
					protectedSymmetricKey={_protectedSymmetricKey}
					onUnlock={(key) => {
						keyRef.current = key
						resolve(key)
						setIsPasswordInputVisible(false)
					}}
				/>
			)
		})
		pendingKeyPromise.current = p
		return p
	}, [])

	const keyStore = useMemo(() => ({ getKey }), [getKey])

	return (
		<KeyStoreContext.Provider value={keyStore}>
			{children}
			<ClientOnly>
				{() =>
					isPasswordInputVisible && passwordOverlayRef.current
						? createPortal(passwordOverlayRef.current, document.body)
						: null
				}
			</ClientOnly>
		</KeyStoreContext.Provider>
	)
}

function useKeyStore(): KeyStore {
	return useContext(KeyStoreContext)
}

function PasswordOverlay({
	email,
	protectedSymmetricKey,
	onUnlock,
}: PasswordInputProps) {
	const [isDecrypting, setIsDecrypting] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	async function decryptKey() {
		if (!inputRef.current) return

		const password = inputRef.current.value
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
		} finally {
			setIsDecrypting(false)
		}
	}

	return (
		<div className="h-full w-full absolute inset-0 z-20 backdrop-blur-md flex items-center justify-center">
			<div className="flex flex-col items-center justify-center max-w-prose ">
				<div
					className={clsx("w-14 h-14 mb-4", {
						"animate-bounce": isDecrypting,
					})}
				>
					<Logo />
				</div>
				<p className="font-bold text-xl">Unlock kepi</p>
				<p>enter your password to unlock kepi</p>

				<input
					ref={inputRef}
					required
					disabled={isDecrypting}
					placeholder="Enter your password"
					type="password"
					className="bg-transparent focus:outline-none w-full text-center my-8"
					onKeyUp={(e) => {
						if (e.key === "Enter") {
							decryptKey()
						}
					}}
				/>

				<Button
					containerClassName="w-full"
					disabled={isDecrypting}
					onClick={decryptKey}
				>
					{isDecrypting ? "Unlocking" : "Unlock"}
				</Button>
			</div>
		</div>
	)
}

export { KeyStoreProvider, useKeyStore }
