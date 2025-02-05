import React, { memo, useEffect } from "react"
import { Outlet, useLoaderData } from "react-router"
import { Anchor } from "~/components/anchor"
import { Logo } from "~/components/logo"
import {
	NotebookStoreProvider,
	useNotebookStore,
	useNotebookStoreContext,
} from "~/notebook/notebook-store"
import { findNotebook } from "~/vault/notebook"
import type { Route } from "../../.react-router/types/app/routes/+types/notebooks.$notebookSlug"

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const notebook = await findNotebook(params.notebookSlug)
	if (!notebook) {
		return new Response(null, { status: 404 })
	}
	return notebook
}

export function ErrorBoundary() {
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
	return (
		// @ts-ignore
		<NotebookStoreProvider notebook={notebook}>
			<AutoSaveNotebook />
		</NotebookStoreProvider>
	)
}

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
