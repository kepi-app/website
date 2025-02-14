import clsx from "clsx"
import React, { memo, useEffect, useId, useRef, useState } from "react"
import {
	Outlet,
	useLoaderData,
	useRevalidator,
	useRouteError,
} from "react-router"
import { Anchor } from "~/components/anchor"
import { Button } from "~/components/button"
import { Logo } from "~/components/logo"
import {
	SymmetricKey,
	decryptRaw,
	deriveMasterKey,
	deriveStretchedMasterKey,
} from "~/crypt"
import {
	NotebookStoreProvider,
	useNotebookStore,
	useNotebookStoreContext,
} from "~/notebook/notebook-store"
import {
	ENCRYPTION_STATUS,
	type EncryptedNotebook,
	cacheNotebookKey,
	decryptNotebook,
	findNotebook,
	retrieveCachedNotebookKey,
} from "~/vault/notebook"
import type { Route } from "./+types/notebooks.$notebookSlug"

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const notebook = await findNotebook(params.notebookSlug)
	if (!notebook) {
		return new Response(null, { status: 404 })
	}
	if (notebook.encryptionStatus === ENCRYPTION_STATUS.encrypted) {
		const cachedKey = await retrieveCachedNotebookKey(notebook)
		if (cachedKey) {
			return await decryptNotebook(notebook, cachedKey)
		}
	}
	return notebook
}

export function ErrorBoundary() {
	const error = useRouteError()
	console.log(error)
	return (
		<div className="w-full h-screen flex justify-center">
			<main className="w-full h-full max-w-prose flex flex-col justify-center items-start">
				<div className="h-8 w-8 mb-8">
					<Logo />
				</div>
				<h1 className="text-xl mb-16">This notebook does not exist!</h1>
				<Anchor className="text-sm opacity-80 mb-20" to="/notebooks">
					Browse all notebooks
				</Anchor>
			</main>
		</div>
	)
}

export default function Page() {
	const notebook = useLoaderData<typeof clientLoader>()

	if (notebook.encryptionStatus === ENCRYPTION_STATUS.encrypted) {
		// @ts-ignore
		return <NotebookDecryptionPage notebook={notebook} />
	}

	return (
		// @ts-ignore
		<NotebookStoreProvider notebook={notebook}>
			<AutoSaveNotebook />
		</NotebookStoreProvider>
	)
}

const NotebookDecryptionPage = memo(
	({ notebook }: { notebook: EncryptedNotebook }) => {
		const [isDecrypting, setIsDecrypting] = useState(false)
		const inputRef = useRef<HTMLInputElement | null>(null)
		const passwordInputId = useId()
		const revalidator = useRevalidator()

		async function decryptKey() {
			if (!inputRef.current) return

			const password = inputRef.current.value
			setIsDecrypting(true)

			try {
				const masterKey = await deriveMasterKey(
					notebook.masterKeySalt,
					password,
				)
				const stretchedMasterKey = await deriveStretchedMasterKey(
					masterKey.hash,
				)
				const symmetricKey = await decryptRaw(
					notebook.protectedSymmetricKey,
					stretchedMasterKey,
				)

				cacheNotebookKey(notebook, new SymmetricKey(symmetricKey))

				await revalidator.revalidate()
			} catch (error) {
				console.error(error)
			} finally {
				setIsDecrypting(false)
			}
		}

		return (
			<div className="h-screen w-full flex items-center justify-center">
				<main className="flex flex-col items-center justify-center max-w-prose ">
					<div
						className={clsx("w-14 h-14 mb-4", {
							"animate-bounce": isDecrypting,
						})}
					>
						<Logo />
					</div>
					<p className="font-bold text-xl">Unlock notebook</p>

					<label htmlFor={passwordInputId}>
						enter your password to unlock your notebook
					</label>

					<input
						required
						ref={inputRef}
						id={passwordInputId}
						disabled={isDecrypting}
						name="password"
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
				</main>
			</div>
		)
	},
)

const AutoSaveNotebook = memo(() => {
	const notebookStore = useNotebookStoreContext()
	const saveNotebookIndex = useNotebookStore((state) => state.saveNotebookIndex)

	useEffect(() => {
		const unsub = notebookStore.subscribe(
			(state) => state.notebook.index,
			() => {
				saveNotebookIndex()
			},
		)
		return () => {
			unsub()
		}
	}, [saveNotebookIndex, notebookStore.subscribe])

	return <Outlet />
})
AutoSaveNotebook.displayName = "AutoSaveNotebook"

function LoadingPage() {
	return (
		<div className="w-full flex items-center justify-center">
			<main className="w-full max-w-prose mt-28">
				<div className="h-8 w-8 mb-8">
					<Logo />
				</div>
				<p className="opacity-50 animate-pulse">Opening notebook</p>
			</main>
		</div>
	)
}
